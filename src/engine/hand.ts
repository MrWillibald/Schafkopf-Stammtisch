import {
  type Card,
  type Rng,
  type Suit,
  firstDealSize,
  makeCard,
  makeDeck,
  rankOf,
  shuffle,
} from './cards';
import {
  type Contract,
  type Level,
  availableContracts,
  canAnnounceTout,
  contractLevel,
  contractName,
  effSuit,
  maxLevel,
  sameContract,
  trickWinnerIndex,
} from './contract';
import { preMultiplier, totalMultiplier } from './multiplier';
import { MAX_LEGEN_MULTIPLIER, MAX_MULTIPLIER, type Rules } from './rules';
import { type HandResult, scoreHand } from './scoring';

export const PLAYERS = 4;
export const next = (seat: number, by = 1): number => (seat + by) % PLAYERS;

export type Phase = 'legen' | 'bid' | 'duel' | 'choose' | 'play' | 'done';

export interface Trick {
  /** Wer ausgespielt hat. Karte i gehört Sitz (leader + i) % 4. */
  leader: number;
  cards: Card[];
  winner?: number;
}

/**
 * Reizen, wenn mehrere spielen wollen: Der Vordere (leader) hält das Spiel auf `level`.
 * Ein Hinterer (challenger) muss eine höhere Stufe bieten; der Vordere darf halten.
 */
export interface DuelState {
  leader: number;
  level: Level;
  challenger: number;
  queue: number[];
  awaiting: 'challenger' | 'leader';
}

export interface LogEntry {
  seat: number | null;
  text: string;
}

export interface HandState {
  rules: Rules;
  dealer: number;
  phase: Phase;
  /** Wer gerade am Zug ist (null, wenn niemand). */
  turn: number | null;
  hands: Card[][];
  /** Zweiter Teil des Austeilens (nach dem Legen). */
  pending: Card[][];
  /** Vollständige Hände nach dem Austeilen. */
  initialHands: Card[][];
  legen: (boolean | null)[];
  bids: ('weiter' | 'spiel' | null)[];
  duel: DuelState | null;
  /** Mindeststufe, die der Spieler nach dem Reizen spielen muss. */
  minLevel: Level;
  declarer: number | null;
  contract: Contract | null;
  partner: number | null;
  /** Ist der Partner (durch Zugeben der Rufsau) öffentlich bekannt? */
  partnerKnown: boolean;
  /** Zusätzliche Verdopplungen aus vorherigem Zusammenwerfen (zählen nicht zum 16-fach-Deckel). */
  bock: number;
  /** Betrag im Stock zu Beginn dieses Spiels (Cent). */
  stock: number;
  kontra: number | null;
  re: number | null;
  trick: Trick | null;
  tricks: Trick[];
  /** Wurde die gerufene Farbe schon angespielt? Danach ist die Rufsau frei. */
  calledSuitLed: boolean;
  result: HandResult | null;
  log: LogEntry[];
}

export type Action =
  | { type: 'legen'; yes: boolean }
  | { type: 'bid'; play: boolean }
  | { type: 'duel'; choice: 'raise'; level: Level }
  | { type: 'duel'; choice: 'hold' | 'pass' }
  | { type: 'choose'; contract: Contract }
  | { type: 'kontra' }
  | { type: 're' }
  | { type: 'play'; card: Card };

export class RuleError extends Error {}

const fail = (msg: string): never => {
  throw new RuleError(msg);
};

export const vorhand = (s: Pick<HandState, 'dealer'>): number => next(s.dealer);

export interface HandOptions {
  /** Verdopplungen aus vorherigem Zusammenwerfen. */
  bock?: number;
  /** Aktueller Stock in Cent. */
  stock?: number;
}

export function newHand(rules: Rules, dealer: number, rng: Rng = Math.random, opts: HandOptions = {}): HandState {
  const deck = shuffle(makeDeck(rules.deck), rng);
  const per = deck.length / PLAYERS;
  const first = firstDealSize(rules.deck);
  const hands: Card[][] = [];
  const pending: Card[][] = [];
  for (let p = 0; p < PLAYERS; p++) {
    const mine = deck.slice(p * per, (p + 1) * per);
    hands.push(mine.slice(0, first));
    pending.push(mine.slice(first));
  }
  const s: HandState = {
    rules,
    dealer,
    phase: 'legen',
    turn: next(dealer),
    hands,
    pending,
    initialHands: [],
    legen: [null, null, null, null],
    bids: [null, null, null, null],
    duel: null,
    minLevel: 1,
    declarer: null,
    contract: null,
    partner: null,
    partnerKnown: false,
    bock: opts.bock ?? 0,
    stock: opts.stock ?? 0,
    kontra: null,
    re: null,
    trick: null,
    tricks: [],
    calledSuitLed: false,
    result: null,
    log: [],
  };
  // Steht durch Zusammenwerfen schon 8-fach an, bringt Legen nichts mehr.
  if (preMultiplier(s) >= MAX_LEGEN_MULTIPLIER) {
    s.legen = [false, false, false, false];
    finishDeal(s);
  }
  return s;
}

/** Testhilfe: Hand mit vorgegebenen Karten (je 8 bzw. 6) erzeugen. */
export function handFromCards(rules: Rules, dealer: number, cards: Card[][]): HandState {
  const s = newHand(rules, dealer, () => 0);
  const first = firstDealSize(rules.deck);
  s.hands = cards.map((h) => h.slice(0, first));
  s.pending = cards.map((h) => h.slice(first));
  return s;
}

export const legenCount = (s: HandState): number => s.legen.filter((x) => x === true).length;

/** Gesamtfaktor: Legen + Zusammenwerfen höchstens 8-fach, mit Kontra/Re höchstens 16-fach. */
export function multiplier(s: HandState): number {
  return totalMultiplier(s);
}

/** Sitze der Spielpartei (Spieler + ggf. Partner). */
export function declarerTeam(s: HandState): number[] {
  if (s.declarer === null) return [];
  return s.partner !== null ? [s.declarer, s.partner] : [s.declarer];
}

const calledAce = (s: HandState): Card | null =>
  s.contract?.kind === 'sauspiel' && s.contract.suit ? makeCard(s.contract.suit, 'A') : null;

const davonlaufenMin = (s: HandState): number => (s.rules.deck === 'long' ? 4 : 3);

/** Welche Karten darf `seat` jetzt spielen? */
export function legalCards(s: HandState, seat: number): Card[] {
  if (s.phase !== 'play' || s.turn !== seat || !s.trick || !s.contract) return [];
  const c = s.contract;
  const hand = s.hands[seat];
  const ace = calledAce(s);
  const holdsAce = ace !== null && hand.includes(ace) && !s.calledSuitLed;
  const calledSuit = c.suit as Suit;
  const lastTrick = hand.length === 1;

  if (s.trick.cards.length === 0) {
    // Ausspielen
    if (holdsAce) {
      const suitCards = hand.filter((x) => effSuit(x, c) === calledSuit);
      if (suitCards.length < davonlaufenMin(s)) {
        // Kein Davonlaufen: gerufene Farbe nur mit der Sau anspielen.
        return hand.filter((x) => effSuit(x, c) !== calledSuit || x === ace);
      }
    }
    return [...hand];
  }

  const led = effSuit(s.trick.cards[0], c);
  const follow = hand.filter((x) => effSuit(x, c) === led);
  if (follow.length > 0) {
    if (holdsAce && led === calledSuit) return [ace!];
    return follow;
  }
  // Nicht bedienen können: frei abwerfen – aber die Rufsau darf nicht geschmiert werden.
  if (holdsAce && !lastTrick) {
    const rest = hand.filter((x) => x !== ace);
    if (rest.length > 0) return rest;
  }
  return [...hand];
}

export interface AllowedActions {
  legen: boolean;
  bid: { spiel: boolean; weiter: boolean } | null;
  duel: { raise: Level[]; hold: boolean; pass: boolean } | null;
  choose: Contract[] | null;
  kontra: boolean;
  re: boolean;
  play: Card[];
}

function canKontraOrRe(s: HandState): boolean {
  return (
    s.phase === 'play' &&
    s.contract !== null &&
    s.contract.kind !== 'ramsch' &&
    s.tricks.length === 0 &&
    multiplier(s) < MAX_MULTIPLIER
  );
}

/** Hat `seat` in diesem Spiel schon eine Karte gespielt? */
export function hasPlayedCard(s: HandState, seat: number): boolean {
  if (s.tricks.length > 0) return true;
  if (!s.trick) return false;
  return (seat - s.trick.leader + PLAYERS) % PLAYERS < s.trick.cards.length;
}

export function allowedActions(s: HandState, seat: number): AllowedActions {
  const myTurn = s.turn === seat;
  const out: AllowedActions = { legen: false, bid: null, duel: null, choose: null, kontra: false, re: false, play: [] };
  const hand = s.hands[seat];
  if (s.phase === 'legen' && myTurn) out.legen = true;
  if (s.phase === 'bid' && myTurn) {
    const canPlay = availableContracts(hand, s.rules).length > 0;
    out.bid = { spiel: canPlay, weiter: !(s.legen[seat] && canPlay) };
  }
  if (s.phase === 'duel' && myTurn && s.duel) {
    const ml = maxLevel(hand, s.rules);
    if (s.duel.awaiting === 'challenger') {
      const raise: Level[] = ([2] as Level[]).filter((l) => l > s.duel!.level && l <= ml);
      out.duel = { raise, hold: false, pass: true };
    } else {
      out.duel = { raise: [], hold: ml >= s.duel.level, pass: true };
    }
  }
  if (s.phase === 'choose' && myTurn) {
    out.choose = availableContracts(hand, s.rules).filter((c) => contractLevel(c) >= s.minLevel);
  }
  if (canKontraOrRe(s)) {
    const team = declarerTeam(s);
    // Kontra und Re nur, solange man selbst noch keine Karte gespielt hat.
    const fresh = !hasPlayedCard(s, seat);
    out.kontra = fresh && s.kontra === null && !team.includes(seat);
    out.re = fresh && s.kontra !== null && s.re === null && team.includes(seat);
  }
  out.play = legalCards(s, seat);
  return out;
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

export function applyAction(state: HandState, seat: number, action: Action): HandState {
  const s: HandState = structuredClone(state);
  switch (action.type) {
    case 'legen':
      doLegen(s, seat, action.yes);
      break;
    case 'bid':
      doBid(s, seat, action.play);
      break;
    case 'duel':
      doDuel(s, seat, action);
      break;
    case 'choose':
      doChoose(s, seat, action.contract);
      break;
    case 'kontra':
    case 're':
      doDouble(s, seat, action.type);
      break;
    case 'play':
      doPlay(s, seat, action.card);
      break;
    default:
      fail('Unbekannte Aktion');
  }
  return s;
}

function requireTurn(s: HandState, seat: number, phase: Phase) {
  if (s.phase !== phase) fail('Das geht gerade nicht.');
  if (s.turn !== seat) fail('Du bist nicht dran.');
}

function doLegen(s: HandState, seat: number, yes: boolean) {
  requireTurn(s, seat, 'legen');
  s.legen[seat] = yes;
  if (yes) s.log.push({ seat, text: 'legt' });
  // Legen und Zusammenwerfen zusammen höchstens 8-fach: dann wird niemand mehr gefragt.
  if (preMultiplier(s) >= MAX_LEGEN_MULTIPLIER) for (let p = 0; p < PLAYERS; p++) if (s.legen[p] === null) s.legen[p] = false;
  const n = next(seat);
  if (n !== vorhand(s) && s.legen[n] === null) {
    s.turn = n;
    return;
  }
  finishDeal(s);
}

function finishDeal(s: HandState) {
  for (let p = 0; p < PLAYERS; p++) {
    s.hands[p] = [...s.hands[p], ...s.pending[p]];
    s.pending[p] = [];
  }
  s.initialHands = s.hands.map((h) => [...h]);
  // "Sie": alle Ober und Unter in einer Hand (nur langes Blatt) – Prestige, wird nicht gespielt.
  if (s.rules.deck === 'long') {
    const sie = s.hands.findIndex((h) => h.filter((c) => rankOf(c) === 'O' || rankOf(c) === 'U').length === 8);
    if (sie >= 0) {
      s.log.push({ seat: sie, text: 'hat eine SIE!' });
      s.phase = 'done';
      s.turn = null;
      s.result = scoreHand(s, { sie });
      return;
    }
  }
  s.phase = 'bid';
  s.turn = vorhand(s);
}

function doBid(s: HandState, seat: number, play: boolean) {
  requireTurn(s, seat, 'bid');
  const canPlay = availableContracts(s.hands[seat], s.rules).length > 0;
  if (play && !canPlay) fail('Mit dieser Hand kannst du kein erlaubtes Spiel ansagen.');
  if (!play && s.legen[seat] && canPlay) fail('Wer gelegt hat, muss spielen.');
  s.bids[seat] = play ? 'spiel' : 'weiter';
  s.log.push({ seat, text: play ? 'ich spiel' : 'weiter' });
  const n = next(seat);
  if (n !== vorhand(s)) {
    s.turn = n;
    return;
  }
  const wants: number[] = [];
  for (let i = 0; i < PLAYERS; i++) {
    const p = next(vorhand(s), i);
    if (s.bids[p] === 'spiel') wants.push(p);
  }
  if (wants.length === 0) {
    if (s.rules.allPass === 'ramsch') {
      s.contract = { kind: 'ramsch' };
      s.log.push({ seat: null, text: 'Alle weiter – es wird geramscht.' });
      startPlay(s);
    } else {
      s.log.push({ seat: null, text: 'Alle weiter – zusammenwerfen.' });
      s.phase = 'done';
      s.turn = null;
      s.result = scoreHand(s, { redeal: true });
    }
    return;
  }
  if (wants.length === 1) {
    s.declarer = wants[0];
    s.minLevel = 1;
    s.phase = 'choose';
    s.turn = wants[0];
    return;
  }
  const [leader, challenger, ...queue] = wants;
  s.duel = { leader, level: 1, challenger, queue, awaiting: 'challenger' };
  s.phase = 'duel';
  s.turn = challenger;
}

function doDuel(s: HandState, seat: number, action: Extract<Action, { type: 'duel' }>) {
  requireTurn(s, seat, 'duel');
  const d = s.duel!;
  const ml = maxLevel(s.hands[seat], s.rules);
  if (d.awaiting === 'challenger') {
    if (action.choice === 'raise') {
      if (action.level <= d.level || action.level > ml) fail('Dieses Gebot ist nicht möglich.');
      d.level = action.level;
      d.awaiting = 'leader';
      s.turn = d.leader;
      s.log.push({ seat, text: 'hat ein Solo' });
      return;
    }
    if (action.choice !== 'pass') fail('Dieses Gebot ist nicht möglich.');
    s.log.push({ seat, text: 'weiter' });
    nextChallenger(s);
    return;
  }
  // Der Vordere ist gefragt.
  if (action.choice === 'hold') {
    if (ml < d.level) fail('Du kannst nicht halten.');
    s.log.push({ seat, text: 'ich auch' });
    d.awaiting = 'challenger';
    s.turn = d.challenger;
    return;
  }
  if (action.choice !== 'pass') fail('Dieses Gebot ist nicht möglich.');
  s.log.push({ seat, text: 'weiter' });
  d.leader = d.challenger;
  nextChallenger(s);
}

function nextChallenger(s: HandState) {
  const d = s.duel!;
  const n = d.queue.shift();
  if (n === undefined) {
    s.declarer = d.leader;
    s.minLevel = d.level;
    s.duel = null;
    s.phase = 'choose';
    s.turn = s.declarer;
    return;
  }
  d.challenger = n;
  d.awaiting = 'challenger';
  s.turn = n;
}

function doChoose(s: HandState, seat: number, contract: Contract) {
  requireTurn(s, seat, 'choose');
  const options = allowedActions(s, seat).choose ?? [];
  const tout = contract?.tout === true;
  const chosen = options.find((c) => sameContract(c, { ...contract, tout: false }));
  if (!chosen) fail('Dieses Spiel kannst du nicht ansagen.');
  if (tout && !canAnnounceTout(chosen!)) fail('Tout kann nur zu einem Solo angesagt werden, nicht zum Sauspiel.');
  s.contract = tout ? { ...chosen!, tout: true } : { ...chosen! };
  s.log.push({ seat, text: `spielt ${contractName(s.contract)}` });
  if (chosen!.kind === 'sauspiel') {
    const ace = makeCard(chosen!.suit!, 'A');
    s.partner = s.hands.findIndex((h) => h.includes(ace));
  }
  startPlay(s);
}

function startPlay(s: HandState) {
  s.phase = 'play';
  s.turn = vorhand(s);
  s.trick = { leader: vorhand(s), cards: [] };
}

function doDouble(s: HandState, seat: number, kind: 'kontra' | 're') {
  const a = allowedActions(s, seat);
  if (kind === 'kontra') {
    if (!a.kontra) fail('Kontra ist jetzt nicht möglich.');
    s.kontra = seat;
    s.log.push({ seat, text: 'Kontra!' });
  } else {
    if (!a.re) fail('Re ist jetzt nicht möglich.');
    s.re = seat;
    s.log.push({ seat, text: 'Re!' });
  }
}

function doPlay(s: HandState, seat: number, card: Card) {
  requireTurn(s, seat, 'play');
  if (!legalCards(s, seat).includes(card)) fail('Diese Karte darfst du nicht spielen.');
  const c = s.contract!;
  const trick = s.trick!;
  s.hands[seat] = s.hands[seat].filter((x) => x !== card);
  if (card === calledAce(s)) s.partnerKnown = true;
  trick.cards.push(card);
  if (trick.cards.length < PLAYERS) {
    s.turn = next(seat);
    return;
  }
  // Erst nach dem Stich ist die Rufsau "frei" – im Such-Stich muss sie noch zugegeben werden.
  if (c.kind === 'sauspiel' && effSuit(trick.cards[0], c) === c.suit) s.calledSuitLed = true;
  trick.winner = next(trick.leader, trickWinnerIndex(trick.cards, c));
  s.tricks.push(trick);
  if (s.hands[0].length === 0) {
    s.trick = null;
    s.turn = null;
    s.phase = 'done';
    s.partnerKnown = true;
    s.result = scoreHand(s);
    return;
  }
  s.trick = { leader: trick.winner, cards: [] };
  s.turn = trick.winner;
}
