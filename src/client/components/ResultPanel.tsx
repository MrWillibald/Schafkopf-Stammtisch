import { useState } from 'react';
import { contractName, sortHand } from '../../engine';
import type { RoomView } from '../../shared/protocol';
import { euro, signedEuro } from '../format';
import { CardFace } from './CardFace';

interface Props {
  view: RoomView;
  ready: () => void;
  name: (seat: number | null) => string;
}

export function ResultPanel({ view, ready, name }: Props) {
  const h = view.hand!;
  const r = h.result!;
  const [showCards, setShowCards] = useState(false);
  const me = view.players.find((p) => p.seat === view.you.seat);
  const waiting = view.players.filter((p) => !p.ready).map((p) => p.name);

  let headline: string;
  const details: string[] = [];
  if (r.kind === 'sie') {
    headline = `${name(r.sie)} hat eine SIE! Ab in die Ruhmeshalle.`;
  } else if (r.kind === 'redeal') {
    headline = 'Alle weiter – es wird zusammengeworfen.';
    if (r.stockDelta > 0) details.push(`Jeder zahlt ${euro(r.stockDelta / 4)} in den Stock – jetzt ${euro(view.stock)}`);
    else if (view.pendingDoubles > 0)
      details.push(view.pendingDoubles === 1 ? 'Das nächste Spiel zählt doppelt.' : `Das nächste Spiel zählt ${2 ** view.pendingDoubles}-fach.`);
  } else if (r.kind === 'ramsch') {
    if (r.durchmarsch !== null) headline = `Durchmarsch von ${name(r.durchmarsch)}!`;
    else if (r.losers.length === 4) headline = 'Ramsch: Gleichstand – niemand zahlt.';
    else headline = `Ramsch verloren: ${r.losers.map((s) => `${name(s)} (${r.augen[s]})`).join(', ')}`;
    if (r.multiplier > 1) details.push(`×${r.multiplier}`);
  } else {
    const team = [r.declarer, r.partner].filter((x): x is number => x !== null);
    headline = `${contractName(r.contract!)} von ${team.map(name).join(' & ')} – ${r.won ? 'gewonnen' : 'verloren'}`;
    details.push(`${r.declarerAugen} Augen`);
    if (r.schwarz) details.push('schwarz');
    else if (r.schneider) details.push('Schneider');
    if (r.laufende) details.push(`${r.laufende} Laufende`);
    if (r.multiplier > 1) details.push(`×${r.multiplier}`);
    details.push(`${euro(r.value)} pro Gegenspieler`);
    if (r.stockDelta < 0) details.push(`dazu der Stock: ${euro(-r.stockDelta)}`);
  }

  return (
    <div className="actions result">
      <p className={`result__headline ${r.kind === 'sie' ? 'result__headline--sie' : ''}`}>{headline}</p>
      {details.length > 0 && <p className="result__details">{details.join(' · ')}</p>}
      {r.kind !== 'sie' && r.payouts.some((x) => x !== 0) && (
        <div className="result__payouts">
          {[0, 1, 2, 3].map((s) => (
            <div key={s} className={r.payouts[s] > 0 ? 'plus' : r.payouts[s] < 0 ? 'minus' : ''}>
              <span>{name(s)}</span>
              <strong>{signedEuro(r.payouts[s])}</strong>
              <small>{r.augen[s]} Augen</small>
            </div>
          ))}
        </div>
      )}
      {showCards && (
        <div className="result__hands">
          {[0, 1, 2, 3].map((s) => (
            <div key={s} className="result__hand">
              <span>{name(s)}</span>
              <div className="mini-hand">
                {sortHand(r.hands[s], r.contract).map((c) => (
                  <CardFace key={c} card={c} className="card--small" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <button className="btn btn--primary" disabled={me?.ready} onClick={ready}>
          {me?.ready ? 'Warte auf die anderen …' : 'Nächstes Spiel'}
        </button>
        <button className="btn" onClick={() => setShowCards((x) => !x)}>
          {showCards ? 'Karten zu' : 'Karten zeigen'}
        </button>
      </div>
      {me?.ready && waiting.length > 0 && <p className="hint">Noch nicht bereit: {waiting.join(', ')}</p>}
    </div>
  );
}
