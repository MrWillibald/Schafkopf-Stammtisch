import { useState } from 'react';
import { type Action, type Contract, LEVEL_NAMES, contractName, isSolo } from '../../engine';
import type { RoomView } from '../../shared/protocol';
import { ResultPanel } from './ResultPanel';

interface Props {
  view: RoomView;
  act: (a: Action) => void;
  ready: () => void;
  busy: boolean;
  name: (seat: number | null) => string;
}

/** Gruppiert die ansagbaren Spiele für eine übersichtliche Auswahl. */
function groupContracts(options: Contract[]) {
  const groups: { title: string; items: Contract[] }[] = [
    { title: 'Sauspiel', items: options.filter((c) => c.kind === 'sauspiel') },
    { title: 'Solo', items: options.filter((c) => c.kind === 'farbsolo') },
    { title: 'Wenz & Geier', items: options.filter((c) => isSolo(c.kind) && c.kind !== 'farbsolo') },
  ];
  return groups.filter((g) => g.items.length > 0);
}

function ChooseContract({ options, toutAllowed, busy, act }: { options: Contract[]; toutAllowed: boolean; busy: boolean; act: Props['act'] }) {
  const [tout, setTout] = useState(false);
  const hasSolo = options.some((c) => isSolo(c.kind));
  return (
    <div className="actions actions--choose">
      <p>Was spielst du?</p>
      {groupContracts(options).map((g) => (
        <div key={g.title} className="choose-group">
          <span className="choose-group__title">{g.title}</span>
          <div className="row row--wrap">
            {g.items.map((c) => {
              const withTout = tout && isSolo(c.kind);
              return (
                <button
                  key={contractName(c)}
                  className={`btn ${withTout ? 'btn--hot' : c.kind === 'sauspiel' ? 'btn--primary' : ''}`}
                  disabled={busy || (tout && !isSolo(c.kind))}
                  onClick={() => act({ type: 'choose', contract: withTout ? { ...c, tout: true } : c })}
                >
                  {contractName(withTout ? { ...c, tout: true } : c)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {toutAllowed && hasSolo && (
        <label className="tout-switch">
          <input type="checkbox" checked={tout} onChange={(e) => setTout(e.target.checked)} />
          <span className="tout-switch__track" aria-hidden="true" />
          <span>
            <strong>Tout ansagen</strong>
            <small>zum Solo oder Wenz: alle Stiche nötig, zählt doppelt</small>
          </span>
        </label>
      )}
    </div>
  );
}

export function ActionPanel({ view, act, ready, busy, name }: Props) {
  const h = view.hand!;
  const me = view.you.seat;
  const a = h.allowed;

  if (h.phase === 'done' && h.result) {
    return <ResultPanel view={view} ready={ready} name={name} />;
  }

  if (a.legen) {
    return (
      <div className="actions">
        <p>Willst du legen? Das verdoppelt das Spiel – und wer legt, muss spielen.</p>
        <div className="row">
          <button className="btn btn--hot" disabled={busy} onClick={() => act({ type: 'legen', yes: true })}>Legen</button>
          <button className="btn" disabled={busy} onClick={() => act({ type: 'legen', yes: false })}>Nicht legen</button>
        </div>
      </div>
    );
  }

  if (a.bid) {
    return (
      <div className="actions">
        <p>{h.legen[me] && !a.bid.weiter ? 'Du hast gelegt – du musst spielen.' : 'Willst du spielen?'}</p>
        <div className="row">
          <button className="btn btn--primary" disabled={busy || !a.bid.spiel} onClick={() => act({ type: 'bid', play: true })}>
            Ich spiel
          </button>
          <button className="btn" disabled={busy || !a.bid.weiter} onClick={() => act({ type: 'bid', play: false })}>
            Weiter
          </button>
        </div>
      </div>
    );
  }

  if (a.duel && h.duel) {
    const d = h.duel;
    if (d.awaiting === 'challenger') {
      return (
        <div className="actions">
          <p>
            {name(d.leader)} will auch spielen und sitzt vor dir. {d.level === 1 ? 'Hast du ein Solo?' : 'Mehr als ein Solo geht nicht.'}
          </p>
          <div className="row">
            {a.duel.raise.map((l) => (
              <button key={l} className="btn btn--primary" disabled={busy} onClick={() => act({ type: 'duel', choice: 'raise', level: l })}>
                Ich hab ein {LEVEL_NAMES[l]}
              </button>
            ))}
            <button className="btn" disabled={busy} onClick={() => act({ type: 'duel', choice: 'pass' })}>Weiter</button>
          </div>
        </div>
      );
    }
    return (
      <div className="actions">
        <p>{name(d.challenger)} hat ein {LEVEL_NAMES[d.level]}. Hältst du mit?</p>
        <div className="row">
          <button className="btn btn--primary" disabled={busy || !a.duel.hold} onClick={() => act({ type: 'duel', choice: 'hold' })}>
            Ich auch ({LEVEL_NAMES[d.level]})
          </button>
          <button className="btn" disabled={busy} onClick={() => act({ type: 'duel', choice: 'pass' })}>Weiter</button>
        </div>
      </div>
    );
  }

  if (a.choose) {
    return <ChooseContract options={a.choose} toutAllowed={view.rules.tout} busy={busy} act={act} />;
  }

  if (a.kontra || a.re) {
    return (
      <div className="actions actions--inline">
        {a.kontra && (
          <button className="btn btn--hot" disabled={busy} onClick={() => act({ type: 'kontra' })}>Kontra!</button>
        )}
        {a.re && (
          <button className="btn btn--hot" disabled={busy} onClick={() => act({ type: 're' })}>Re!</button>
        )}
        <span className="hint">möglich bis der erste Stich fertig ist</span>
      </div>
    );
  }

  return <div className="actions actions--empty" />;
}
