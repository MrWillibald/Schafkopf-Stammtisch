import { MAX_LEGEN_MULTIPLIER, MAX_MULTIPLIER } from './rules';

/** Was für den Spielfaktor zählt (Teil des HandState). */
export interface MultiplierInput {
  legen: (boolean | null)[];
  /** Verdopplungen aus vorherigem Zusammenwerfen. */
  bock?: number;
  kontra: number | null;
  re: number | null;
}

/** Legen und Verdopplung durch Zusammenwerfen – zusammen höchstens 8-fach. */
export function preMultiplier(s: MultiplierInput): number {
  const n = s.legen.filter((x) => x === true).length + (s.bock ?? 0);
  return Math.min(MAX_LEGEN_MULTIPLIER, 2 ** n);
}

/** Gesamtfaktor: Kontra und Re verdoppeln weiter, aber bei 16-fach ist Schluss. */
export function totalMultiplier(s: MultiplierInput): number {
  const n = (s.kontra !== null ? 1 : 0) + (s.re !== null ? 1 : 0);
  return Math.min(MAX_MULTIPLIER, preMultiplier(s) * 2 ** n);
}
