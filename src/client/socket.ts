import { type Socket, io } from 'socket.io-client';
import type { Ack, ClientToServer, ServerToClient } from '../shared/protocol';

export const socket: Socket<ServerToClient, ClientToServer> = io({ transports: ['websocket', 'polling'] });

/** Ruft ein Socket-Event auf und liefert die Antwort als Promise. */
export function call<T extends object = object>(fn: (ack: (r: Ack<T>) => void) => void): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'Keine Verbindung zum Server.' }), 8000);
    fn((r) => {
      clearTimeout(timer);
      resolve(r);
    });
  });
}

// ---- Gespeicherte Runden im Browser -------------------------------------------------

export interface SavedRoom {
  id: string;
  name: string;
  token: string;
}

const KEY = 'schafkopf:rooms';

export function savedRooms(): SavedRoom[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedRoom[];
  } catch {
    return [];
  }
}

export function saveRoom(room: SavedRoom) {
  try {
    const rest = savedRooms().filter((r) => r.id !== room.id);
    localStorage.setItem(KEY, JSON.stringify([room, ...rest].slice(0, 20)));
  } catch {
    /* privater Modus o. ä. – dann eben ohne Merken */
  }
}

export function forgetRoom(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(savedRooms().filter((r) => r.id !== id)));
  } catch {
    /* egal */
  }
}

export const tokenFor = (id: string): string | undefined => savedRooms().find((r) => r.id === id)?.token;
