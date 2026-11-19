import type { Contract, Rules } from '../engine';
import { contractName } from '../engine';

export const euro = (cents: number): string =>
  (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export const signedEuro = (cents: number): string => (cents > 0 ? '+' : '') + euro(cents);

export const gameLabel = (c: Contract | null): string => (c ? contractName(c) : '–');

export function rulesSummary(r: Rules): string[] {
  const games = [
    r.games.sauspiel && 'Sauspiel',
    r.games.farbsolo && 'Solo',
    r.games.wenz && 'Wenz',
    r.games.geier && 'Geier',
    r.games.farbwenz && 'Farbwenz',
    r.games.farbgeier && 'Farbgeier',
  ].filter(Boolean);
  return [
    r.deck === 'long' ? 'Langes Blatt (32 Karten)' : 'Kurzes Blatt (24 Karten)',
    `Spiele: ${games.join(', ')} · Tout zu jedem Solo`,
    `Alle weiter: ${
      r.allPass === 'ramsch'
        ? 'Ramsch'
        : r.redeal === 'double'
          ? 'Zusammenwerfen, nächstes Spiel zählt doppelt'
          : r.redeal === 'stock'
            ? `Zusammenwerfen, jeder zahlt ${euro(r.tariff.stock)} in den Stock (geht an das nächste gewonnene Sauspiel)`
            : 'Zusammenwerfen'
    }`,
    `Tarif: Spiel ${euro(r.tariff.game)}, Solo ${euro(r.tariff.solo)}, Laufende ${euro(r.tariff.laufende)} (ab ${r.laufendeMin}, Wenz/Geier ab ${r.laufendeMinWenzGeier}), Schneider/Schwarz ${euro(r.tariff.schneider)}`,
    'Legen (und Verdopplung nach Zusammenwerfen) zusammen höchstens 8-fach, mit Kontra/Re höchstens 16-fach',
  ];
}
