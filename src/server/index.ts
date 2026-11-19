import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type { Ack, ClientToServer, ServerToClient } from '../shared/protocol';
import { Room, RoomError } from './room';
import { FileStore } from './store';

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data/rooms');
const ROOM_MAX_AGE_DAYS = Number(process.env.ROOM_MAX_AGE_DAYS ?? 90);
const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = resolve(here, '../client');

interface SocketData {
  roomId?: string;
  token?: string;
}
type IO = Server<ClientToServer, ServerToClient, Record<string, never>, SocketData>;
type ClientSocket = Socket<ClientToServer, ServerToClient, Record<string, never>, SocketData>;

const rooms = new Map<string, Room>();
const store = new FileStore(DATA_DIR);
/** Anzahl offener Verbindungen je Spieler-Token. */
const online = new Map<string, number>();

const app = express();
app.disable('x-powered-by');
app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});
if (existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR, { index: false, maxAge: '1h' }));
  // Alle anderen Pfade (z. B. /r/abc123) liefern die App aus.
  app.use((_req, res) => res.sendFile(join(CLIENT_DIR, 'index.html')));
}

const httpServer = createServer(app);
const io: IO = new Server(httpServer, { maxHttpBufferSize: 64 * 1024 });

/** Ein Timer pro Runde für den nächsten Zug eines Computer-Mitspielers. */
const botTimers = new Map<string, NodeJS.Timeout>();

function scheduleBots(room: Room) {
  const id = room.data.id;
  if (botTimers.has(id) || !room.botMove()) return;
  const h = room.data.hand!;
  // Nach einem fertigen Stich etwas länger warten, damit man ihn sieht.
  const trickJustDone = h.phase === 'play' && h.trick?.cards.length === 0 && h.tricks.length > 0;
  const delay = trickJustDone ? 1900 : h.phase === 'play' ? 900 : 700;
  botTimers.set(
    id,
    setTimeout(() => {
      botTimers.delete(id);
      try {
        room.runBot();
      } catch (e) {
        console.error('Bot hängt:', e);
        return;
      }
      broadcast(room);
    }, delay),
  );
}

function broadcast(room: Room) {
  store.save(room.data);
  scheduleBots(room);
  const ids = io.sockets.adapter.rooms.get(room.data.id);
  if (!ids) return;
  const isOnline = (t: string) => (online.get(t) ?? 0) > 0;
  for (const id of ids) {
    const s = io.sockets.sockets.get(id) as ClientSocket | undefined;
    if (s?.data.token) s.emit('room:state', room.view(s.data.token, isOnline));
  }
}

function attach(socket: ClientSocket, room: Room, token: string) {
  if (socket.data.token) detach(socket);
  socket.data = { roomId: room.data.id, token };
  online.set(token, (online.get(token) ?? 0) + 1);
  void socket.join(room.data.id);
}

function detach(socket: ClientSocket) {
  const { token, roomId } = socket.data;
  if (!token) return;
  online.set(token, Math.max(0, (online.get(token) ?? 1) - 1));
  socket.data = {};
  if (roomId) {
    void socket.leave(roomId);
    const room = rooms.get(roomId);
    if (room) broadcast(room);
  }
}

/** Führt einen Handler aus und übersetzt Fehler in eine Antwort an den Client. */
function handle<T extends object>(ack: unknown, fn: () => Ack<T> | void) {
  const reply = typeof ack === 'function' ? (ack as (r: Ack<T> | Ack) => void) : () => {};
  try {
    reply(fn() ?? { ok: true });
  } catch (e) {
    if (!(e instanceof RoomError)) console.error(e);
    reply({ ok: false, error: e instanceof RoomError ? e.message : 'Unerwarteter Fehler.' });
  }
}

function currentRoom(socket: ClientSocket): [Room, string] {
  const { roomId, token } = socket.data;
  const room = roomId ? rooms.get(roomId) : undefined;
  if (!room || !token) throw new RoomError('Du bist in keiner Runde.');
  return [room, token];
}

io.on('connection', (socket: ClientSocket) => {
  socket.on('room:create', (p, ack) =>
    handle(ack, () => {
      const room = Room.create(p?.roomName, p?.rules);
      const player = room.join(undefined, p?.playerName);
      rooms.set(room.data.id, room);
      attach(socket, room, player.token);
      broadcast(room);
      return { ok: true, roomId: room.data.id, token: player.token };
    }),
  );

  socket.on('room:join', (p, ack) =>
    handle(ack, () => {
      const room = rooms.get(String(p?.roomId ?? ''));
      if (!room) throw new RoomError('Diese Runde gibt es nicht (mehr).');
      const player = room.join(p?.token, p?.playerName);
      attach(socket, room, player.token);
      broadcast(room);
      return { ok: true, token: player.token };
    }),
  );

  socket.on('room:rules', (rules, ack) =>
    handle(ack, () => {
      const [room, token] = currentRoom(socket);
      room.setRules(token, rules);
      broadcast(room);
    }),
  );

  socket.on('room:addBot', (ack) =>
    handle(ack, () => {
      const [room, token] = currentRoom(socket);
      room.addBot(token);
      broadcast(room);
    }),
  );

  socket.on('room:removeBot', (seat, ack) =>
    handle(ack, () => {
      const [room, token] = currentRoom(socket);
      room.removeBot(token, Number(seat));
      broadcast(room);
    }),
  );

  socket.on('game:start', (ack) =>
    handle(ack, () => {
      const [room, token] = currentRoom(socket);
      room.start(token);
      broadcast(room);
    }),
  );

  socket.on('game:action', (action, ack) =>
    handle(ack, () => {
      const [room, token] = currentRoom(socket);
      room.act(token, action);
      broadcast(room);
    }),
  );

  socket.on('game:ready', (ack) =>
    handle(ack, () => {
      const [room, token] = currentRoom(socket);
      room.ready(token);
      broadcast(room);
    }),
  );

  socket.on('disconnect', () => detach(socket));
});

async function main() {
  await store.init();
  for (const data of await store.loadAll(ROOM_MAX_AGE_DAYS)) {
    const room = new Room(data);
    rooms.set(data.id, room);
    scheduleBots(room); // falls beim Neustart gerade ein Computer dran war
  }
  httpServer.listen(PORT, () => {
    console.log(`Schafkopf-Stammtisch läuft auf http://localhost:${PORT} (${rooms.size} Runden geladen)`);
  });
}

async function shutdown() {
  await store.flush([...rooms.values()].map((r) => r.data));
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

void main();
