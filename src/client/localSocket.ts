import { Room, RoomError } from '../server/room';
import type { Ack } from '../shared/protocol';

/**
 * Ersatz für die Socket.io-Verbindung im Offline-Testmodus: Die komplette Runde
 * (inkl. Computer-Mitspielern) läuft im Browser. Gleiche Schnittstelle wie der Server.
 */
type Listener = (...args: any[]) => void;

export function createLocalSocket() {
  const listeners = new Map<string, Set<Listener>>();
  let room: Room | null = null;
  let token = '';
  let botTimer: ReturnType<typeof setTimeout> | null = null;

  const fire = (ev: string, ...args: unknown[]) => listeners.get(ev)?.forEach((fn) => fn(...args));

  function broadcast() {
    if (!room) return;
    const view = room.view(token, () => true);
    // asynchron wie beim echten Server
    setTimeout(() => fire('room:state', view), 0);
    scheduleBots();
  }

  function scheduleBots() {
    if (!room || botTimer || !room.botMove()) return;
    const h = room.data.hand!;
    const trickJustDone = h.phase === 'play' && h.trick?.cards.length === 0 && h.tricks.length > 0;
    const delay = trickJustDone ? 1900 : h.phase === 'play' ? 900 : 700;
    botTimer = setTimeout(() => {
      botTimer = null;
      try {
        room!.runBot();
      } catch (e) {
        console.error('Bot hängt:', e);
        return;
      }
      broadcast();
    }, delay);
  }

  function handle(ack: unknown, fn: () => Ack<object> | void) {
    const reply = typeof ack === 'function' ? (ack as (r: unknown) => void) : () => {};
    let result: unknown;
    try {
      result = fn() ?? { ok: true };
    } catch (e) {
      if (!(e instanceof RoomError)) console.error(e);
      result = { ok: false, error: e instanceof RoomError ? e.message : 'Unerwarteter Fehler.' };
    }
    setTimeout(() => reply(result), 0);
  }

  const handlers: Record<string, (args: any[], ack: unknown) => void> = {
    'room:create': ([p], ack) =>
      handle(ack, () => {
        room = Room.create(p?.roomName, p?.rules);
        token = room.join(undefined, p?.playerName).token;
        broadcast();
        return { ok: true, roomId: room.data.id, token };
      }),
    'room:addBot': (_a, ack) => handle(ack, () => (room!.addBot(token), broadcast())),
    'room:removeBot': ([seat], ack) => handle(ack, () => (room!.removeBot(token, Number(seat)), broadcast())),
    'room:rules': ([rules], ack) => handle(ack, () => (room!.setRules(token, rules), broadcast())),
    'game:start': (_a, ack) => handle(ack, () => (room!.start(token), broadcast())),
    'game:action': ([action], ack) => handle(ack, () => (room!.act(token, action), broadcast())),
    'game:ready': (_a, ack) => handle(ack, () => (room!.ready(token), broadcast())),
    'room:join': (_a, ack) => handle(ack, () => ({ ok: false, error: 'Im Testmodus gibt es nur eine Runde.' })),
  };

  return {
    connected: true,
    on(ev: string, fn: Listener) {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev)!.add(fn);
      return this;
    },
    off(ev: string, fn: Listener) {
      listeners.get(ev)?.delete(fn);
      return this;
    },
    emit(ev: string, ...args: unknown[]) {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
      handlers[ev]?.(args, ack);
      return this;
    },
  };
}
