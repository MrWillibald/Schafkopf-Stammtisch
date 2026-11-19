import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, type Rules, applyAction, newHand, viewFor } from '../engine';
import { botDecide } from './bot';
import { Room } from './room';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Computer-Mitspieler', () => {
  for (const deck of ['long', 'short'] as const) {
    it(`spielt 1000 Spiele (${deck}) nur mit regelkonformen Zügen`, () => {
      const rng = mulberry32(deck === 'long' ? 3 : 11);
      const rules: Rules = {
        ...DEFAULT_RULES,
        deck,
        allPass: 'ramsch',
        games: { sauspiel: true, farbsolo: true, wenz: true, geier: true, farbwenz: true, farbgeier: true },
      };
      const kinds = new Map<string, number>();
      let declarerWins = 0;
      let games = 0;
      for (let i = 0; i < 1000; i++) {
        let s = newHand(rules, i % 4, rng);
        let steps = 0;
        while (s.phase !== 'done') {
          const seat = s.turn!;
          const action = botDecide(viewFor(s, seat), rules);
          expect(action).not.toBeNull();
          s = applyAction(s, seat, action!); // wirft bei regelwidrigem Zug
          if (++steps > 200) throw new Error('hängt');
        }
        const r = s.result!;
        const k = r.contract?.kind ?? r.kind;
        kinds.set(k, (kinds.get(k) ?? 0) + 1);
        if (r.kind === 'game') {
          games++;
          if (r.won) declarerWins++;
        }
      }
      // Bots sollen nicht nur weiter sagen, und die Ansagen sollen meistens aufgehen.
      expect(games).toBeGreaterThan(300);
      expect(declarerWins / games).toBeGreaterThan(0.5);
    });
  }

  it('ein Mensch und drei Computer spielen eine Runde', () => {
    const room = Room.create('Test', DEFAULT_RULES);
    const me = room.join(undefined, 'Sepp').token;
    for (let i = 0; i < 3; i++) room.addBot(me);
    expect(room.data.players.map((p) => p.name)).toEqual(['Sepp', 'Xaver (PC)', 'Resi (PC)', 'Wastl (PC)']);
    room.removeBot(me, 2);
    room.addBot(me);
    expect(room.data.players).toHaveLength(4);
    room.start(me);
    for (let game = 0; game < 5; game++) {
      let guard = 0;
      while (room.data.hand!.phase !== 'done') {
        if (!room.runBot()) {
          // Mensch ist dran: wie ein Bot spielen
          const v = viewFor(room.data.hand!, 0);
          room.act(me, botDecide(v, room.data.rules)!);
        }
        if (++guard > 300) throw new Error('hängt');
      }
      room.ready(me); // Bots sind automatisch bereit
      expect(room.data.handNo).toBe(game + 2);
    }
    expect(room.data.balance.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
