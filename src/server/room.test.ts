import { describe, expect, it } from 'vitest';
import { type Action, DEFAULT_RULES, allowedActions } from '../engine';
import { Room, RoomError } from './room';

function setup() {
  const room = Room.create('Testrunde', DEFAULT_RULES);
  const tokens = ['Sepp', 'Hias', 'Vroni', 'Gustl'].map((n) => room.join(undefined, n).token);
  return { room, tokens };
}

describe('Room', () => {
  it('nimmt genau vier Spieler auf und erkennt Wiederverbinden', () => {
    const { room, tokens } = setup();
    expect(() => room.join(undefined, 'Fünfter')).toThrow(RoomError);
    expect(room.join(tokens[2], undefined).seat).toBe(2);
    expect(room.data.hostToken).toBe(tokens[0]);
  });

  it('lehnt doppelte Namen ab', () => {
    const room = Room.create('x', DEFAULT_RULES);
    room.join(undefined, 'Sepp');
    expect(() => room.join(undefined, 'sepp')).toThrow(/vergeben/);
  });

  it('nur der Gastgeber startet; Hände bleiben privat', () => {
    const { room, tokens } = setup();
    expect(() => room.start(tokens[1])).toThrow(RoomError);
    room.start(tokens[0]);
    const v = room.view(tokens[1], () => true);
    expect(v.hand?.hand).toHaveLength(4);
    expect(JSON.stringify(v)).not.toContain('"pending"');
    expect(v.hand?.handCounts).toEqual([4, 4, 4, 4]);
  });

  it('spielt mehrere Spiele, führt Buch und rotiert den Geber', () => {
    const { room, tokens } = setup();
    room.start(tokens[0]);
    const firstDealer = room.data.dealer;
    for (let game = 0; game < 6; game++) {
      let guard = 0;
      while (room.data.hand!.phase !== 'done') {
        const h = room.data.hand!;
        const seat = h.turn!;
        const a = allowedActions(h, seat);
        let action: Action;
        if (a.legen) action = { type: 'legen', yes: false };
        else if (a.bid) action = { type: 'bid', play: seat === (h.dealer + 1) % 4 && a.bid.spiel };
        else if (a.duel) action = { type: 'duel', choice: 'pass' };
        else if (a.choose) action = { type: 'choose', contract: a.choose[0] };
        else action = { type: 'play', card: a.play[0] };
        room.act(tokens[seat], action);
        if (++guard > 100) throw new Error('hängt');
      }
      expect(room.data.history).toHaveLength(game + 1);
      for (const t of tokens) room.ready(t);
    }
    expect(room.data.balance.reduce((a, b) => a + b, 0)).toBe(0);
    expect(room.data.dealer).toBe((firstDealer + 6) % 4);
    expect(room.data.handNo).toBe(7);
  });
});
