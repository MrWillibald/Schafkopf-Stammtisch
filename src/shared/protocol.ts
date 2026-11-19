import type { Action, Card, HandResult, PlayerView, Rules } from '../engine';

export interface PlayerInfo {
  seat: number;
  name: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
}

export interface HistoryEntry {
  no: number;
  dealer: number;
  at: string;
  result: HandResult;
  /** Kontostand je Sitz nach diesem Spiel (Cent). */
  balance: number[];
  /** Stock nach diesem Spiel (Cent). */
  stock?: number;
}

/** Ruhmeshalle: jede "Sie" wird verewigt. */
export interface SieEntry {
  name: string;
  /** Platz am Tisch – damit die Sie beim Umbenennen beim richtigen Spieler bleibt. */
  seat?: number;
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
  /** Betrag im Stock (Cent). */
  stock: number;
  /** Verdopplungen aus Zusammenwerfen, die für das nächste Spiel anstehen. */
  pendingDoubles: number;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface ClientToServer {
  'room:create': (
    p: { roomName: string; playerName: string; rules: Rules },
    ack: (r: Ack<{ roomId: string; token: string }>) => void,
  ) => void;
  'room:join': (p: { roomId: string; token?: string; playerName?: string }, ack: (r: Ack<{ token: string }>) => void) => void;
  'room:rules': (rules: Rules, ack: (r: Ack) => void) => void;
  'room:addBot': (ack: (r: Ack) => void) => void;
  'room:removeBot': (seat: number, ack: (r: Ack) => void) => void;
  /** Eigenen Namen ändern – oder (nur Gastgeber) den eines Computer-Mitspielers über `seat`. */
  'room:rename': (p: { name: string; seat?: number }, ack: (r: Ack) => void) => void;
  'game:start': (ack: (r: Ack) => void) => void;
  'game:action': (action: Action, ack: (r: Ack) => void) => void;
  'game:ready': (ack: (r: Ack) => void) => void;
}

export interface ServerToClient {
  'room:state': (view: RoomView) => void;
}
