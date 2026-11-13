import {
  type Card,
  type DeckType,
  type Rank,
  type Suit,
  RANKS,
  SUITS,
  SUIT_NAMES,
  deckRanks,
  makeCard,
  rankOf,
  suitOf,
} from './cards';
import type { Rules } from './rules';

export type GameKind = 'sauspiel' | 'farbsolo' | 'wenz' | 'geier' | 'farbwenz' | 'farbgeier' | 'ramsch';

/**
 * Ein angesagtes Spiel.
 * - sauspiel: `suit` ist die gerufene Farbe (E, G oder S)
 * - farbsolo / farbwenz / farbgeier: `suit` ist die Trumpffarbe
 */
export interface Contract {
  kind: GameKind;
  suit?: Suit;
  tout?: boolean;
}

/** Reiz-Stufen: 1 = Sauspiel, 2 = Solo (Farbsolo, Wenz, Geier, …). Tout ist keine eigene Stufe. */
export type Level = 1 | 2;

export const LEVEL_NAMES: Record<Level, string> = { 1: 'Sauspiel', 2: 'Solo' };

export const isSolo = (kind: GameKind): boolean => kind !== 'sauspiel' && kind !== 'ramsch';

export function contractLevel(c: Contract): Level {
  return c.kind === 'sauspiel' || c.kind === 'ramsch' ? 1 : 2;
}

/** Tout ist eine Zusatzansage zu einem Solo (inkl. Wenz/Geier), kein eigenes Spiel. */
export const canAnnounceTout = (c: Contract, rules: Rules): boolean => rules.tout && isSolo(c.kind);

/** Ober/Unter, die in diesem Spiel Trumpf sind – in Rangfolge. */
export function trumpRanks(kind: GameKind): Rank[] {
  switch (kind) {
    case 'wenz':
    case 'farbwenz':
      return ['U'];
    case 'geier':
    case 'farbgeier':
      return ['O'];
    default:
      return ['O', 'U'];
  }
}

export function trumpSuit(c: Contract): Suit | null {
  switch (c.kind) {
    case 'sauspiel':
    case 'ramsch':
      return 'H';
    case 'wenz':
    case 'geier':
      return null;
    default:
      return c.suit ?? null;
  }
}

/** Alle Trümpfe dieses Spiels, höchster zuerst (über das lange Blatt). */
export function trumpOrder(c: Contract, deck: DeckType = 'long'): Card[] {
  const ranks = deckRanks(deck);
  const tr = trumpRanks(c.kind);
  const out: Card[] = [];
  for (const r of tr) for (const s of SUITS) out.push(makeCard(s, r));
  const ts = trumpSuit(c);
  if (ts) for (const r of RANKS) if (!tr.includes(r) && ranks.includes(r)) out.push(makeCard(ts, r));
  return out;
}

const trumpIndexCache = new Map<string, Map<Card, number>>();
function trumpIndex(c: Contract): Map<Card, number> {
  const key = `${c.kind}:${c.suit ?? ''}`;
  let m = trumpIndexCache.get(key);
  if (!m) {
    m = new Map(trumpOrder(c).map((card, i) => [card, i]));
    trumpIndexCache.set(key, m);
  }
  return m;
}

export const isTrump = (card: Card, c: Contract): boolean => trumpIndex(c).has(card);

/** Die "Farbe", die eine Karte bedient: 'T' für Trumpf, sonst ihre Farbe. */
export const effSuit = (card: Card, c: Contract): Suit | 'T' => (isTrump(card, c) ? 'T' : suitOf(card));

function strength(card: Card, c: Contract, led: Suit | 'T'): number {
  const ti = trumpIndex(c).get(card);
  if (ti !== undefined) return 1000 - ti;
  if (suitOf(card) === led) return 100 - RANKS.indexOf(rankOf(card));
  return -1;
}

/** Index (0..3) der Karte, die den Stich gewinnt. Karten in Ausspielreihenfolge. */
export function trickWinnerIndex(cards: readonly Card[], c: Contract): number {
  const led = effSuit(cards[0], c);
  let best = 0;
  let bestStrength = strength(cards[0], c, led);
  for (let i = 1; i < cards.length; i++) {
    const st = strength(cards[i], c, led);
    if (st > bestStrength) {
      best = i;
      bestStrength = st;
    }
  }
  return best;
}

/** Sortiert eine Hand zur Anzeige: Trümpfe zuerst, dann Farben. */
export function sortHand(cards: readonly Card[], c: Contract | null): Card[] {
  const contract = c ?? { kind: 'sauspiel' };
  const ti = trumpIndex(contract);
  const suitPos: Record<Suit, number> = { E: 0, G: 1, S: 2, H: 3 };
  const key = (card: Card) => {
    const t = ti.get(card);
    if (t !== undefined) return t;
    return 100 + suitPos[suitOf(card)] * 10 + RANKS.indexOf(rankOf(card));
  };
  return [...cards].sort((a, b) => key(a) - key(b));
}

export function contractName(c: Contract): string {
  const s = c.suit ? SUIT_NAMES[c.suit] : '';
  let name: string;
  switch (c.kind) {
    case 'sauspiel':
      name = `Sauspiel auf die ${s === 'Schellen' ? 'Schelln' : s}`;
      break;
    case 'farbsolo':
      name = `${s}-Solo`;
      break;
    case 'wenz':
      name = 'Wenz';
      break;
    case 'geier':
      name = 'Geier';
      break;
    case 'farbwenz':
      name = `${s}-Wenz`;
      break;
    case 'farbgeier':
      name = `${s}-Geier`;
      break;
    case 'ramsch':
      name = 'Ramsch';
      break;
  }
  return c.tout ? `${name} Tout` : name;
}

export const sameContract = (a: Contract, b: Contract): boolean =>
  a.kind === b.kind && (a.suit ?? null) === (b.suit ?? null) && !!a.tout === !!b.tout;

/** Kann mit dieser Hand auf die Farbe gerufen werden? (Sau nicht selbst, mind. eine Farbkarte) */
export function canCall(hand: readonly Card[], suit: Suit): boolean {
  if (suit === 'H') return false;
  if (hand.includes(makeCard(suit, 'A'))) return false;
  const c: Contract = { kind: 'sauspiel', suit };
  return hand.some((card) => effSuit(card, c) === suit);
}

/** Alle Spiele, die ein Spieler mit dieser Hand nach den Regeln ansagen darf (ohne Tout-Zusatz). */
export function availableContracts(hand: readonly Card[], rules: Rules): Contract[] {
  const out: Contract[] = [];
  const g = rules.games;
  if (g.sauspiel) for (const s of ['E', 'G', 'S'] as Suit[]) if (canCall(hand, s)) out.push({ kind: 'sauspiel', suit: s });
  if (g.farbsolo) for (const s of SUITS) out.push({ kind: 'farbsolo', suit: s });
  if (g.wenz) out.push({ kind: 'wenz' });
  if (g.farbwenz) for (const s of SUITS) out.push({ kind: 'farbwenz', suit: s });
  if (g.geier) out.push({ kind: 'geier' });
  if (g.farbgeier) for (const s of SUITS) out.push({ kind: 'farbgeier', suit: s });
  return out;
}

export function maxLevel(hand: readonly Card[], rules: Rules): Level | 0 {
  let m: Level | 0 = 0;
  for (const c of availableContracts(hand, rules)) {
    const l = contractLevel(c);
    if (l > m) m = l;
  }
  return m;
}
