import { type Card, augenOf, makeDeck } from './cards';
import { type Contract, isSolo, trumpOrder } from './contract';
import type { HandState } from './hand';
import { MAX_MULTIPLIER } from './rules';

export interface HandResult {
  kind: 'game' | 'ramsch' | 'redeal' | 'sie';
  contract: Contract | null;
  declarer: number | null;
  partner: number | null;
  /** Augen je Sitz. */
  augen: number[];
  /** Anzahl Stiche je Sitz. */
  tricks: number[];
  /** Augen der Spielpartei (bei normalen Spielen). */
  declarerAugen: number;
  won: boolean;
  schneider: boolean;
  schwarz: boolean;
  laufende: number;
  multiplier: number;
  /** Wert pro Gegenspieler in Cent (inkl. Multiplikator). */
  value: number;
  /** Gewinn/Verlust je Sitz in Cent. Summe ist 0. */
  payouts: number[];
  /** Ramsch: wer verloren hat. */
  losers: number[];
  /** Ramsch: Durchmarsch durch diesen Sitz. */
  durchmarsch: number | null;
  /** Sitz mit "Sie". */
  sie: number | null;
  /** Alle Karten nach dem Austeilen (zum Nachschauen). */
  hands: Card[][];
}

function baseMultiplier(s: HandState): number {
  const n = s.legen.filter((x) => x === true).length + (s.kontra !== null ? 1 : 0) + (s.re !== null ? 1 : 0);
  return Math.min(MAX_MULTIPLIER, 2 ** n);
}

/** Laufende: ununterbrochene höchste Trümpfe einer Partei (ab Mindestanzahl). */
export function countLaufende(s: HandState, team: number[]): number {
  const c = s.contract!;
  const deck = new Set(makeDeck(s.rules.deck));
  const order = trumpOrder(c).filter((x) => deck.has(x));
  const holder = (card: Card) => s.initialHands.findIndex((h) => h.includes(card));
  const inTeam = (card: Card) => team.includes(holder(card));
  const first = inTeam(order[0]);
  let n = 0;
  while (n < order.length && inTeam(order[n]) === first) n++;
  const min = c.kind === 'wenz' || c.kind === 'geier' ? s.rules.laufendeMinWenzGeier : s.rules.laufendeMin;
  return n >= min ? n : 0;
}

export function scoreHand(s: HandState, special: { sie?: number; redeal?: boolean } = {}): HandResult {
  const augen = [0, 0, 0, 0];
  const tricks = [0, 0, 0, 0];
  for (const t of s.tricks) {
    augen[t.winner!] += t.cards.reduce((sum, c) => sum + augenOf(c), 0);
    tricks[t.winner!]++;
  }
  const multiplier = baseMultiplier(s);
  const result: HandResult = {
    kind: 'game',
    contract: s.contract,
    declarer: s.declarer,
    partner: s.partner,
    augen,
    tricks,
    declarerAugen: 0,
    won: false,
    schneider: false,
    schwarz: false,
    laufende: 0,
    multiplier,
    value: 0,
    payouts: [0, 0, 0, 0],
    losers: [],
    durchmarsch: null,
    sie: null,
    hands: s.initialHands.map((h) => [...h]),
  };

  if (special.sie !== undefined) return { ...result, kind: 'sie', sie: special.sie, multiplier: 1 };
  if (special.redeal) return { ...result, kind: 'redeal', multiplier: 1 };

  const c = s.contract!;
  const t = s.rules.tariff;

  if (c.kind === 'ramsch') {
    result.kind = 'ramsch';
    const value = t.game * multiplier;
    result.value = value;
    const durch = tricks.findIndex((n) => n === s.tricks.length);
    if (durch >= 0) {
      result.durchmarsch = durch;
      for (let p = 0; p < 4; p++) result.payouts[p] = p === durch ? 3 * value : -value;
      result.losers = [0, 1, 2, 3].filter((p) => p !== durch);
      return result;
    }
    const max = Math.max(...augen);
    const losers = [0, 1, 2, 3].filter((p) => augen[p] === max);
    result.losers = losers;
    if (losers.length < 4) {
      const winners = 4 - losers.length;
      for (let p = 0; p < 4; p++) {
        result.payouts[p] = losers.includes(p) ? -value * winners : value * losers.length;
      }
    }
    return result;
  }

  const team = s.partner !== null ? [s.declarer!, s.partner] : [s.declarer!];
  const declAugen = team.reduce((sum, p) => sum + augen[p], 0);
  const declTricks = team.reduce((sum, p) => sum + tricks[p], 0);
  const oppTricks = s.tricks.length - declTricks;
  const won = c.tout ? oppTricks === 0 : declAugen >= 61;
  const schwarz = won ? oppTricks === 0 : declTricks === 0;
  const schneider = won ? declAugen >= 90 : declAugen <= 30;
  const laufende = countLaufende(s, team);

  let base = isSolo(c.kind) ? t.solo : t.game;
  if (!c.tout && (schneider || schwarz)) base += t.schneider;
  base += laufende * t.laufende;
  if (c.tout) base *= 2;
  const value = base * multiplier;
  const sign = won ? 1 : -1;

  for (let p = 0; p < 4; p++) {
    const mine = team.includes(p);
    if (isSolo(c.kind)) result.payouts[p] = mine ? 3 * value * sign : -value * sign;
    else result.payouts[p] = mine ? value * sign : -value * sign;
  }

  return { ...result, declarerAugen: declAugen, won, schwarz, schneider, laufende, value };
}
