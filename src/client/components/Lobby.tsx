import { useEffect, useState } from 'react';
import type { Rules } from '../../engine';
import type { RoomView } from '../../shared/protocol';
import { rulesSummary } from '../format';
import { call, socket } from '../socket';
import { navigate } from './App';
import { RulesForm } from './RulesForm';

export function Lobby({ view }: { view: RoomView }) {
  const link = `${window.location.origin}/r/${view.id}`;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rules, setRules] = useState<Rules>(view.rules);
  const [error, setError] = useState('');
  useEffect(() => setRules(view.rules), [view.rules]);

  async function copy() {
    try {
      if (navigator.share && /Mobi/.test(navigator.userAgent)) {
        await navigator.share({ title: 'Schafkopf-Runde', text: `Spiel mit in „${view.name}"!`, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* abgebrochen */
    }
  }

  async function saveRules() {
    const r = await call((ack) => socket.emit('room:rules', rules, ack));
    if (!r.ok) return setError(r.error);
    setEditing(false);
  }

  async function start() {
    const r = await call((ack) => socket.emit('game:start', ack));
    if (!r.ok) setError(r.error);
  }

  const seats = [0, 1, 2, 3].map((i) => view.players.find((p) => p.seat === i));
  const full = view.players.length === 4;

  return (
    <main className="page">
      <header className="hero hero--small">
        <button className="link back" onClick={() => navigate('/')}>← Start</button>
        <h1>{view.name}</h1>
      </header>

      <section className="panel">
        <h2>Einladen</h2>
        <p>Schick diesen Link an deine Mitspieler:</p>
        <div className="invite">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="btn btn--primary" onClick={copy}>{copied ? 'Kopiert ✓' : 'Teilen'}</button>
        </div>
      </section>

      <section className="panel">
        <h2>Am Tisch ({view.players.length}/4)</h2>
        <ol className="seats">
          {seats.map((p, i) => (
            <li key={i} className={p ? '' : 'empty'}>
              {p ? (
                <>
                  <span className={`dot ${p.connected ? 'on' : ''}`} />
                  {p.name}
                  {p.isHost && <span className="tag">Gastgeber</span>}
                  {p.seat === view.you.seat && <span className="tag tag--you">du</span>}
                </>
              ) : (
                'frei …'
              )}
            </li>
          ))}
        </ol>
        {view.you.isHost ? (
          <button className="btn btn--primary btn--big" disabled={!full} onClick={start}>
            {full ? 'Spiel starten' : 'Warte auf Mitspieler …'}
          </button>
        ) : (
          <p className="hint">{full ? 'Der Gastgeber kann jetzt starten.' : 'Warte auf Mitspieler …'}</p>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <h2>Regeln</h2>
        {editing ? (
          <>
            <RulesForm rules={rules} onChange={setRules} />
            <div className="row">
              <button className="btn btn--primary" onClick={saveRules}>Speichern</button>
              <button className="btn" onClick={() => (setRules(view.rules), setEditing(false))}>Abbrechen</button>
            </div>
          </>
        ) : (
          <>
            <ul className="rules-summary">
              {rulesSummary(view.rules).map((l) => <li key={l}>{l}</li>)}
            </ul>
            {view.you.isHost && <button className="btn" onClick={() => setEditing(true)}>Regeln ändern</button>}
          </>
        )}
      </section>
    </main>
  );
}
