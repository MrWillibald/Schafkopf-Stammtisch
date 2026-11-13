import { randomBytes, randomUUID } from 'node:crypto';
import {
  type Action,
  type HandState,
  PLAYERS,
  RuleError,
  type Rules,
  applyAction,
  newHand,
  next,
  sanitizeRules,
  viewFor,
} from '../engine';
import type { HistoryEntry, PlayerInfo, RoomView, SieEntry } from '../shared/protocol';

export interface PlayerRecord {
  token: string;
  name: string;
  seat: number;
  ready: boolean;
}

/** Alles, was zu einer Runde gespeichert wird (JSON-serialisierbar). */
export interface RoomData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rules: Rules;
  hostToken: string;
  players: PlayerRecord[];
  status: 'lobby' | 'playing';
  handNo: number;
  dealer: number;
  hand: HandState | null;
  history: HistoryEntry[];
  balance: number[];
  sie: SieEntry[];
}

export class RoomError extends Error {}

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function newRoomId(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

const cleanName = (name: unknown, fallback: string): string => {
  const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 24) : '';
  return n || fallback;
};

export class Room {
  constructor(
    public data: RoomData,
    private rng: () => number = Math.random,
  ) {}

  static create(roomName: unknown, rules: unknown): Room {
    const now = new Date().toISOString();
    return new Room({
      id: newRoomId(),
      name: cleanName(roomName, 'Stammtisch'),
      createdAt: now,
      updatedAt: now,
      rules: sanitizeRules(rules),
      hostToken: '',
      players: [],
      status: 'lobby',
      handNo: 0,
      dealer: 0,
      hand: null,
      history: [],
      balance: [0, 0, 0, 0],
      sie: [],
    });
  }

  private touch() {
    this.data.updatedAt = new Date().toISOString();
  }

  player(token: string | undefined): PlayerRecord | undefined {
    return token ? this.data.players.find((p) => p.token === token) : undefined;
  }

  private requirePlayer(token: string): PlayerRecord {
    const p = this.player(token);
    if (!p) throw new RoomError('Du bist nicht in dieser Runde.');
    return p;
  }

  /** Beitreten (neu mit Namen) oder wieder verbinden (mit Token). */
  join(token: string | undefined, name: unknown): PlayerRecord {
    const existing = this.player(token);
    if (existing) return existing;
    if (this.data.players.length >= PLAYERS) throw new RoomError('Die Runde ist schon voll (4 Spieler).');
    const n = cleanName(name, '');
    if (!n) throw new RoomError('Bitte gib einen Namen ein.');
    if (this.data.players.some((p) => p.name.toLowerCase() === n.toLowerCase()))
      throw new RoomError('Dieser Name ist schon vergeben.');
    const p: PlayerRecord = { token: randomUUID(), name: n, seat: this.data.players.length, ready: false };
    this.data.players.push(p);
    if (!this.data.hostToken) this.data.hostToken = p.token;
    this.touch();
    return p;
  }

  setRules(token: string, rules: unknown) {
    if (token !== this.data.hostToken) throw new RoomError('Nur wer die Runde angelegt hat, darf die Regeln ändern.');
    if (this.data.status !== 'lobby') throw new RoomError('Die Regeln können nur vor dem ersten Spiel geändert werden.');
    this.data.rules = sanitizeRules(rules);
    this.touch();
  }

  start(token: string) {
    if (token !== this.data.hostToken) throw new RoomError('Nur wer die Runde angelegt hat, kann starten.');
    if (this.data.status !== 'lobby') throw new RoomError('Das Spiel läuft schon.');
    if (this.data.players.length < PLAYERS) throw new RoomError('Es braucht vier Spieler.');
    this.data.status = 'playing';
    this.data.dealer = Math.floor(this.rng() * PLAYERS);
    this.dealNext(false);
  }

  private dealNext(rotate: boolean) {
    if (rotate) this.data.dealer = next(this.data.dealer);
    this.data.handNo++;
    this.data.hand = newHand(this.data.rules, this.data.dealer, this.rng);
    for (const p of this.data.players) p.ready = false;
    this.touch();
  }

  act(token: string, action: Action) {
    const p = this.requirePlayer(token);
    const hand = this.data.hand;
    if (!hand || this.data.status !== 'playing') throw new RoomError('Es läuft gerade kein Spiel.');
    try {
      this.data.hand = applyAction(hand, p.seat, action);
    } catch (e) {
      if (e instanceof RuleError) throw new RoomError(e.message);
      throw new RoomError('Ungültige Aktion.');
    }
    if (this.data.hand.phase === 'done') this.record();
    this.touch();
  }

  private record() {
    const hand = this.data.hand!;
    const result = hand.result!;
    for (let i = 0; i < PLAYERS; i++) this.data.balance[i] += result.payouts[i];
    const at = new Date().toISOString();
    this.data.history.push({ no: this.data.handNo, dealer: hand.dealer, at, result, balance: [...this.data.balance] });
    if (result.sie !== null) {
      const name = this.data.players[result.sie]?.name ?? '?';
      this.data.sie.push({ name, at, cards: result.hands[result.sie] });
    }
  }

  /** Spieler bestätigt das Ergebnis; sind alle bereit, wird neu gegeben. */
  ready(token: string) {
    const p = this.requirePlayer(token);
    if (this.data.hand?.phase !== 'done') throw new RoomError('Das Spiel läuft noch.');
    p.ready = true;
    if (this.data.players.every((x) => x.ready)) this.dealNext(true);
    this.touch();
  }

  view(token: string, connected: (token: string) => boolean): RoomView {
    const me = this.requirePlayer(token);
    const players: PlayerInfo[] = this.data.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      connected: connected(p.token),
      ready: p.ready,
      isHost: p.token === this.data.hostToken,
    }));
    return {
      id: this.data.id,
      name: this.data.name,
      rules: this.data.rules,
      status: this.data.status,
      you: { seat: me.seat, isHost: me.token === this.data.hostToken },
      players,
      handNo: this.data.handNo,
      hand: this.data.hand ? viewFor(this.data.hand, me.seat) : null,
      // Karten nur beim letzten Spiel mitschicken – spart Bandbreite.
      history: this.data.history.map((h, i, all) =>
        i === all.length - 1 ? h : { ...h, result: { ...h.result, hands: [] } },
      ),
      balance: this.data.balance,
      sie: this.data.sie,
    };
  }
}
