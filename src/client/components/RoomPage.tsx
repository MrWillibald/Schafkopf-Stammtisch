import { useCallback, useEffect, useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import { call, saveRoom, socket, tokenFor } from '../socket';
import { navigate } from './App';
import { Lobby } from './Lobby';
import { Table } from './Table';

export function RoomPage({ roomId }: { roomId: string }) {
  const [view, setView] = useState<RoomView | null>(null);
  const [needName, setNeedName] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem('schafkopf:name') ?? '');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);

  const joinWithToken = useCallback(async () => {
    const token = tokenFor(roomId);
    if (!token) return setNeedName(true);
    const r = await call((ack) => socket.emit('room:join', { roomId, token }, ack));
    if (!r.ok) {
      // Token unbekannt (z. B. Runde neu angelegt) → neu beitreten
      if (/Namen/.test(r.error)) setNeedName(true);
      else setError(r.error);
    }
  }, [roomId]);

  useEffect(() => {
    const onState = (v: RoomView) => {
      if (v.id !== roomId) return;
      setView(v);
      const token = tokenFor(v.id);
      if (token) saveRoom({ id: v.id, name: v.name, token });
    };
    const onConnect = () => {
      setConnected(true);
      void joinWithToken();
    };
    const onDisconnect = () => setConnected(false);
    socket.on('room:state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) void joinWithToken();
    return () => {
      socket.off('room:state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomId, joinWithToken]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const r = await call<{ token: string }>((ack) => socket.emit('room:join', { roomId, playerName: name }, ack));
    if (!r.ok) return setError(r.error);
    try {
      localStorage.setItem('schafkopf:name', name.trim());
    } catch {
      /* egal */
    }
    saveRoom({ id: roomId, name: 'Schafkopf-Runde', token: r.token });
    setNeedName(false);
  }

  if (view) {
    return (
      <>
        {!connected && <div className="offline">Verbindung verloren – verbinde neu …</div>}
        {view.status === 'lobby' ? <Lobby view={view} /> : <Table view={view} />}
      </>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <h1>Schafkopf-Stammtisch</h1>
      </header>
      {needName ? (
        <form className="panel" onSubmit={join}>
          <h2>Mitspielen</h2>
          <p>Du wurdest zu einer Schafkopf-Runde eingeladen.</p>
          <label className="field">
            <span>Dein Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoFocus required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn--primary btn--big" disabled={!name.trim()}>
            Beitreten
          </button>
        </form>
      ) : (
        <section className="panel">
          {error ? (
            <>
              <p className="error">{error}</p>
              <button className="btn" onClick={() => navigate('/')}>
                Zur Startseite
              </button>
            </>
          ) : (
            <p>Verbinde …</p>
          )}
        </section>
      )}
    </main>
  );
}
