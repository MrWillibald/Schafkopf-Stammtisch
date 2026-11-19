import { useState } from 'react';
import { call, socket } from '../socket';

interface Props {
  current: string;
  /** Platz eines Computer-Mitspielers (nur Gastgeber); leer = eigener Name. */
  seat?: number;
  onClose: () => void;
}

/** Kleines Fenster zum Ändern eines Namens am Tisch. */
export function RenameDialog({ current, seat, onClose }: Props) {
  const [name, setName] = useState(current);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const own = seat === undefined;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await call((ack) => socket.emit('room:rename', { name, seat }, ack));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (own) {
      try {
        localStorage.setItem('schafkopf:name', name.trim());
      } catch {
        /* egal */
      }
    }
    onClose();
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rename-title" onClick={onClose}>
      <form className="modal__body modal__body--small" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 id="rename-title">{own ? 'Deinen Namen ändern' : `${current} umbenennen`}</h2>
        <label className="field">
          <span>Neuer Name</span>
          <input id="rename-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoFocus required />
        </label>
        {error && <p className="error">{error}</p>}
        <p className="hint">Liste, Saldo und Ruhmeshalle zeigen danach den neuen Namen – auch für alle bisherigen Spiele.</p>
        <div className="row">
          <button className="btn btn--primary" disabled={busy || !name.trim() || name.trim() === current}>
            Speichern
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
