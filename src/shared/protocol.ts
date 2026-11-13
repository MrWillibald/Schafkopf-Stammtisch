import type { Action, Card, HandResult, PlayerView, Rules } from '../engine';

export interface PlayerInfo {
  seat: number;
  name: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
}

export interface HistoryEntry {
  no: number;
  dealer: number;
  at: string;
  result: HandResult;
  /** Kontostand je Sitz nach diesem Spiel (Cent). */
  balance: number[];
}

/** Ruhmeshalle: jede "Sie" wird verewigt. */
export interface SieEntry {
  name: string;
  at: string;
  cards: Card[];
}

export interface RoomView {
  id: string;
  name: string;
  rules: Rules;
  status: 'lobby' | 'playing';
  you: { seat: number; isHost: boolean };
  players: PlayerInfo[];
  handNo: number;
  hand: PlayerView | null;
  history: HistoryEntry[];
  balance: number[];
  sie: SieEntry[];
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface ClientToServer {
  'room:create': (
    p: { roomName: string; playerName: string; rules: Rules },
    ack: (r: Ack<{ roomId: string; token: string }>) => void,
  ) => void;
  'room:join': (p: { roomId: string; token?: string; playerName?: string }, ack: (r: Ack<{ token: string }>) => void) => void;
  'room:rules': (rules: Rules, ack: (r: Ack) => void) => void;
  'game:start': (ack: (r: Ack) => void) => void;
  'game:action': (action: Action, ack: (r: Ack) => void) => void;
  'game:ready': (ack: (r: Ack) => void) => void;
}

export interface ServerToClient {
  'room:state': (view: RoomView) => void;
}
