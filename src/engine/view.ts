import type { Card } from './cards';
import type { Contract, Level } from './contract';
import {
  type AllowedActions,
  type HandState,
  type LogEntry,
  type Phase,
  type Trick,
  allowedActions,
  multiplier,
} from './hand';
import type { HandResult } from './scoring';

/** Was ein Spieler vom laufenden Spiel sehen darf. */
export interface PlayerView {
  seat: number;
  dealer: number;
  phase: Phase;
  turn: number | null;
  hand: Card[];
  handCounts: number[];
  legen: (boolean | null)[];
  bids: ('weiter' | 'spiel' | null)[];
  duel: { leader: number; challenger: number; level: Level; awaiting: 'challenger' | 'leader' } | null;
  minLevel: Level;
  declarer: number | null;
  contract: Contract | null;
  /** Partner, sofern für diesen Spieler bekannt. */
  partner: number | null;
  kontra: number | null;
  re: number | null;
  multiplier: number;
  trick: Trick | null;
  lastTrick: Trick | null;
  tricksPlayed: number;
  tricksWon: number[];
  result: HandResult | null;
  allowed: AllowedActions;
  log: LogEntry[];
}

export function viewFor(s: HandState, seat: number): PlayerView {
  const tricksWon = [0, 0, 0, 0];
  for (const t of s.tricks) tricksWon[t.winner!]++;
  const knowsPartner = s.partnerKnown || s.partner === seat;
  return {
    seat,
    dealer: s.dealer,
    phase: s.phase,
    turn: s.turn,
    hand: [...s.hands[seat]],
    handCounts: s.hands.map((h) => h.length),
    legen: [...s.legen],
    bids: [...s.bids],
    duel: s.duel
      ? { leader: s.duel.leader, challenger: s.duel.challenger, level: s.duel.level, awaiting: s.duel.awaiting }
      : null,
    minLevel: s.minLevel,
    declarer: s.declarer,
    contract: s.contract,
    partner: knowsPartner ? s.partner : null,
    kontra: s.kontra,
    re: s.re,
    multiplier: multiplier(s),
    trick: s.trick,
    lastTrick: s.tricks.length ? s.tricks[s.tricks.length - 1] : null,
    tricksPlayed: s.tricks.length,
    tricksWon,
    result: s.result,
    allowed: allowedActions(s, seat),
    log: s.log.slice(-30),
  };
}
