import type { Contract, Rules } from '../engine';
import { contractName } from '../engine';

export const euro = (cents: number): string =>
  (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export const signedEuro = (cents: number): string => (cents > 0 ? '+' : '') + euro(cents);

export const gameLabel = (c: Contract | null): string => (c ? contractName(c) : '–');

export function rulesSummary(r: Rules): string[] {
  const games = [
    r.games.sauspiel && 'Sauspiel',
    r.games.farbsolo && 'Farbsolo',
    r.games.wenz && 'Wenz',
    r.games.geier && 'Geier',
    r.games.farbwenz && 'Farbwenz',
    r.games.farbgeier && 'Farbgeier',
  ].filter(Boolean);
  return [
    r.deck === 'long' ? 'Langes Blatt (32 Karten)' : 'Kurzes Blatt (24 Karten)',
    `Spiele: ${games.join(', ')}${r.tout ? ' · Tout' : ''}`,
    `Alle weiter: ${r.allPass === 'ramsch' ? 'Ramsch' : 'Zusammenwerfen'}`,
    `Tarif: Spiel ${euro(r.tariff.game)}, Solo ${euro(r.tariff.solo)}, Laufende ${euro(r.tariff.laufende)} (ab ${r.laufendeMin}, Wenz/Geier ab ${r.laufendeMinWenzGeier}), Schneider/Schwarz ${euro(r.tariff.schneider)}`,
    'Legen bis 8-fach, mit Kontra höchstens 16-fach',
  ];
}
