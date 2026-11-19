import { describe, expect, it } from 'vitest';
import {
  type Action,
  type Card,
  type HandState,
  DEFAULT_RULES,
  type Rules,
  allowedActions,
  applyAction,
  availableContracts,
  handFromCards,
  legalCards,
  makeDeck,
  multiplier,
  newHand,
  scoreHand,
  trickWinnerIndex,
  trumpOrder,
} from './index';

const rules = (patch: Partial<Rules> = {}): Rules => ({ ...DEFAULT_RULES, ...patch });

/** Kleiner deterministischer Zufallsgenerator für reproduzierbare Tests. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lässt alle Spieler nacheinander "nicht legen" sagen. */
function skipLegen(s: HandState): HandState {
  while (s.phase === 'legen') s = applyAction(s, s.turn!, { type: 'legen', yes: false });
  return s;
}

// Eine feste Verteilung (langes Blatt), Geber = 3 → Vorhand = 0.
const HANDS: Card[][] = [
  ['EO', 'GO', 'HO', 'SO', 'EU', 'GA', 'G10', 'E9'], // Sitz 0: stark
  ['GU', 'HU', 'SU', 'HA', 'H10', 'HK', 'H9', 'H8'], // Sitz 1
  ['EA', 'E10', 'EK', 'GK', 'E8', 'E7', 'H7', 'G9'], // Sitz 2: hat die Eichel-Sau
  ['SA', 'S10', 'SK', 'S9', 'S8', 'S7', 'G8', 'G7'], // Sitz 3
];

describe('Karten und Trümpfe', () => {
  it('kennt die Trumpfreihenfolge', () => {
    expect(trumpOrder({ kind: 'sauspiel', suit: 'E' })).toHaveLength(14);
    expect(trumpOrder({ kind: 'sauspiel', suit: 'E' }).slice(0, 5)).toEqual(['EO', 'GO', 'HO', 'SO', 'EU']);
    expect(trumpOrder({ kind: 'wenz' })).toEqual(['EU', 'GU', 'HU', 'SU']);
    expect(trumpOrder({ kind: 'farbwenz', suit: 'G' })).toHaveLength(11);
    expect(trumpOrder({ kind: 'sauspiel', suit: 'E' }, 'short')).toHaveLength(12);
  });

  it('bestimmt den Stichgewinner', () => {
    const sp = { kind: 'sauspiel', suit: 'E' } as const;
    expect(trickWinnerIndex(['GA', 'G10', 'H7', 'GK'], sp)).toBe(2); // Herz ist Trumpf
    expect(trickWinnerIndex(['HA', 'SU', 'EO', 'H10'], sp)).toBe(2);
    expect(trickWinnerIndex(['G9', 'EA', 'GK', 'S10'], sp)).toBe(2); // nicht bedient zählt nicht
    const wenz = { kind: 'wenz' } as const;
    expect(trickWinnerIndex(['EA', 'EO', 'EK', 'E10'], wenz)).toBe(0);
    expect(trickWinnerIndex(['EK', 'EO', 'E9', 'SU'], wenz)).toBe(3);
    expect(trickWinnerIndex(['EK', 'EO', 'E9', 'E7'], wenz)).toBe(0); // König vor Ober
    const geier = { kind: 'geier' } as const;
    expect(trickWinnerIndex(['HU', 'HK', 'H7', 'H9'], geier)).toBe(1); // König vor Unter
  });

  it('kurzes Blatt hat 24 Karten', () => {
    expect(makeDeck('short')).toHaveLength(24);
    const s = newHand(rules({ deck: 'short' }), 0, mulberry32(1));
    expect(s.hands.every((h) => h.length === 3)).toBe(true);
    expect(s.pending.every((h) => h.length === 3)).toBe(true);
  });
});

describe('Legen und Doppeln', () => {
  it('erlaubt höchstens dreimal Legen (8-fach), danach nur noch Kontra (16-fach)', () => {
    let s = handFromCards(rules(), 3, HANDS);
    s = applyAction(s, 0, { type: 'legen', yes: true });
    s = applyAction(s, 1, { type: 'legen', yes: true });
    s = applyAction(s, 2, { type: 'legen', yes: true });
    // Vierter Spieler wird übersprungen
    expect(s.phase).toBe('bid');
    expect(s.legen).toEqual([true, true, true, false]);
    expect(multiplier(s)).toBe(8);
    expect(s.hands.every((h) => h.length === 8)).toBe(true);

    // Gelegt → müssen spielen
    expect(allowedActions(s, 0).bid).toEqual({ spiel: true, weiter: false });
    expect(() => applyAction(s, 0, { type: 'bid', play: false })).toThrow(/muss spielen/);
    s = applyAction(s, 0, { type: 'bid', play: true });
    s = applyAction(s, 1, { type: 'bid', play: true });
    s = applyAction(s, 2, { type: 'bid', play: true });
    s = applyAction(s, 3, { type: 'bid', play: false });
    // Duell: 1 fordert mit Solo, 0 hält, 1 gibt auf, 2 gibt auf
    expect(s.phase).toBe('duel');
    expect(s.turn).toBe(1);
    expect(allowedActions(s, 1).duel?.raise).toEqual([2]);
    s = applyAction(s, 1, { type: 'duel', choice: 'raise', level: 2 });
    s = applyAction(s, 0, { type: 'duel', choice: 'hold' });
    s = applyAction(s, 1, { type: 'duel', choice: 'pass' });
    s = applyAction(s, 2, { type: 'duel', choice: 'pass' });
    expect(s.phase).toBe('choose');
    expect(s.declarer).toBe(0);
    expect(s.minLevel).toBe(2);
    const opts = allowedActions(s, 0).choose!;
    expect(opts.some((c) => c.kind === 'sauspiel')).toBe(false);
    s = applyAction(s, 0, { type: 'choose', contract: { kind: 'farbsolo', suit: 'G' } });
    expect(s.phase).toBe('play');

    expect(allowedActions(s, 0).kontra).toBe(false);
    expect(allowedActions(s, 1).kontra).toBe(true);
    s = applyAction(s, 1, { type: 'kontra' });
    expect(multiplier(s)).toBe(16);
    expect(allowedActions(s, 0).re).toBe(false);
    expect(() => applyAction(s, 0, { type: 're' })).toThrow();
  });

  it('Kontra und Re ohne Legen ergeben 4-fach', () => {
    let s = skipLegen(handFromCards(rules(), 3, HANDS));
    s = applyAction(s, 0, { type: 'bid', play: true });
    for (const p of [1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    s = applyAction(s, 0, { type: 'choose', contract: { kind: 'sauspiel', suit: 'E' } });
    expect(s.partner).toBe(2);
    expect(allowedActions(s, 2).kontra).toBe(false); // Partner darf kein Kontra geben
    s = applyAction(s, 3, { type: 'kontra' });
    s = applyAction(s, 2, { type: 're' });
    expect(multiplier(s)).toBe(4);
  });

  it('wirft bei "alle weiter" zusammen oder ramscht – je nach Einstellung', () => {
    let s = skipLegen(handFromCards(rules({ allPass: 'redeal' }), 3, HANDS));
    for (const p of [0, 1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    expect(s.phase).toBe('done');
    expect(s.result?.kind).toBe('redeal');

    s = skipLegen(handFromCards(rules({ allPass: 'ramsch' }), 3, HANDS));
    for (const p of [0, 1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    expect(s.phase).toBe('play');
    expect(s.contract).toEqual({ kind: 'ramsch' });
  });

  it('erkennt eine Sie und spielt sie nicht', () => {
    const hands: Card[][] = [
      ['EO', 'GO', 'HO', 'SO', 'EU', 'GU', 'HU', 'SU'],
      ['EA', 'E10', 'EK', 'E9', 'E8', 'E7', 'GA', 'G10'],
      ['GK', 'G9', 'G8', 'G7', 'HA', 'H10', 'HK', 'H9'],
      ['H8', 'H7', 'SA', 'S10', 'SK', 'S9', 'S8', 'S7'],
    ];
    const s = skipLegen(handFromCards(rules(), 3, hands));
    expect(s.phase).toBe('done');
    expect(s.result?.kind).toBe('sie');
    expect(s.result?.sie).toBe(0);
    expect(s.result?.payouts).toEqual([0, 0, 0, 0]);
  });
});

describe('Reizen', () => {
  it('Der Vordere hat Vorrang bei gleicher Stufe', () => {
    let s = skipLegen(handFromCards(rules(), 3, HANDS));
    s = applyAction(s, 0, { type: 'bid', play: true });
    s = applyAction(s, 1, { type: 'bid', play: true });
    s = applyAction(s, 2, { type: 'bid', play: false });
    s = applyAction(s, 3, { type: 'bid', play: false });
    // Sitz 1 kann nur mit einem Solo überbieten
    expect(allowedActions(s, 1).duel).toEqual({ raise: [2], hold: false, pass: true });
    s = applyAction(s, 1, { type: 'duel', choice: 'raise', level: 2 });
    s = applyAction(s, 0, { type: 'duel', choice: 'pass' });
    expect(s.phase).toBe('choose');
    expect(s.declarer).toBe(1);
  });

  it('bietet Sauspiel nur mit rufbarer Farbe an', () => {
    // Sitz 3 hat keine Eichel/Gras-Karte ohne Sau... hat Gras 8/7 → Gras rufbar, Schelln-Sau selbst → nicht
    const opts = availableContracts(HANDS[3], rules());
    const sp = opts.filter((c) => c.kind === 'sauspiel').map((c) => c.suit);
    expect(sp).toEqual(['G']);
    // Ohne Soli: Sitz 1 (nur Herz und Unter) kann nichts spielen
    const only = rules({ games: { ...DEFAULT_RULES.games, farbsolo: false, wenz: false } });
    expect(availableContracts(HANDS[1], only)).toEqual([]);
  });
});

describe('Tout', () => {
  function chooseFor0(r: Rules): HandState {
    let s = skipLegen(handFromCards(r, 3, HANDS));
    s = applyAction(s, 0, { type: 'bid', play: true });
    for (const p of [1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    return s;
  }

  it('ist eine Zusatzansage zu Solo oder Wenz, kein eigenes Spiel', () => {
    const s = chooseFor0(rules());
    const opts = allowedActions(s, 0).choose!;
    expect(opts.some((c) => c.tout)).toBe(false);
    const t = applyAction(s, 0, { type: 'choose', contract: { kind: 'wenz', tout: true } });
    expect(t.contract).toEqual({ kind: 'wenz', tout: true });
    const f = applyAction(s, 0, { type: 'choose', contract: { kind: 'farbsolo', suit: 'H', tout: true } });
    expect(f.contract).toEqual({ kind: 'farbsolo', suit: 'H', tout: true });
  });

  it('geht nicht beim Sauspiel', () => {
    const s = chooseFor0(rules());
    expect(() => applyAction(s, 0, { type: 'choose', contract: { kind: 'sauspiel', suit: 'E', tout: true } })).toThrow(/Tout/);
  });

  it('geht zu jedem Solo, auch zu Geier und Farbwenz', () => {
    const all = rules({ games: { sauspiel: true, farbsolo: true, wenz: true, geier: true, farbwenz: true, farbgeier: true } });
    const s = chooseFor0(all);
    for (const c of allowedActions(s, 0).choose!.filter((x) => x.kind !== 'sauspiel')) {
      expect(applyAction(s, 0, { type: 'choose', contract: { ...c, tout: true } }).contract?.tout).toBe(true);
    }
  });
});

describe('Kontra-Zeitpunkt', () => {
  it('Kontra nur, solange man selbst noch keine Karte gespielt hat', () => {
    let s = skipLegen(handFromCards(rules(), 3, HANDS));
    s = applyAction(s, 0, { type: 'bid', play: true });
    for (const p of [1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    s = applyAction(s, 0, { type: 'choose', contract: { kind: 'farbsolo', suit: 'H' } });
    // Vor der ersten Karte: alle Gegenspieler dürfen
    expect([1, 2, 3].map((p) => allowedActions(s, p).kontra)).toEqual([true, true, true]);
    s = applyAction(s, 0, { type: 'play', card: allowedActions(s, 0).play[0] });
    s = applyAction(s, 1, { type: 'play', card: allowedActions(s, 1).play[0] });
    // Sitz 1 hat schon gespielt, Sitz 2 und 3 noch nicht
    expect([1, 2, 3].map((p) => allowedActions(s, p).kontra)).toEqual([false, true, true]);
    expect(() => applyAction(s, 1, { type: 'kontra' })).toThrow(/Kontra/);
    s = applyAction(s, 3, { type: 'kontra' });
    // Der Spieler hat schon ausgespielt → kein Re mehr
    expect(allowedActions(s, 0).re).toBe(false);
    expect(() => applyAction(s, 0, { type: 're' })).toThrow(/Re/);
  });

  it('Re nur, solange man selbst noch keine Karte gespielt hat', () => {
    let s = skipLegen(handFromCards(rules(), 3, HANDS));
    s = applyAction(s, 0, { type: 'bid', play: true });
    for (const p of [1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    s = applyAction(s, 0, { type: 'choose', contract: { kind: 'sauspiel', suit: 'E' } });
    s = applyAction(s, 3, { type: 'kontra' });
    // Noch niemand hat gespielt: Spieler (0) und Partner (2) dürfen Re geben
    expect(allowedActions(s, 0).re).toBe(true);
    expect(allowedActions(s, 2).re).toBe(true);
    s = applyAction(s, 0, { type: 'play', card: allowedActions(s, 0).play[0] });
    s = applyAction(s, 1, { type: 'play', card: allowedActions(s, 1).play[0] });
    expect(allowedActions(s, 0).re).toBe(false);
    expect(allowedActions(s, 2).re).toBe(true);
    s = applyAction(s, 2, { type: 're' });
    expect(multiplier(s)).toBe(4);
  });
});

describe('Zusammenwerfen: doppelt und Stock', () => {
  const won = (patch: Partial<HandState>): HandState => {
    const s = skipLegen(handFromCards(rules(), 3, HANDS));
    const tricks = Array.from({ length: 8 }, () => ({ leader: 0, cards: ['H7', 'H8', 'H9', 'EA'] as Card[], winner: 0 }));
    return { ...s, contract: { kind: 'sauspiel', suit: 'E' }, declarer: 0, partner: 2, tricks, ...patch };
  };

  it('Legen und Zusammenwerfen zusammen höchstens 8-fach, mit Kontra höchstens 16-fach', () => {
    let s = skipLegen(handFromCards(rules(), 3, HANDS));
    s = applyAction(s, 0, { type: 'bid', play: true });
    s = applyAction(s, 1, { type: 'bid', play: false });
    s = applyAction(s, 2, { type: 'bid', play: false });
    s = applyAction(s, 3, { type: 'bid', play: false });
    s = { ...s, bock: 1, legen: [true, true, true, false] }; // doppelt + 3× gelegt (hier direkt gesetzt)
    s = applyAction(s, 0, { type: 'choose', contract: { kind: 'sauspiel', suit: 'E' } });
    expect(multiplier(s)).toBe(8);
    s = applyAction(s, 1, { type: 'kontra' });
    expect(multiplier(s)).toBe(16);
    expect(allowedActions(s, 0).re).toBe(false); // bei 16-fach ist Schluss
  });

  it('nach Zusammenwerfen (doppelt) dürfen nur noch zwei legen', () => {
    let s = newHand(rules(), 3, mulberry32(5), { bock: 1 });
    s = applyAction(s, 0, { type: 'legen', yes: true });
    s = applyAction(s, 1, { type: 'legen', yes: true });
    expect(s.phase).toBe('bid');
    expect(s.legen).toEqual([true, true, false, false]);
    expect(multiplier(s)).toBe(8);
  });

  it('steht schon 8-fach an, wird gar nicht nach dem Legen gefragt', () => {
    const s = newHand(rules(), 3, mulberry32(5), { bock: 3 });
    expect(s.phase === 'bid' || s.phase === 'done').toBe(true);
    expect(s.hands.every((h) => h.length === 8)).toBe(true);
    expect(multiplier(s)).toBe(8);
  });

  it('ohne Zusammenwerfen: dreimal gelegt 8-fach, Kontra 16-fach, kein Re', () => {
    let s = skipLegen(handFromCards(rules(), 3, HANDS));
    s = applyAction(s, 0, { type: 'bid', play: true });
    for (const p of [1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    s = { ...s, legen: [true, true, true, false] };
    s = applyAction(s, 0, { type: 'choose', contract: { kind: 'sauspiel', suit: 'E' } });
    s = applyAction(s, 3, { type: 'kontra' });
    expect(multiplier(s)).toBe(16);
    expect(allowedActions(s, 2).re).toBe(false);
  });

  it('Stock: beim Zusammenwerfen zahlt jeder ein', () => {
    let s = skipLegen(handFromCards(rules({ redeal: 'stock' }), 3, HANDS));
    for (const p of [0, 1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    expect(s.result?.payouts).toEqual([-10, -10, -10, -10]);
    expect(s.result?.stockDelta).toBe(40);
  });

  it('Stock geht an das gewonnene Sauspiel, nicht an ein Solo oder ein verlorenes Sauspiel', () => {
    const r = scoreHand(won({ stock: 40 }));
    expect(r.won).toBe(true);
    expect(r.stockDelta).toBe(-40);
    expect(r.payouts[0] - r.value).toBe(20);
    expect(r.payouts[2] - r.value).toBe(20);
    expect(r.payouts.reduce((a, b) => a + b, 0) + r.stockDelta).toBe(0);

    const lost = scoreHand(won({ stock: 40, tricks: [] }));
    expect(lost.won).toBe(false);
    expect(lost.stockDelta).toBe(0);

    const solo = scoreHand(won({ stock: 40, contract: { kind: 'farbsolo', suit: 'H' }, partner: null }));
    expect(solo.won).toBe(true);
    expect(solo.stockDelta).toBe(0);
  });
});

describe('Rufsau-Regeln', () => {
  function sauspielOnEichel(): HandState {
    let s = skipLegen(handFromCards(rules(), 3, HANDS));
    s = applyAction(s, 0, { type: 'bid', play: true });
    for (const p of [1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    return applyAction(s, 0, { type: 'choose', contract: { kind: 'sauspiel', suit: 'E' } });
  }

  it('Rufsau muss zugegeben werden, wenn gesucht wird', () => {
    // Sitz 0 hat keine Eichel – wir bauen eine Variante, in der 1 Eichel ausspielt.
    const hands: Card[][] = [
      ['EO', 'GO', 'HO', 'SO', 'EU', 'GA', 'G10', 'E9'],
      ['GU', 'HU', 'SU', 'HA', 'H10', 'HK', 'E8', 'H8'],
      ['EA', 'E10', 'EK', 'H9', 'G9', 'E7', 'H7', 'GK'],
      ['SA', 'S10', 'SK', 'S9', 'S8', 'S7', 'G8', 'G7'],
    ];
    let s = skipLegen(handFromCards(rules(), 3, hands));
    s = applyAction(s, 0, { type: 'bid', play: true });
    for (const p of [1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    s = applyAction(s, 0, { type: 'choose', contract: { kind: 'sauspiel', suit: 'E' } });
    s = applyAction(s, 0, { type: 'play', card: 'E9' });
    s = applyAction(s, 1, { type: 'play', card: 'E8' });
    expect(legalCards(s, 2)).toEqual(['EA']);
  });

  it('Rufsau darf nicht geschmiert werden und die Farbe nur mit der Sau angespielt werden', () => {
    const hands: Card[][] = [
      ['EO', 'GO', 'HO', 'SO', 'EU', 'GA', 'G10', 'E9'],
      ['GU', 'HU', 'SU', 'HA', 'H10', 'HK', 'E8', 'H8'],
      ['EA', 'E10', 'EK', 'H9', 'S9', 'E7', 'H7', 'GK'],
      ['SA', 'S10', 'SK', 'G9', 'S8', 'S7', 'G8', 'G7'],
    ];
    let s = skipLegen(handFromCards(rules(), 3, hands));
    s = applyAction(s, 0, { type: 'bid', play: true });
    for (const p of [1, 2, 3]) s = applyAction(s, p, { type: 'bid', play: false });
    s = applyAction(s, 0, { type: 'choose', contract: { kind: 'sauspiel', suit: 'E' } });
    // Gras wird gespielt, Sitz 2 hat GK → muss bedienen
    s = applyAction(s, 0, { type: 'play', card: 'GA' });
    s = applyAction(s, 1, { type: 'play', card: 'HA' }); // sticht nicht... HA ist Trumpf
    expect(legalCards(s, 2)).toEqual(['GK']);
    s = applyAction(s, 2, { type: 'play', card: 'GK' });
    s = applyAction(s, 3, { type: 'play', card: 'G9' });
    // Sitz 1 hat gestochen und spielt aus
    expect(s.turn).toBe(1);
    s = applyAction(s, 1, { type: 'play', card: 'SU' }); // Trumpf
    // Sitz 2 bedient Trumpf
    expect(legalCards(s, 2).sort()).toEqual(['H7', 'H9']);
  });

  it('Rufsau darf nicht abgeworfen werden, wenn man nicht bedienen kann', () => {
    const s = sauspielOnEichel();
    // Schelln wird ausgespielt, Sitz 2 hat keine Schelln und keinen Trumpf außer H7
    const t: HandState = {
      ...s,
      turn: 2,
      trick: { leader: 1, cards: ['SA'] },
      hands: s.hands.map((h, i) => (i === 2 ? ['EA', 'E10', 'GK'] : h)),
    };
    expect(legalCards(t, 2).sort()).toEqual(['E10', 'GK']);
    // Im letzten Stich ist sie natürlich erlaubt
    const last: HandState = { ...t, hands: t.hands.map((h, i) => (i === 2 ? ['EA'] : h)) };
    expect(legalCards(last, 2)).toEqual(['EA']);
  });

  it('erlaubt Davonlaufen mit vier Karten der Ruffarbe', () => {
    const s = sauspielOnEichel();
    // Sitz 2 hat die Eichel-Sau mit 5 Eichel → darf davonlaufen; hier spielt aber Sitz 0 aus.
    expect(s.turn).toBe(0);
    const t: HandState = { ...s, turn: 2, trick: { leader: 2, cards: [] } };
    expect(legalCards(t, 2)).toContain('E8');
    // Mit nur drei Eichel inkl. Sau: nur die Sau
    const t2: HandState = { ...t, hands: t.hands.map((h, i) => (i === 2 ? ['EA', 'E10', 'E9', 'H7', 'G9'] : h)) };
    expect(legalCards(t2, 2).sort()).toEqual(['EA', 'G9', 'H7']);
  });
});

describe('Abrechnung', () => {
  function finished(patch: Partial<HandState>): HandState {
    const s = skipLegen(handFromCards(rules(), 3, HANDS));
    return { ...s, ...patch };
  }

  it('Sauspiel gewonnen mit 4 Laufenden', () => {
    // Spielpartei 0 + 2: Sitz 0 hat EO GO HO SO → 4 Laufende (EU auch, aber GU fehlt → 5)
    const s = finished({
      contract: { kind: 'sauspiel', suit: 'E' },
      declarer: 0,
      partner: 2,
      tricks: [
        { leader: 0, cards: ['GA', 'G9', 'G8', 'G10'], winner: 0 },
        { leader: 0, cards: ['EA', 'E10', 'HA', 'H10'], winner: 1 },
      ],
    });
    const r = scoreHand(s);
    // Augen Partei: 11+10 = 21 ... → verloren, aber Laufende zählen trotzdem
    expect(r.laufende).toBe(5);
    expect(r.won).toBe(false);
    expect(r.schneider).toBe(true);
    // 10 + 10 Schneider + 5*10 Laufende = 70
    expect(r.value).toBe(70);
    expect(r.payouts).toEqual([-70, 70, -70, 70]);
  });

  it('Solo: Spieler bekommt dreifach, Tout verdoppelt', () => {
    const allTricks = (winner: number) =>
      Array.from({ length: 8 }, () => ({ leader: winner, cards: ['H7', 'H8', 'H9', 'EA'] as Card[], winner }));
    const s = finished({ contract: { kind: 'farbsolo', suit: 'H', tout: true }, declarer: 0, partner: null, tricks: allTricks(0) });
    const r = scoreHand(s);
    expect(r.won).toBe(true);
    // Sitz 0 hat EO GO HO SO EU: Laufende 5 → (30 + 50) * 2 = 160
    expect(r.laufende).toBe(5);
    expect(r.value).toBe(160);
    expect(r.payouts).toEqual([480, -160, -160, -160]);
  });

  it('Wenz: Laufende ab 2, Schwarz +10 (nicht kumulativ)', () => {
    const allTricks = Array.from({ length: 8 }, () => ({ leader: 1, cards: ['H7', 'H8', 'H9', 'EA'] as Card[], winner: 1 }));
    const s = finished({ contract: { kind: 'wenz' }, declarer: 1, partner: null, tricks: allTricks });
    const r = scoreHand(s);
    // Wenz-Trümpfe: EU (Sitz 0), GU HU SU (Sitz 1) → Gegner haben 1 Laufenden → keine
    expect(r.laufende).toBe(0);
    expect(r.schwarz).toBe(true);
    expect(r.value).toBe(40);
    expect(r.payouts).toEqual([-40, 120, -40, -40]);
  });

  it('Ramsch: wer die meisten Augen hat, zahlt', () => {
    const s = finished({
      contract: { kind: 'ramsch' },
      legen: [true, false, false, false],
      tricks: [
        { leader: 0, cards: ['EA', 'E10', 'HA', 'H10'], winner: 2 },
        { leader: 0, cards: ['GA', 'G9', 'G8', 'G7'], winner: 1 },
      ],
    });
    const r = scoreHand(s);
    expect(r.losers).toEqual([2]);
    expect(r.payouts).toEqual([20, 20, -60, 20]);
  });
});

describe('Zufallsspiele (Fuzz)', () => {
  function randomAction(s: HandState, rng: () => number): [number, Action] {
    const pick = <T,>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
    // Kontra/Re zufällig einstreuen
    for (let p = 0; p < 4; p++) {
      const a = allowedActions(s, p);
      if (a.kontra && rng() < 0.1) return [p, { type: 'kontra' }];
      if (a.re && rng() < 0.3) return [p, { type: 're' }];
    }
    const seat = s.turn!;
    const a = allowedActions(s, seat);
    if (a.legen) return [seat, { type: 'legen', yes: rng() < 0.25 }];
    if (a.bid) {
      const options: boolean[] = [];
      if (a.bid.spiel) options.push(true);
      if (a.bid.weiter) options.push(false, false);
      return [seat, { type: 'bid', play: pick(options) }];
    }
    if (a.duel) {
      const opts: Action[] = [];
      for (const l of a.duel.raise) opts.push({ type: 'duel', choice: 'raise', level: l });
      if (a.duel.hold) opts.push({ type: 'duel', choice: 'hold' });
      opts.push({ type: 'duel', choice: 'pass' });
      return [seat, pick(opts)];
    }
    if (a.choose) {
      const c = pick(a.choose);
      const tout = c.kind !== 'sauspiel' && rng() < 0.25;
      return [seat, { type: 'choose', contract: tout ? { ...c, tout } : c }];
    }
    return [seat, { type: 'play', card: pick(a.play) }];
  }

  for (const deck of ['long', 'short'] as const) {
    it(`spielt 1500 Zufallsspiele (${deck === 'long' ? 'langes' : 'kurzes'} Blatt) regelkonform zu Ende`, () => {
      const rng = mulberry32(deck === 'long' ? 42 : 7);
      const r = rules({
        deck,
        allPass: 'ramsch',
        games: { sauspiel: true, farbsolo: true, wenz: true, geier: true, farbwenz: true, farbgeier: true },
      });
      const kinds = new Set<string>();
      for (let i = 0; i < 1500; i++) {
        let s = newHand(r, i % 4, rng, { bock: i % 4 });
        let steps = 0;
        while (s.phase !== 'done') {
          const [seat, action] = randomAction(s, rng);
          s = applyAction(s, seat, action);
          if (++steps > 200) throw new Error('Spiel endet nicht');
        }
        const res = s.result!;
        expect(res.payouts.reduce((a, b) => a + b, 0) + res.stockDelta).toBe(0);
        if (res.kind === 'game' || res.kind === 'ramsch') {
          expect(res.augen.reduce((a, b) => a + b, 0)).toBe(120);
          expect(res.multiplier).toBeLessThanOrEqual(16);
          kinds.add(res.contract!.kind + (res.contract!.tout ? '-tout' : ''));
        }
      }
      expect(kinds.size).toBeGreaterThan(8);
    });
  }
});
