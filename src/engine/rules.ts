import type { DeckType } from './cards';

/** Einstellungen einer Runde – werden beim Anlegen festgelegt. Alle Beträge in Cent. */
export interface Rules {
  deck: DeckType;
  games: {
    sauspiel: boolean;
    farbsolo: boolean;
    wenz: boolean;
    geier: boolean;
    farbwenz: boolean;
    farbgeier: boolean;
  };
  /** Tout bei Soli erlaubt (verdoppelt den Spielwert). */
  tout: boolean;
  /** Was passiert, wenn alle "weiter" sagen. */
  allPass: 'ramsch' | 'redeal';
  tariff: {
    /** Grundtarif Sauspiel (und Ramsch). */
    game: number;
    /** Grundtarif Solo (Farbsolo, Wenz, Geier, Farbwenz, Farbgeier). */
    solo: number;
    /** Pro Laufendem. */
    laufende: number;
    /** Zuschlag für Schneider bzw. Schwarz (nicht kumulativ). */
    schneider: number;
  };
  /** Laufende zählen ab ... (normale Spiele). */
  laufendeMin: number;
  /** Laufende zählen ab ... bei Wenz und Geier. */
  laufendeMinWenzGeier: number;
}

/** Maximal dreimal Legen → 8-fach. */
export const MAX_LEGEN = 3;
/** Gesamtdeckel für Legen + Kontra + Re. Bei 8-fach gelegt geht also nur noch Kontra. */
export const MAX_MULTIPLIER = 16;

export const DEFAULT_RULES: Rules = {
  deck: 'long',
  games: {
    sauspiel: true,
    farbsolo: true,
    wenz: true,
    geier: false,
    farbwenz: false,
    farbgeier: false,
  },
  tout: true,
  allPass: 'redeal',
  tariff: {
    game: 10,
    solo: 30,
    laufende: 10,
    schneider: 10,
  },
  laufendeMin: 3,
  laufendeMinWenzGeier: 2,
};

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? Math.round(v) : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Nimmt beliebige (Client-)Eingaben entgegen und liefert gültige Regeln. */
export function sanitizeRules(input: unknown): Rules {
  const r = (input ?? {}) as Partial<Rules>;
  const d = DEFAULT_RULES;
  const g = (r.games ?? {}) as Partial<Rules['games']>;
  const t = (r.tariff ?? {}) as Partial<Rules['tariff']>;
  const bool = (v: unknown, fb: boolean) => (typeof v === 'boolean' ? v : fb);
  const games = {
    sauspiel: bool(g.sauspiel, d.games.sauspiel),
    farbsolo: bool(g.farbsolo, d.games.farbsolo),
    wenz: bool(g.wenz, d.games.wenz),
    geier: bool(g.geier, d.games.geier),
    farbwenz: bool(g.farbwenz, d.games.farbwenz),
    farbgeier: bool(g.farbgeier, d.games.farbgeier),
  };
  if (!Object.values(games).some(Boolean)) games.sauspiel = true;
  return {
    deck: r.deck === 'short' ? 'short' : 'long',
    games,
    tout: bool(r.tout, d.tout),
    allPass: r.allPass === 'ramsch' ? 'ramsch' : 'redeal',
    tariff: {
      game: clampInt(t.game, 0, 10000, d.tariff.game),
      solo: clampInt(t.solo, 0, 10000, d.tariff.solo),
      laufende: clampInt(t.laufende, 0, 10000, d.tariff.laufende),
      schneider: clampInt(t.schneider, 0, 10000, d.tariff.schneider),
    },
    laufendeMin: clampInt(r.laufendeMin, 1, 8, d.laufendeMin),
    laufendeMinWenzGeier: clampInt(r.laufendeMinWenzGeier, 1, 8, d.laufendeMinWenzGeier),
  };
}
