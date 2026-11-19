import { contractName, sortHand } from '../../engine';
import type { HistoryEntry, RoomView } from '../../shared/protocol';
import { euro, rulesSummary, signedEuro } from '../format';
import { CardFace } from './CardFace';

function describe(e: HistoryEntry, name: (s: number | null) => string): string {
  const r = e.result;
  switch (r.kind) {
    case 'sie':
      return `SIE von ${name(r.sie)}`;
    case 'redeal':
      return r.stockDelta > 0 ? `zusammengeworfen – ${euro(r.stockDelta)} in den Stock` : 'zusammengeworfen';
    case 'ramsch':
      return r.durchmarsch !== null ? `Ramsch – Durchmarsch ${name(r.durchmarsch)}` : 'Ramsch';
    default: {
      const who = [r.declarer, r.partner].filter((x): x is number => x !== null).map(name).join(' & ');
      const extra = [r.schwarz ? 'schwarz' : r.schneider ? 'Schneider' : '', r.laufende ? `${r.laufende} L.` : '', r.multiplier > 1 ? `×${r.multiplier}` : '']
        .filter(Boolean)
        .join(', ');
      const stock = r.stockDelta < 0 ? ` + Stock ${euro(-r.stockDelta)}` : '';
      return `${contractName(r.contract!)} (${who}) ${r.won ? '✓' : '✗'}${extra ? ` – ${extra}` : ''}${stock}`;
    }
  }
}

export function ScoreSheet({ view, onClose }: { view: RoomView; onClose: () => void }) {
  const name = (s: number | null) => (s === null ? '' : (view.players.find((p) => p.seat === s)?.name ?? '?'));
  const seats = [0, 1, 2, 3];
  const games = view.history.filter((e) => e.result.kind === 'game');
  const won = seats.map((s) => games.filter((e) => e.result.declarer === s && e.result.won).length);
  const played = seats.map((s) => games.filter((e) => e.result.declarer === s).length);

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__body" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h2>Abrechnung</h2>
          <button className="btn btn--small" onClick={onClose}>Schließen</button>
        </header>

        <div className="totals">
          {seats.map((s) => (
            <div key={s} className={view.balance[s] > 0 ? 'plus' : view.balance[s] < 0 ? 'minus' : ''}>
              <span>{name(s)}</span>
              <strong>{signedEuro(view.balance[s])}</strong>
              <small>als Spieler {won[s]}/{played[s]} gewonnen</small>
            </div>
          ))}
        </div>

        {(view.stock > 0 || view.rules.redeal === 'stock') && (
          <p className="stock-line">
            Im Stock: <strong>{euro(view.stock)}</strong> – geht an das nächste gewonnene Sauspiel.
          </p>
        )}

        <div className="sheet-scroll">
          <table className="sheet">
            <thead>
              <tr>
                <th>#</th>
                <th>Spiel</th>
                {seats.map((s) => <th key={s}>{name(s)}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...view.history].reverse().map((e) => (
                <tr key={e.no}>
                  <td>{e.no}</td>
                  <td className="sheet__game">{describe(e, name)}</td>
                  {seats.map((s) => (
                    <td key={s} className={e.result.payouts[s] > 0 ? 'plus' : e.result.payouts[s] < 0 ? 'minus' : ''}>
                      {e.result.payouts[s] ? signedEuro(e.result.payouts[s]) : '·'}
                      <small>{euro(e.balance[s])}</small>
                    </td>
                  ))}
                </tr>
              ))}
              {view.history.length === 0 && (
                <tr>
                  <td colSpan={6} className="hint">Noch keine Spiele.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <section className="hall">
          <h3>Ruhmeshalle – Sie</h3>
          {view.sie.length === 0 ? (
            <p className="hint">Noch hat niemand eine Sie bekommen. Irgendwann …</p>
          ) : (
            view.sie.map((s, i) => (
              <div key={i} className="hall__entry">
                <strong>{s.name}</strong>
                <span>{new Date(s.at).toLocaleDateString('de-DE')}</span>
                <div className="mini-hand">
                  {sortHand(s.cards, null).map((c) => <CardFace key={c} card={c} className="card--small" />)}
                </div>
              </div>
            ))
          )}
        </section>

        <section>
          <h3>Regeln dieser Runde</h3>
          <ul className="rules-summary">
            {rulesSummary(view.rules).map((l) => <li key={l}>{l}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
