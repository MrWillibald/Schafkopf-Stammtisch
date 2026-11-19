import { useEffect, useState } from 'react';
import { DEFAULT_RULES, type Rules } from '../../engine';
import type { RoomView } from '../../shared/protocol';
import { call, socket } from '../socket';
import { CardGallery } from './CardFace';
import { RulesForm } from './RulesForm';
import { Table } from './Table';

/** Testversion ohne Server: du gegen drei Computer-Mitspieler, alles im Browser. */
export function OfflineApp() {
  const [view, setView] = useState<RoomView | null>(null);
  const [name, setName] = useState('');
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [showCards, setShowCards] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    socket.on('room:state', setView);
    return () => {
      socket.off('room:state', setView);
    };
  }, []);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const steps = [
      () => call((ack) => socket.emit('room:create', { roomName: 'Testrunde', playerName: name, rules }, ack)),
      () => call((ack) => socket.emit('room:addBot', ack)),
      () => call((ack) => socket.emit('room:addBot', ack)),
      () => call((ack) => socket.emit('room:addBot', ack)),
      () => call((ack) => socket.emit('game:start', ack)),
    ];
    for (const step of steps) {
      const r = await step();
      if (!r.ok) return setError(r.error);
    }
  }

  if (view?.status === 'playing') return <Table view={view} />;
  if (showCards)
    return (
      <>
        <CardGallery />
        <div className="page">
          <button className="btn btn--big" onClick={() => setShowCards(false)}>Zurück</button>
        </div>
      </>
    );

  return (
    <main className="page">
      <header className="hero">
        <h1>Schafkopf-Stammtisch</h1>
        <p>Testversion: du gegen drei Computer-Mitspieler</p>
      </header>
      <form className="panel" onSubmit={start}>
        <label className="field">
          <span>Dein Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required placeholder="z. B. Sepp" />
        </label>
        <RulesForm rules={rules} onChange={setRules} />
        {error && <p className="error">{error}</p>}
        <button className="btn btn--primary btn--big" disabled={!name.trim()}>
          Spiel starten
        </button>
        <p className="hint">
          Alles läuft nur in deinem Browser – nichts wird gespeichert. Zum Spielen mit Freunden braucht es die
          veröffentlichte Version mit Einladungslink.
        </p>
      </form>
      <button className="btn btn--big" onClick={() => setShowCards(true)}>Kartenblatt ansehen</button>
    </main>
  );
}
