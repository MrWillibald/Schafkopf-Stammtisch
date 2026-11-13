import type { Card, Suit } from '../../engine';
import { RANK_NAMES, SUIT_NAMES, cardName, rankOf, suitOf } from '../../engine';

const SUIT_COLOR: Record<Suit, string> = {
  E: '#7a4a1e',
  G: '#2f7d32',
  H: '#c8202f',
  S: '#d99a00',
};

/** Farbsymbole des bayerischen Blatts, gezeichnet um (0,0) in einer 20×20-Box. */
export function SuitIcon({ suit, x = 0, y = 0, scale = 1 }: { suit: Suit; x?: number; y?: number; scale?: number }) {
  const t = `translate(${x} ${y}) scale(${scale})`;
  switch (suit) {
    case 'H':
      return (
        <path
          transform={t}
          d="M0 8 C -10 0, -9.5 -9, -4.7 -9 C -2 -9, 0 -7, 0 -5 C 0 -7, 2 -9, 4.7 -9 C 9.5 -9, 10 0, 0 8 Z"
          fill={SUIT_COLOR.H}
        />
      );
    case 'S':
      return (
        <g transform={t}>
          <circle r="8" fill={SUIT_COLOR.S} stroke="#8a5a00" strokeWidth="0.8" />
          <rect x="-8" y="-2.2" width="16" height="2.4" fill="#b23a1e" />
          <circle cy="4" r="1.6" fill="#5a3a00" />
          <path d="M0 4 V 7.6" stroke="#5a3a00" strokeWidth="1" />
          <circle cy="-8.6" r="1.4" fill="none" stroke="#8a5a00" strokeWidth="0.8" />
        </g>
      );
    case 'E':
      return (
        <g transform={t}>
          <path d="M0 -9 V -6" stroke="#4a2c10" strokeWidth="1.4" />
          <ellipse cy="3" rx="5.2" ry="6.4" fill="#c58a3c" stroke="#4a2c10" strokeWidth="0.7" />
          <path d="M-7.2 -0.5 A 7.2 6 0 0 1 7.2 -0.5 Z" fill={SUIT_COLOR.E} stroke="#4a2c10" strokeWidth="0.7" />
          <path d="M-4.5 -3 L 4.5 -3 M-5.8 -1.3 L 5.8 -1.3" stroke="#4a2c10" strokeWidth="0.5" />
        </g>
      );
    case 'G':
      return (
        <g transform={t}>
          <path d="M0 -10 C 8.5 -5, 8 5, 0 9 C -8 5, -8.5 -5, 0 -10 Z" fill={SUIT_COLOR.G} />
          <path d="M0 -8 V 10 M0 -3 L 3.5 -6 M0 1 L 4.5 -2.5 M0 -3 L -3.5 -6 M0 1 L -4.5 -2.5" stroke="#bfe3b5" strokeWidth="0.8" fill="none" />
        </g>
      );
  }
}

/** Einfache Figur für Ober, Unter und König. */
function Figure({ suit, rank }: { suit: Suit; rank: 'O' | 'U' | 'K' }) {
  const color = SUIT_COLOR[suit];
  return (
    <g>
      {/* Körper */}
      <path d="M18 74 C 18 58, 24 52, 30 52 C 36 52, 42 58, 42 74 Z" fill={color} opacity="0.9" />
      <path d="M24 74 L 30 56 L 36 74" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
      {/* Kopf */}
      <circle cx="30" cy="44" r="7" fill="#f2d3b1" stroke="#6b4a2a" strokeWidth="0.8" />
      {rank === 'K' && <path d="M22.5 39 L 24 31 L 27.5 35 L 30 29 L 32.5 35 L 36 31 L 37.5 39 Z" fill="#e8b923" stroke="#8a6a00" strokeWidth="0.6" />}
      {rank !== 'K' && <path d="M22 40 C 24 33, 36 33, 38 40 Z" fill="#333" />}
      {/* Beim Ober sitzt das Farbzeichen oben, beim Unter unten – wie im echten Blatt. */}
      {rank === 'O' && <SuitIcon suit={suit} x={30} y={21} scale={0.75} />}
      {rank === 'U' && <SuitIcon suit={suit} x={30} y={80} scale={0.55} />}
    </g>
  );
}

const LABEL: Record<string, string> = { A: 'A', '10': '10', K: 'K', O: 'O', U: 'U', '9': '9', '8': '8', '7': '7' };

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
  const color = SUIT_COLOR[suit];
  const isFigure = rank === 'O' || rank === 'U' || rank === 'K';
  const pips = rank === 'A' ? 1 : rank === '10' ? 4 : rank === '9' ? 3 : rank === '8' ? 2 : rank === '7' ? 2 : 0;
  const pipPos: Record<number, [number, number][]> = {
    1: [[30, 46]],
    2: [[30, 32], [30, 62]],
    3: [[30, 26], [30, 46], [30, 66]],
    4: [[21, 32], [39, 32], [21, 62], [39, 62]],
  };
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
        <rect x="0.75" y="0.75" width="58.5" height="88.5" rx="5" fill="#fffaf0" stroke="#3b3b3b" strokeWidth="1.2" />
        <rect x="3.5" y="3.5" width="53" height="83" rx="3.5" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="0.8" />
        <text x="6" y="14" fontSize="11" fontWeight="700" fill={color} fontFamily="Georgia, serif">
          {LABEL[rank]}
        </text>
        <SuitIcon suit={suit} x={10} y={22} scale={0.38} />
        <g transform="rotate(180 30 45)">
          <text x="6" y="14" fontSize="11" fontWeight="700" fill={color} fontFamily="Georgia, serif">
            {LABEL[rank]}
          </text>
          <SuitIcon suit={suit} x={10} y={22} scale={0.38} />
        </g>
        {isFigure ? (
          <Figure suit={suit} rank={rank as 'O' | 'U' | 'K'} />
        ) : (
          pipPos[pips].map(([x, y], i) => <SuitIcon key={i} suit={suit} x={x} y={y} scale={rank === 'A' ? 1.5 : 0.95} />)
        )}
        {rank === 'A' && (
          <text x="30" y="77" fontSize="9" textAnchor="middle" fill={color} fontFamily="Georgia, serif" fontStyle="italic">
            Sau
          </text>
        )}
        {isFigure && (
          <text x="30" y="86.5" fontSize="5.5" textAnchor="middle" fill="#555" fontFamily="Georgia, serif">
            {SUIT_NAMES[suit]}-{RANK_NAMES[rank]}
          </text>
        )}
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
