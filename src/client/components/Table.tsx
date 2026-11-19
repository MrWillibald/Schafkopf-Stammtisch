import { useEffect, useState } from 'react';
import { type Action, type Trick, contractName, sortHand } from '../../engine';
import type { RoomView } from '../../shared/protocol';
import { euro } from '../format';
import { call, socket } from '../socket';
import { ActionPanel } from './ActionPanel';
import { CardBack, CardFace } from './CardFace';
import { ScoreSheet } from './ScoreSheet';

const POS = ['bottom', 'left', 'top', 'right'] as const;

export function Table({ view }: { view: RoomView }) {
  const h = view.hand!;
  const me = view.you.seat;
  const name = (seat: number | null) => (seat === null ? '' : (view.players.find((p) => p.seat === seat)?.name ?? '?'));
  const rel = (seat: number) => (seat - me + 4) % 4;

  const [sheet, setSheet] = useState(false);
  const [peekLast, setPeekLast] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Abgeschlossenen Stich kurz liegen lassen, damit jeder sieht, wer ihn bekommt.
  // Direkt aus dem Zustand abgeleitet (kein Zwischenbild ohne Karten): Der fertige Stich
  // wird gezeigt, bis für genau diesen Stich die Anzeigezeit abgelaufen ist.
  const [flashDoneFor, setFlashDoneFor] = useState(h.tricksPlayed);
  useEffect(() => {
    const n = h.tricksPlayed;
    const t = setTimeout(() => setFlashDoneFor(n), 1800);
    return () => clearTimeout(t);
  }, [h.tricksPlayed]);
  const flashing = h.tricksPlayed > 0 && flashDoneFor !== h.tricksPlayed;

  // "Letzter Stich" ist nur ein kurzer Blick: schließt sich, sobald weitergespielt wird
  // oder nach ein paar Sekunden – sonst bliebe die Mitte auf dem alten Stich stehen.
  const trickCards = h.trick?.cards.length ?? 0;
  useEffect(() => setPeekLast(false), [trickCards, h.tricksPlayed]);
  useEffect(() => {
    if (!peekLast) return;
    const t = setTimeout(() => setPeekLast(false), 4000);
    return () => clearTimeout(t);
  }, [peekLast]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 3500);
    return () => clearTimeout(t);
  }, [error]);

  async function act(action: Action) {
    if (busy) return;
    setBusy(true);
    const r = await call((ack) => socket.emit('game:action', action, ack));
    setBusy(false);
    if (!r.ok) setError(r.error);
  }

  async function ready() {
    const r = await call((ack) => socket.emit('game:ready', ack));
    if (!r.ok) setError(r.error);
  }

  const current = h.trick && h.trick.cards.length > 0 ? h.trick : null;
  const shown: Trick | null = peekLast ? h.lastTrick : (current ?? (flashing ? h.lastTrick : null));
  const myTurnToPlay = h.phase === 'play' && h.turn === me;
  const hand = sortHand(h.hand, h.contract);
  const legal = new Set(h.allowed.play);

  function PlayerBox({ seat }: { seat: number }) {
    const p = view.players.find((x) => x.seat === seat);
    const tags: { text: string; cls?: string }[] = [];
    if (h.dealer === seat) tags.push({ text: 'Geber' });
    if (h.legen[seat]) tags.push({ text: 'gelegt', cls: 'tag--hot' });
    if ((h.phase === 'bid' || h.phase === 'duel') && h.bids[seat])
      tags.push({ text: h.bids[seat] === 'spiel' ? 'will spielen' : 'weiter', cls: h.bids[seat] === 'spiel' ? 'tag--hot' : 'tag--muted' });
    if (h.declarer === seat && h.contract) tags.push({ text: contractName(h.contract), cls: 'tag--player' });
    else if (h.declarer === seat && h.phase === 'choose') tags.push({ text: 'sagt an …', cls: 'tag--player' });
    if (h.partner === seat && h.partner !== null) tags.push({ text: 'Partner', cls: 'tag--player' });
    if (h.kontra === seat) tags.push({ text: 'Kontra', cls: 'tag--hot' });
    if (h.re === seat) tags.push({ text: 'Re', cls: 'tag--hot' });
    const showTricks = h.phase === 'play' || h.phase === 'done';
    return (
      <div className={`player player--${POS[rel(seat)]} ${h.turn === seat ? 'player--turn' : ''}`}>
        <div className="player__name">
          <span className={`dot ${p?.connected ? 'on' : ''}`} />
          {name(seat)}
          {seat === me && <span className="tag tag--you">du</span>}
        </div>
        <div className="player__tags">
          {tags.map((t) => (
            <span key={t.text} className={`tag ${t.cls ?? ''}`}>{t.text}</span>
          ))}
          {showTricks && <span className="tag tag--muted">{h.tricksWon[seat]} {h.tricksWon[seat] === 1 ? 'Stich' : 'Stiche'}</span>}
        </div>
        {seat !== me && (
          <div className="player__backs" aria-label={`${h.handCounts[seat]} Karten`}>
            {Array.from({ length: h.handCounts[seat] }, (_, i) => (
              <CardBack key={i} className="card--mini" />
            ))}
          </div>
        )}
      </div>
    );
  }

  const statusText = (() => {
    const t = h.turn;
    switch (h.phase) {
      case 'legen':
        return t === me ? 'Du bist dran: legen?' : `${name(t)} überlegt, ob gelegt wird …`;
      case 'bid':
        return t === me ? 'Du bist dran: spielen?' : `${name(t)} ist dran …`;
      case 'duel':
        return t === me ? 'Du bist gefragt …' : `${name(t)} überlegt …`;
      case 'choose':
        return t === me ? 'Sag dein Spiel an!' : `${name(t)} sagt an …`;
      case 'play':
        return t === me ? 'Du spielst aus' : `${name(t)} ist dran`;
      default:
        return '';
    }
  })();

  return (
    <div className="table">
      <header className="topbar">
        <div className="topbar__title">
          <strong>{view.name}</strong>
          <span>Spiel {view.handNo}</span>
        </div>
        {/* Zwei feste Zeilen, damit die Kopfzeile ihre Höhe nie ändert. */}
        <div className="topbar__game">
          <strong className="topbar__line">
            {h.contract ? contractName(h.contract) : h.phase === 'legen' ? 'Legen' : h.phase === 'done' ? 'Spielende' : 'Reizen'}
          </strong>
          <span className="topbar__line topbar__sub">
            {h.contract && h.declarer !== null && <span className="topbar__who">von {name(h.declarer)}</span>}
            {h.multiplier > 1 && (
              <span className="mult" title={h.bock ? 'inkl. Verdopplung nach Zusammenwerfen' : undefined}>
                ×{h.multiplier}
                {h.bock > 0 && ' (doppelt)'}
              </span>
            )}
            {view.stock > 0 && <span className="chip-stock">Stock {euro(view.stock)}</span>}
          </span>
        </div>
        <div className="topbar__actions">
          <button className="btn btn--small" disabled={!h.lastTrick} onClick={() => setPeekLast((x) => !x)}>
            {peekLast ? 'Zurück' : 'Letzter Stich'}
          </button>
          <button className="btn btn--small" onClick={() => setSheet(true)}>Liste</button>
        </div>
      </header>

      <div className="felt">
        {[1, 2, 3].map((r) => (
          <PlayerBox key={r} seat={(me + r) % 4} />
        ))}
        {/* Abfragen schweben über dem unteren Tischrand und verschieben nichts. */}
        <div className="action-layer">
          <ActionPanel view={view} act={act} ready={ready} busy={busy} name={name} />
        </div>
        <div className="center">
          {shown ? (
            <div className={`trick ${peekLast ? 'trick--peek' : ''}`}>
              {shown.cards.map((c, i) => {
                const seat = (shown.leader + i) % 4;
                return (
                  <CardFace
                    key={c}
                    card={c}
                    className={`trick__card trick__card--${POS[rel(seat)]}`}
                    highlight={shown.winner === seat}
                  />
                );
              })}
              {shown.winner !== undefined && (
                <div className="trick__label">
                  {peekLast ? 'Letzter Stich – ging an ' : 'Stich für '}
                  {name(shown.winner)}
                </div>
              )}
            </div>
          ) : (
            statusText && <div className="status">{statusText}</div>
          )}
        </div>
      </div>


      <div className="me">
        <PlayerBox seat={me} />
        {/* Kartengröße nach der vollen Hand, damit die Karten beim Ausspielen nicht wachsen. */}
        <div
          className={`hand ${myTurnToPlay ? 'hand--active' : ''}`}
          style={{ ['--n' as string]: view.rules.deck === 'long' ? 8 : 6 }}
        >
          {hand.map((c) => (
            <CardFace
              key={c}
              card={c}
              onClick={myTurnToPlay && legal.has(c) ? () => act({ type: 'play', card: c }) : undefined}
              disabled={myTurnToPlay && !legal.has(c)}
              className={myTurnToPlay && legal.has(c) ? 'card--playable' : ''}
            />
          ))}
        </div>
      </div>

      {error && <div className="toast" role="alert">{error}</div>}
      {sheet && <ScoreSheet view={view} onClose={() => setSheet(false)} />}
    </div>
  );
}
