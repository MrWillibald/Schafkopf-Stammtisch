import {
  type Action,
  type Card,
  type Contract,
  type PlayerView,
  type Rules,
  augenOf,
  availableContracts,
  contractLevel,
  effSuit,
  firstDealSize,
  isTrump,
  rankOf,
  suitOf,
  trickWinnerIndex,
  trumpOrder,
} from '../engine';

/**
 * Einfacher Computer-Mitspieler. Er bekommt nur die Sicht eines Spielers (PlayerView),
 * kann also nicht schummeln. Ziel ist ein regelkonformer, halbwegs vernünftiger Mitspieler
 * zum Testen – kein Profi.
 */

/** Grobe Stärke einer Hand für ein bestimmtes Spiel. */
function handStrength(hand: Card[], c: Contract): { trumps: number; score: number } {
  const order = trumpOrder(c);
  let trumps = 0;
  let score = 0;
  for (const card of hand) {
    const ti = order.indexOf(card);
    if (ti >= 0) {
      trumps++;
      const r = rankOf(card);
      score += r === 'O' ? 3 : r === 'U' ? (c.kind === 'wenz' || c.kind === 'farbwenz' ? 3 : 2) : r === 'A' || r === '10' ? 1.5 : 1;
      if (ti < 2) score += 1; // die beiden höchsten Trümpfe extra
    } else if (rankOf(card) === 'A') {
      score += 1.5;
    } else if (rankOf(card) === '10' && hand.includes(`${suitOf(card)}A` as Card)) {
      score += 0.75;
    }
  }
  return { trumps, score };
}

/** Bewertet ein Spiel; null = zu schwach. Höher ist besser. */
function rate(hand: Card[], c: Contract): number | null {
  const scale = hand.length / 8;
  const { trumps, score } = handStrength(hand, c);
  if (c.kind === 'sauspiel') {
    return trumps >= 4 * scale && score >= 9 * scale ? score : null;
  }
  if (c.kind === 'wenz' || c.kind === 'geier') {
    const aces = hand.filter((x) => rankOf(x) === 'A').length;
    return trumps >= 2 && aces >= 2 && score >= 12 * scale ? score + 3 : null;
  }
  // Farbsolo, Farbwenz, Farbgeier
  return trumps >= 6 * scale && score >= 14 * scale ? score + 4 : null;
}

function bestContract(hand: Card[], options: Contract[], mustPlay: boolean): Contract | null {
  let best: Contract | null = null;
  let bestScore = -Infinity;
  for (const c of options) {
    const r = rate(hand, c);
    const s = r ?? (mustPlay ? handStrength(hand, c).score - (c.kind === 'sauspiel' ? 0 : 3) : null);
    if (s !== null && s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

function teamOf(v: PlayerView): { mates: Set<number>; enemies: Set<number> } {
  const me = v.seat;
  const mates = new Set<number>([me]);
  const enemies = new Set<number>();
  if (!v.contract || v.contract.kind === 'ramsch' || v.declarer === null) {
    for (let p = 0; p < 4; p++) if (p !== me) enemies.add(p);
    return { mates, enemies };
  }
  const declTeam = new Set<number>([v.declarer]);
  if (v.partner !== null) declTeam.add(v.partner);
  const iAmDecl = declTeam.has(me);
  for (let p = 0; p < 4; p++) {
    if (p === me) continue;
    if (declTeam.has(p)) (iAmDecl ? mates : enemies).add(p);
    else if (iAmDecl || v.partner !== null || v.contract.kind !== 'sauspiel') (iAmDecl ? enemies : mates).add(p);
    // Partner unbekannt und ich bin Gegenspieler: die anderen sind unklar → weder noch.
  }
  return { mates, enemies };
}

const value = (c: Card) => augenOf(c);

function choosePlay(v: PlayerView): Card {
  const legal = v.allowed.play;
  const c = v.contract!;
  const trick = v.trick!;
  const lowest = (cards: Card[]) =>
    [...cards].sort((a, b) => value(a) - value(b) || trumpRankOf(a) - trumpRankOf(b))[0];
  const highestValue = (cards: Card[]) => [...cards].sort((a, b) => value(b) - value(a))[0];
  const order = trumpOrder(c);
  // kleiner Index = höherer Trumpf; Nicht-Trümpfe bekommen einen hohen Wert
  function trumpRankOf(card: Card) {
    const i = order.indexOf(card);
    return i >= 0 ? -100 + (order.length - i) : 0;
  }

  if (c.kind === 'ramsch') {
    // Möglichst keine Stiche mit Augen: niedrigste Karte, die nicht sticht – sonst die billigste.
    if (trick.cards.length > 0) {
      const losing = legal.filter((x) => !wins(trick.cards, x, c));
      if (losing.length) return highestValue(losing);
    }
    return lowest(legal);
  }

  const { mates, enemies } = teamOf(v);
  const iAmDeclTeam = v.declarer !== null && mates.has(v.declarer);

  if (trick.cards.length === 0) {
    const trumps = legal.filter((x) => isTrump(x, c));
    if (iAmDeclTeam && trumps.length > 0) {
      // Spielpartei zieht Trumpf: höchsten Trumpf vorspielen
      return trumps.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
    }
    const aces = legal.filter((x) => !isTrump(x, c) && rankOf(x) === 'A');
    if (aces.length) return aces[0];
    // Gegenspieler im Sauspiel: Ruffarbe anspielen, um den Partner zu finden
    if (c.kind === 'sauspiel' && !iAmDeclTeam) {
      const called = legal.filter((x) => effSuit(x, c) === c.suit);
      if (called.length) return lowest(called);
    }
    const nonTrump = legal.filter((x) => !isTrump(x, c));
    return lowest(nonTrump.length ? nonTrump : legal);
  }

  const winnerIdx = trickWinnerIndex(trick.cards, c);
  const winnerSeat = (trick.leader + winnerIdx) % 4;
  const isLast = trick.cards.length === 3;
  const mateWinning = mates.has(winnerSeat);

  if (mateWinning && (isLast || !enemies.size || winnerIsStrong(trick.cards[winnerIdx], c))) {
    // Schmieren: Augen zum Partner, aber keine hohen Trümpfe verschwenden
    const nonTrump = legal.filter((x) => !isTrump(x, c));
    return highestValue(nonTrump.length ? nonTrump : [lowest(legal)]);
  }

  const winning = legal.filter((x) => wins(trick.cards, x, c));
  const pointsOnTable = trick.cards.reduce((s, x) => s + value(x), 0);
  if (winning.length && (pointsOnTable >= 10 || isLast || iAmDeclTeam)) {
    // billigste Karte, die den Stich holt
    return winning.sort((a, b) => trumpRankOf(b) - trumpRankOf(a) || value(a) - value(b))[0];
  }
  return lowest(legal);
}

function wins(cards: Card[], card: Card, c: Contract): boolean {
  const all = [...cards, card];
  return trickWinnerIndex(all, c) === all.length - 1;
}

function winnerIsStrong(card: Card, c: Contract): boolean {
  const order = trumpOrder(c);
  const i = order.indexOf(card);
  return (i >= 0 && i < 4) || (!isTrump(card, c) && rankOf(card) === 'A');
}

/** Entscheidet, was der Bot jetzt tut (oder null, wenn er nicht dran ist). */
export function botDecide(v: PlayerView, rules: Rules): Action | null {
  const a = v.allowed;
  const hand = v.hand;

  if (a.legen) {
    const firstCards = hand.slice(0, firstDealSize(rules.deck));
    const strong = firstCards.filter((x) => rankOf(x) === 'O' || rankOf(x) === 'U').length >= 3;
    return { type: 'legen', yes: strong };
  }

  if (a.bid) {
    const options = availableContracts(hand, rules);
    const mustPlay = !a.bid.weiter;
    const best = bestContract(hand, options, mustPlay);
    return { type: 'bid', play: a.bid.spiel && (mustPlay || best !== null) };
  }

  if (a.duel) {
    const solos = availableContracts(hand, rules).filter((c) => contractLevel(c) === 2);
    const soloWorthy = bestContract(hand, solos, false) !== null;
    if (a.duel.raise.length && soloWorthy) return { type: 'duel', choice: 'raise', level: a.duel.raise[0] };
    if (a.duel.hold && soloWorthy) return { type: 'duel', choice: 'hold' };
    return { type: 'duel', choice: 'pass' };
  }

  if (a.choose) {
    const best = bestContract(hand, a.choose, true) ?? a.choose[0];
    return { type: 'choose', contract: best };
  }

  if (a.play.length) return { type: 'play', card: choosePlay(v) };
  return null;
}

/** Notlösung, falls die Entscheidung einmal nicht klappt: irgendeine erlaubte Aktion. */
export function botFallback(v: PlayerView): Action | null {
  const a = v.allowed;
  if (a.legen) return { type: 'legen', yes: false };
  if (a.bid) return { type: 'bid', play: !a.bid.weiter };
  if (a.duel) return { type: 'duel', choice: 'pass' };
  if (a.choose?.length) return { type: 'choose', contract: a.choose[0] };
  if (a.play.length) return { type: 'play', card: a.play[0] };
  return null;
}
