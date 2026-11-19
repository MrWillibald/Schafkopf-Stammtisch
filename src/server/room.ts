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
import { botDecide, botFallback } from './bot';

export interface PlayerRecord {
  token: string;
  name: string;
  seat: number;
  ready: boolean;
  /** Computer-Mitspieler */
  bot?: boolean;
}

const BOT_NAMES = ['Xaver (PC)', 'Resi (PC)', 'Wastl (PC)', 'Burgl (PC)'];

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
  /** Betrag im Stock (Cent). */
  stock?: number;
  /** Verdopplungen, die aus Zusammenwerfen noch für das nächste Spiel anstehen. */
  pendingDoubles?: number;
}

export class RoomError extends Error {}

// Web Crypto gibt es in Node und im Browser – so läuft die Room-Logik auch offline im Browser.
const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function newRoomId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

function randomUUID(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
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
      stock: 0,
      pendingDoubles: 0,
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

  /** Gastgeber füllt einen freien Platz mit einem Computer-Mitspieler. */
  addBot(token: string) {
    if (token !== this.data.hostToken) throw new RoomError('Nur der Gastgeber kann Computer-Mitspieler hinzufügen.');
    if (this.data.status !== 'lobby') throw new RoomError('Das Spiel läuft schon.');
    if (this.data.players.length >= PLAYERS) throw new RoomError('Die Runde ist schon voll.');
    const taken = new Set(this.data.players.map((p) => p.name.toLowerCase()));
    const name = BOT_NAMES.find((n) => !taken.has(n.toLowerCase())) ?? `PC ${this.data.players.length + 1}`;
    this.data.players.push({ token: randomUUID(), name, seat: this.data.players.length, ready: true, bot: true });
    this.touch();
  }

  /** Gastgeber entfernt einen Computer-Mitspieler wieder (nur vor dem Start). */
  removeBot(token: string, seat: number) {
    if (token !== this.data.hostToken) throw new RoomError('Nur der Gastgeber kann Mitspieler entfernen.');
    if (this.data.status !== 'lobby') throw new RoomError('Das Spiel läuft schon.');
    const p = this.data.players.find((x) => x.seat === seat);
    if (!p?.bot) throw new RoomError('Nur Computer-Mitspieler können entfernt werden.');
    this.data.players = this.data.players.filter((x) => x !== p).map((x, i) => ({ ...x, seat: i }));
    this.touch();
  }

  /** Ist ein Computer-Mitspieler am Zug? Dann seine Aktion (sonst null). */
  botMove(): { token: string; action: Action; fallback: Action | null } | null {
    const hand = this.data.hand;
    if (!hand || this.data.status !== 'playing' || hand.turn === null) return null;
    const p = this.data.players.find((x) => x.seat === hand.turn);
    if (!p?.bot) return null;
    const view = viewFor(hand, p.seat);
    const fallback = botFallback(view);
    let action: Action | null = null;
    try {
      action = botDecide(view, this.data.rules);
    } catch (e) {
      console.error('Bot-Fehler:', e);
    }
    action ??= fallback;
    return action ? { token: p.token, action, fallback } : null;
  }

  /** Führt den nächsten Bot-Zug aus. true, wenn etwas passiert ist. */
  runBot(): boolean {
    const move = this.botMove();
    if (!move) return false;
    try {
      this.act(move.token, move.action);
    } catch (e) {
      if (!move.fallback) throw e;
      console.error('Bot-Zug abgelehnt, nehme Ersatzzug:', e);
      this.act(move.token, move.fallback);
    }
    return true;
  }

  /**
   * Namen ändern: jeder seinen eigenen, der Gastgeber zusätzlich die Computer-Mitspieler.
   * Verlauf und Saldo hängen am Platz und zeigen den neuen Namen automatisch; die
   * Ruhmeshalle speichert den Namen direkt und wird deshalb mitgeändert.
   */
  rename(token: string, name: unknown, seat?: number) {
    const me = this.requirePlayer(token);
    const target = seat === undefined || seat === me.seat ? me : this.data.players.find((p) => p.seat === seat);
    if (!target) throw new RoomError('Diesen Platz gibt es nicht.');
    if (target !== me && !(target.bot && token === this.data.hostToken))
      throw new RoomError('Du kannst nur deinen eigenen Namen ändern.');
    const n = cleanName(name, '');
    if (!n) throw new RoomError('Bitte gib einen Namen ein.');
    if (this.data.players.some((p) => p !== target && p.name.toLowerCase() === n.toLowerCase()))
      throw new RoomError('Dieser Name ist schon vergeben.');
    const old = target.name;
    if (n === old) return;
    target.name = n;
    for (const e of this.data.sie) {
      if (e.seat === target.seat || (e.seat === undefined && e.name === old)) {
        e.name = n;
        e.seat = target.seat;
      }
    }
    this.touch();
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
    this.data.hand = newHand(this.data.rules, this.data.dealer, this.rng, {
      bock: this.data.pendingDoubles ?? 0,
      stock: this.data.stock ?? 0,
    });
    for (const p of this.data.players) p.ready = !!p.bot;
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
    this.data.stock = (this.data.stock ?? 0) + result.stockDelta;
    // Verdopplung nach Zusammenwerfen: gilt für das nächste tatsächlich gespielte Spiel.
    const bock = hand.bock ?? 0;
    // Mehr als 8-fach (3 Verdopplungen) kann Zusammenwerfen nicht bringen.
    if (result.kind === 'redeal') this.data.pendingDoubles = Math.min(3, bock + (this.data.rules.redeal === 'double' ? 1 : 0));
    else if (result.kind === 'sie') this.data.pendingDoubles = bock;
    else this.data.pendingDoubles = 0;
    const at = new Date().toISOString();
    this.data.history.push({
      no: this.data.handNo,
      dealer: hand.dealer,
      at,
      result,
      balance: [...this.data.balance],
      stock: this.data.stock,
    });
    if (result.sie !== null) {
      const name = this.data.players[result.sie]?.name ?? '?';
      this.data.sie.push({ name, seat: result.sie, at, cards: result.hands[result.sie] });
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
      connected: p.bot ? true : connected(p.token),
      ready: p.ready,
      isHost: p.token === this.data.hostToken,
      isBot: !!p.bot,
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
      stock: this.data.stock ?? 0,
      pendingDoubles: this.data.pendingDoubles ?? 0,
    };
  }
}
