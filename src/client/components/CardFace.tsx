import type { ReactNode } from 'react';
import type { Card, Rank, Suit } from '../../engine';
import { cardName, rankOf, suitOf } from '../../engine';

// Eigenes Blatt im Stil des bayerischen Bildes: Doppelfiguren, Farbzeichen in Spalten,
// verzierte Sau. Alles als SVG in einer 60×90-Box.

const INK = '#2a1d12';
const PAPER = '#fbf4e1';
const GOLD = '#e2b53e';
const SKIN = '#f3d6b6';

/** Farbe für Eckzeichen und Verzierungen. */
const INDEX_COLOR: Record<Suit, string> = {
  E: '#5c3a12',
  G: '#2e6b28',
  H: '#b01e2c',
  S: '#a2650a',
};

/** Gewand der Figuren je Farbe: Rock, Hut. */
const COSTUME: Record<Suit, { coat: string; hat: string; trim: string }> = {
  E: { coat: '#7a4a1e', hat: '#3f6a2c', trim: GOLD },
  G: { coat: '#3a7a30', hat: '#9c2a20', trim: GOLD },
  H: { coat: '#a82630', hat: '#22427a', trim: GOLD },
  S: { coat: '#c58a1c', hat: '#a82630', trim: '#f6e3a0' },
};

/** Farbzeichen, gezeichnet um (0,0) in einer etwa 20×22 großen Box. */
export function SuitIcon({ suit, x = 0, y = 0, scale = 1 }: { suit: Suit; x?: number; y?: number; scale?: number }) {
  const t = `translate(${x} ${y}) scale(${scale})`;
  switch (suit) {
    case 'H':
      return (
        <g transform={t}>
          <path
            d="M0 8.5 C -10 0.5, -9.6 -8.6, -4.8 -8.6 C -2.1 -8.6, -0.4 -6.8, 0 -4.8 C 0.4 -6.8, 2.1 -8.6, 4.8 -8.6 C 9.6 -8.6, 10 0.5, 0 8.5 Z"
            fill="#c42131"
            stroke="#6e0d16"
            strokeWidth="0.7"
          />
          <path d="M-5.6 -6.4 C -7.6 -5.2, -7.6 -2, -5.4 0.6" stroke="#f2a1a7" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'S':
      return (
        <g transform={t}>
          <circle cy="-9" r="1.5" fill="none" stroke="#6e4500" strokeWidth="0.8" />
          <circle r="7.6" fill="#e3a81f" stroke="#6e4500" strokeWidth="0.7" />
          <path d="M-7.45 -1.7 H7.45 V1.1 H-7.45 Z" fill="#b5341c" stroke="#6e4500" strokeWidth="0.4" />
          <path d="M-4.8 -4.4 A 5.6 5.6 0 0 1 1.8 -6.4" stroke="#fff1bd" strokeWidth="1" fill="none" strokeLinecap="round" />
          <circle cy="4" r="1.5" fill="#3b2400" />
          <path d="M0 4.6 V7.5" stroke="#3b2400" strokeWidth="1" />
        </g>
      );
    case 'E':
      return (
        <g transform={t}>
          <path d="M0 -10.6 C 0.7 -9.6, 0.7 -8.4, 0 -6.6" stroke="#4a2c0c" strokeWidth="1.2" fill="none" />
          <path d="M0.4 -9.2 C 2.8 -11.8, 7 -11.4, 8.2 -8.6 C 5.6 -7.2, 2.6 -7.6, 0.4 -9.2 Z" fill="#4f8f34" stroke="#244a17" strokeWidth="0.5" />
          <ellipse cy="2.8" rx="5.3" ry="6.7" fill="#d9a44a" stroke="#5a3510" strokeWidth="0.7" />
          <path d="M-3 0.4 C -3.6 3.4, -2.6 6.2, -1 8" stroke="#f5dca2" strokeWidth="0.9" fill="none" strokeLinecap="round" />
          <path d="M-7 -0.3 C -7 -5.4, 7 -5.4, 7 -0.3 C 4 1, -4 1, -7 -0.3 Z" fill="#7a5524" stroke="#3e2608" strokeWidth="0.7" />
          <path
            d="M-5 -2.9 L -2.2 0.4 M-2.4 -4.1 L 1.6 0.5 M0.6 -4.4 L 4.6 0 M3.6 -3.8 L 6 -1.3 M5 -2.9 L 2.2 0.4 M2.4 -4.1 L -1.6 0.5 M-0.6 -4.4 L -4.6 0 M-3.6 -3.8 L -6 -1.3"
            stroke="#3e2608"
            strokeWidth="0.4"
          />
        </g>
      );
    case 'G':
      return (
        <g transform={t}>
          <path d="M0 8.5 V 11.6" stroke="#244a17" strokeWidth="1.2" strokeLinecap="round" />
          <path
            d="M0 -10 C 2.5 -6.6, 8.6 -5.6, 8.3 0.4 C 8.1 5.4, 3 7.2, 0 9.6 C -3 7.2, -8.1 5.4, -8.3 0.4 C -8.6 -5.6, -2.5 -6.6, 0 -10 Z"
            fill="#3f8a35"
            stroke="#1f4a1a"
            strokeWidth="0.7"
          />
          <path
            d="M0 -7 V 9 M0 -2 L 5 -4.6 M0 2.6 L 5.9 0.4 M0 6.2 L 4.2 4.8 M0 -2 L -5 -4.6 M0 2.6 L -5.9 0.4 M0 6.2 L -4.2 4.8"
            stroke="#1f4a1a"
            strokeWidth="0.55"
            fill="none"
          />
          <path d="M-5.6 -3 C -6.2 0, -5.2 3, -3.2 5" stroke="#93d282" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

/** Augen-Anordnung der Zahlkarten (in zwei Spalten, wie im bayerischen Blatt). */
const PIPS: Partial<Record<Rank, [number, number][]>> = {
  '7': [[19, 22], [41, 22], [30, 33.5], [19, 45], [41, 45], [19, 68], [41, 68]],
  '8': [[19, 17], [41, 17], [19, 35], [41, 35], [19, 53], [41, 53], [19, 71], [41, 71]],
  '9': [[19, 17], [41, 17], [19, 35], [41, 35], [30, 44], [19, 53], [41, 53], [19, 71], [41, 71]],
  '10': [[19, 17], [41, 17], [30, 26], [19, 35], [41, 35], [19, 53], [41, 53], [30, 62], [19, 71], [41, 71]],
};

function Index({ text, suit, right = false }: { text: string; suit: Suit; right?: boolean }) {
  const el = (
    <text
      x={right ? 55 : 5}
      y="11"
      fontSize="8.5"
      fontWeight="700"
      textAnchor={right ? 'end' : 'start'}
      fill={INDEX_COLOR[suit]}
      fontFamily="Georgia, 'Times New Roman', serif"
    >
      {text}
    </text>
  );
  return (
    <>
      {el}
      <g transform="rotate(180 30 45)">{el}</g>
    </>
  );
}

/** Halbe Figur (Brustbild) für die obere Kartenhälfte; unten wird sie gespiegelt. */
function Bust({ suit, rank }: { suit: Suit; rank: 'O' | 'U' | 'K' }) {
  const c = COSTUME[suit];
  const hair = '#6b4320';
  return (
    <g>
      {/* König: Zepter */}
      {rank === 'K' && (
        <g>
          <path d="M11.5 45 L 10.5 15" stroke="#8a6a10" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10.4" cy="13.4" r="2.3" fill={GOLD} stroke={INK} strokeWidth="0.5" />
          <path d="M10.4 9.8 V 11.2 M9.7 10.5 H 11.1" stroke={INK} strokeWidth="0.5" />
        </g>
      )}
      {/* Wams mit Schultern und Ärmeln */}
      <path
        d="M7.5 45 L 9 37.5 C 10 33.4, 14.5 31.2, 21 30 L 30 32.4 L 39 30 C 45.5 31.2, 50 33.4, 51 37.5 L 52.5 45 Z"
        fill={c.coat}
        stroke={INK}
        strokeWidth="0.6"
      />
      <path d="M15.5 32 C 13.8 36.5, 13.4 41, 13.6 45 M44.5 32 C 46.2 36.5, 46.6 41, 46.4 45" fill="none" stroke={INK} strokeWidth="0.5" />
      <path
        d="M10.6 39 L 13.6 38.4 M10.2 41.8 L 13.5 41.4 M49.4 39 L 46.4 38.4 M49.8 41.8 L 46.5 41.4"
        stroke={c.trim}
        strokeWidth="1"
      />
      {rank === 'K' ? (
        // Hermelin-Umhang
        <g>
          <path d="M20 31 L 25 45 M40 31 L 35 45" stroke="#fbf8ef" strokeWidth="3.4" />
          <path d="M20 31 L 25 45 M40 31 L 35 45" stroke={INK} strokeWidth="0.3" strokeDasharray="1.2 2.4" />
          <SuitIcon suit={suit} x={30} y={39.4} scale={0.46} />
        </g>
      ) : (
        <g>
          <path d="M23.5 31.2 L 30 45 L 36.5 31.2" fill="none" stroke={c.trim} strokeWidth="1.2" />
          <circle cx="30" cy="36" r="0.75" fill={c.trim} stroke={INK} strokeWidth="0.25" />
          <circle cx="30" cy="40.2" r="0.75" fill={c.trim} stroke={INK} strokeWidth="0.25" />
        </g>
      )}
      {/* Halskrause */}
      <path
        d="M22 29.6 C 23 27.6, 37 27.6, 38 29.6 C 37 32, 23 32, 22 29.6 Z"
        fill="#fbf8ef"
        stroke={INK}
        strokeWidth="0.5"
      />
      <path d="M25 28.6 L 25.6 31 M28 28.3 L 28.2 31.4 M32 28.3 L 31.8 31.4 M35 28.6 L 34.4 31" stroke={INK} strokeWidth="0.3" />
      {/* Kopf */}
      <path d="M23.4 21.5 C 23 26, 25 28.4, 30 28.4 C 35 28.4, 37 26, 36.6 21.5 C 36.6 16.4, 23.4 16.4, 23.4 21.5 Z" fill={SKIN} stroke={INK} strokeWidth="0.6" />
      <path d="M23.6 20 C 23 23, 23.4 25, 24.6 26 C 24.4 23, 24.8 21, 26 19.6 Z M36.4 20 C 37 23, 36.6 25, 35.4 26 C 35.6 23, 35.2 21, 34 19.6 Z" fill={hair} />
      <path d="M27 21.3 H 28.6 M31.4 21.3 H 33" stroke={INK} strokeWidth="0.5" strokeLinecap="round" />
      <circle cx="27.8" cy="22.4" r="0.5" fill={INK} />
      <circle cx="32.2" cy="22.4" r="0.5" fill={INK} />
      <path d="M30 22.6 L 29.4 24.6 L 30.4 24.8" fill="none" stroke={INK} strokeWidth="0.4" />
      {rank === 'K' ? (
        <path d="M24.6 24.4 C 25 31.6, 35 31.6, 35.4 24.4 C 33.6 26.8, 26.4 26.8, 24.6 24.4 Z" fill="#e9e2cf" stroke={INK} strokeWidth="0.45" />
      ) : (
        <path d="M27.2 26.2 C 28.4 25.2, 29.4 25.5, 30 26 C 30.6 25.5, 31.6 25.2, 32.8 26.2" stroke={hair} strokeWidth="0.8" fill="none" strokeLinecap="round" />
      )}
      {/* Kopfbedeckung */}
      {rank === 'K' && (
        <g>
          <path d="M23.4 19 L 23.2 10.4 L 26.4 14 L 30 7.6 L 33.6 14 L 36.8 10.4 L 36.6 19 Z" fill={GOLD} stroke={INK} strokeWidth="0.5" />
          <path d="M23.4 17.4 H 36.6" stroke={INK} strokeWidth="0.4" />
          <circle cx="30" cy="15.4" r="0.9" fill="#b5341c" />
          <circle cx="26" cy="16" r="0.6" fill="#2b4f8f" />
          <circle cx="34" cy="16" r="0.6" fill="#2b4f8f" />
        </g>
      )}
      {rank === 'O' && (
        <g>
          <path d="M35 14.6 C 38.6 9.6, 43 7.8, 46 8.6 C 42.6 10.2, 40 12.4, 37.4 16.4 Z" fill="#f6f2e4" stroke={INK} strokeWidth="0.4" />
          <path d="M37.6 12.4 L 41.4 9.8 M39 13.6 L 43.6 9.6" stroke={INK} strokeWidth="0.25" />
          <path d="M22.4 17.2 C 22.4 10.4, 37.6 10.4, 37.6 17.2 Z" fill={c.hat} stroke={INK} strokeWidth="0.5" />
          <ellipse cx="30" cy="17.4" rx="10.6" ry="2.6" fill={c.hat} stroke={INK} strokeWidth="0.5" />
          <path d="M23 16.4 C 26 15.2, 34 15.2, 37 16.4" stroke={c.trim} strokeWidth="0.8" fill="none" />
        </g>
      )}
      {rank === 'U' && (
        <g>
          <path d="M23.6 19 C 23.6 12.6, 36.4 12.6, 36.4 19 Z" fill={c.hat} stroke={INK} strokeWidth="0.5" />
          <path d="M22.8 19 H 37.2" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M22.8 19 H 37.2" stroke={c.trim} strokeWidth="0.8" strokeLinecap="round" />
        </g>
      )}
      {/* Ober hält das Farbzeichen hoch, Unter auf Brusthöhe – wie im echten Blatt. */}
      {rank === 'O' && (
        <g>
          <path d="M12.5 37 L 11 22" stroke={c.coat} strokeWidth="4.4" strokeLinecap="round" />
          <circle cx="11" cy="20.6" r="2.1" fill={SKIN} stroke={INK} strokeWidth="0.45" />
          <SuitIcon suit={suit} x={11.2} y={11.6} scale={0.56} />
        </g>
      )}
      {rank === 'U' && (
        <g>
          <path d="M13 41 L 18.5 37.6" stroke={c.coat} strokeWidth="4.4" strokeLinecap="round" />
          <circle cx="19.4" cy="37" r="2.1" fill={SKIN} stroke={INK} strokeWidth="0.45" />
          <SuitIcon suit={suit} x={13.2} y={32.4} scale={0.56} />
        </g>
      )}
    </g>
  );
}

function Flourish({ color }: { color: string }) {
  const half = (
    <g fill="none" stroke={color} strokeWidth="1" strokeLinecap="round">
      <path d="M30 60 C 22 59, 15.5 63.5, 16.5 69.5 C 17.2 73.5, 22 74, 22.6 70.6 C 23 68.6, 21 67.8, 20 69" />
      <path d="M24 61 C 22.5 56.5, 18 55.5, 15.5 57" />
      <path d="M17.5 56.6 C 17 58.5, 18 59.6, 19.6 59.2" fill={color} fillOpacity="0.25" />
    </g>
  );
  return (
    <g>
      {half}
      <g transform="translate(60 0) scale(-1 1)">{half}</g>
      <circle cx="30" cy="61.5" r="1.4" fill={color} />
    </g>
  );
}

interface Props {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
  className?: string;
}

export function CardFace({ card, onClick, disabled, highlight, className = '' }: Props) {
  const suit = suitOf(card);
  const rank = rankOf(card);
  let body: ReactNode;

  if (rank === 'O' || rank === 'U' || rank === 'K') {
    body = (
      <>
        <Bust suit={suit} rank={rank} />
        <g transform="rotate(180 30 45)">
          <Bust suit={suit} rank={rank} />
        </g>
        <path d="M3.4 45 H 56.6" stroke={INK} strokeWidth="0.6" />
        <Index text={rank} suit={suit} right />
      </>
    );
  } else if (rank === 'A') {
    body = (
      <>
        <SuitIcon suit={suit} x={30} y={38} scale={1.6} />
        <Flourish color={INDEX_COLOR[suit]} />
        <g transform="rotate(180 30 45)">
          <path d="M22 13 C 26 10.5, 34 10.5, 38 13" stroke={INDEX_COLOR[suit]} strokeWidth="0.9" fill="none" strokeLinecap="round" />
        </g>
        <path d="M22 13 C 26 10.5, 34 10.5, 38 13" stroke={INDEX_COLOR[suit]} strokeWidth="0.9" fill="none" strokeLinecap="round" />
      </>
    );
  } else {
    body = (
      <>
        {PIPS[rank]!.map(([x, y], i) => (
          <SuitIcon key={i} suit={suit} x={x} y={y} scale={0.52} />
        ))}
        <Index text={rank} suit={suit} />
      </>
    );
  }

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`card ${disabled ? 'card--disabled' : ''} ${highlight ? 'card--highlight' : ''} ${className}`}
      onClick={disabled ? undefined : onClick}
      disabled={onClick ? disabled : undefined}
      title={cardName(card)}
      aria-label={cardName(card)}
      type={onClick ? 'button' : undefined}
    >
      <svg viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.6" y="0.6" width="58.8" height="88.8" rx="4.5" fill={PAPER} stroke={INK} strokeWidth="1" />
        <rect x="3.2" y="3.2" width="53.6" height="83.6" rx="2.4" fill="none" stroke={INK} strokeOpacity="0.55" strokeWidth="0.5" />
        {body}
      </svg>
    </Tag>
  );
}

export function CardBack({ className = '' }: { className?: string }) {
  return (
    <div className={`card card--back ${className}`} aria-hidden="true">
      <svg viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="rauten" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#2a64b0" />
            <rect width="4" height="4" fill="#f4f6fb" />
            <rect x="4" y="4" width="4" height="4" fill="#f4f6fb" />
          </pattern>
        </defs>
        <rect x="0.75" y="0.75" width="58.5" height="88.5" rx="5" fill="#f4f6fb" stroke="#3b3b3b" strokeWidth="1.2" />
        <rect x="4" y="4" width="52" height="82" rx="3" fill="url(#rauten)" />
      </svg>
    </div>
  );
}

/** Übersicht aller Karten unter /karten – zum Anschauen des Blatts. */
export function CardGallery() {
  const suits: Suit[] = ['E', 'G', 'H', 'S'];
  const ranks: Rank[] = ['O', 'U', 'K', 'A', '10', '9', '8', '7'];
  return (
    <main className="page gallery">
      <header className="hero hero--small">
        <h1>Das Blatt</h1>
      </header>
      {suits.map((s) => (
        <div key={s} className="gallery__row">
          {ranks.map((r) => (
            <CardFace key={r} card={`${s}${r}` as Card} />
          ))}
        </div>
      ))}
      <div className="gallery__row">
        <CardBack />
      </div>
    </main>
  );
}
