// Karten des bayerischen Blatts.
// Eine Karte wird als kurzer String kodiert: Farbe + Schlag, z. B. "EO" (Eichel-Ober), "H10" (Herz-Zehn).

export const SUITS = ['E', 'G', 'H', 'S'] as const;
export type Suit = (typeof SUITS)[number];

/** Schläge in der natürlichen Reihenfolge einer Farbe (höchste zuerst). */
export const RANKS = ['A', '10', 'K', 'O', 'U', '9', '8', '7'] as const;
export type Rank = (typeof RANKS)[number];

export type Card = `${Suit}${Rank}`;

export type DeckType = 'long' | 'short';

export const SUIT_NAMES: Record<Suit, string> = {
  E: 'Eichel',
  G: 'Gras',
  H: 'Herz',
  S: 'Schellen',
};

export const RANK_NAMES: Record<Rank, string> = {
  A: 'Sau',
  '10': 'Zehn',
  K: 'König',
  O: 'Ober',
  U: 'Unter',
  '9': 'Neun',
  '8': 'Acht',
  '7': 'Sieben',
};

export const AUGEN: Record<Rank, number> = {
  A: 11,
  '10': 10,
  K: 4,
  O: 3,
  U: 2,
  '9': 0,
  '8': 0,
  '7': 0,
};

export const suitOf = (c: Card): Suit => c[0] as Suit;
export const rankOf = (c: Card): Rank => c.slice(1) as Rank;
export const makeCard = (s: Suit, r: Rank): Card => `${s}${r}` as Card;
export const augenOf = (c: Card): number => AUGEN[rankOf(c)];
export const cardName = (c: Card): string => `${SUIT_NAMES[suitOf(c)]}-${RANK_NAMES[rankOf(c)]}`;

export function deckRanks(deck: DeckType): Rank[] {
  return deck === 'long' ? [...RANKS] : RANKS.filter((r) => r !== '7' && r !== '8');
}

export function makeDeck(deck: DeckType): Card[] {
  const ranks = deckRanks(deck);
  const cards: Card[] = [];
  for (const s of SUITS) for (const r of ranks) cards.push(makeCard(s, r));
  return cards;
}

/** Anzahl Karten pro Spieler. */
export const handSize = (deck: DeckType): number => (deck === 'long' ? 8 : 6);

/** Anzahl Karten, die vor dem Legen ausgeteilt werden. */
export const firstDealSize = (deck: DeckType): number => (deck === 'long' ? 4 : 3);

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
