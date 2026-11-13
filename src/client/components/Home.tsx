import { useState } from 'react';
import { DEFAULT_RULES, type Rules } from '../../engine';
import { call, forgetRoom, saveRoom, savedRooms, socket } from '../socket';
import { navigate } from './App';
import { RulesForm } from './RulesForm';

export function Home() {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('schafkopf:name') ?? '');
  const [roomName, setRoomName] = useState('Stammtisch');
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState(savedRooms);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      localStorage.setItem('schafkopf:name', playerName.trim());
    } catch {
      /* egal */
    }
    const r = await call<{ roomId: string; token: string }>((ack) =>
      socket.emit('room:create', { roomName, playerName, rules }, ack),
    );
    setBusy(false);
    if (!r.ok) return setError(r.error);
    saveRoom({ id: r.roomId, name: roomName, token: r.token });
    navigate(`/r/${r.roomId}`);
  }

  return (
    <main className="page">
      <header className="hero">
        <h1>Schafkopf-Stammtisch</h1>
        <p>Eure private Runde – einfach Link teilen und mitspielen.</p>
      </header>

      {rooms.length > 0 && (
        <section className="panel">
          <h2>Deine Runden</h2>
          <ul className="room-list">
            {rooms.map((r) => (
              <li key={r.id}>
                <a href={`/r/${r.id}`} onClick={(e) => (e.preventDefault(), navigate(`/r/${r.id}`))}>
                  {r.name}
                </a>
                <button
                  className="link"
                  type="button"
                  onClick={() => {
                    forgetRoom(r.id);
                    setRooms(savedRooms());
                  }}
                >
                  entfernen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="panel" onSubmit={create}>
        <h2>Neue Runde anlegen</h2>
        <label className="field">
          <span>Dein Name</span>
          <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength={24} required placeholder="z. B. Sepp" />
        </label>
        <label className="field">
          <span>Name der Runde</span>
          <input value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={24} />
        </label>
        <RulesForm rules={rules} onChange={setRules} />
        {error && <p className="error">{error}</p>}
        <button className="btn btn--primary btn--big" disabled={busy || !playerName.trim()}>
          Runde anlegen
        </button>
      </form>
    </main>
  );
}
