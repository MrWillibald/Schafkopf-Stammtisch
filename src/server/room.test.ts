import { describe, expect, it } from 'vitest';
import { type Action, DEFAULT_RULES, allowedActions } from '../engine';
import { Room, RoomError } from './room';

function setup() {
  const room = Room.create('Testrunde', DEFAULT_RULES);
  const tokens = ['Sepp', 'Hias', 'Vroni', 'Gustl'].map((n) => room.join(undefined, n).token);
  return { room, tokens };
}

function playOut(room: Room, tokens: string[], declarerWants: (seat: number, dealer: number) => boolean) {
  let guard = 0;
  while (room.data.hand!.phase !== 'done') {
    const h = room.data.hand!;
    const seat = h.turn!;
    const a = allowedActions(h, seat);
    let action: Action;
    if (a.legen) action = { type: 'legen', yes: false };
    else if (a.bid) action = { type: 'bid', play: a.bid.spiel && declarerWants(seat, h.dealer) };
    else if (a.duel) action = { type: 'duel', choice: 'pass' };
    else if (a.choose) action = { type: 'choose', contract: a.choose[0] };
    else action = { type: 'play', card: a.play[0] };
    room.act(tokens[seat], action);
    if (++guard > 100) throw new Error('hängt');
  }
  for (const t of tokens) room.ready(t);
}

describe('Umbenennen', () => {
  it('jeder ändert seinen eigenen Namen, doppelte Namen sind verboten', () => {
    const { room, tokens } = setup();
    room.rename(tokens[1], '  Hias  der Zweite ');
    expect(room.data.players[1].name).toBe('Hias der Zweite');
    expect(() => room.rename(tokens[1], 'sepp')).toThrow(/vergeben/);
    expect(() => room.rename(tokens[1], '   ')).toThrow(/Namen/);
    // Groß-/Kleinschreibung des eigenen Namens darf man ändern
    room.rename(tokens[0], 'SEPP');
    expect(room.data.players[0].name).toBe('SEPP');
  });

  it('fremde Namen nur der Gastgeber und nur bei Computer-Mitspielern', () => {
    const room = Room.create('x', DEFAULT_RULES);
    const host = room.join(undefined, 'Sepp').token;
    const guest = room.join(undefined, 'Hias').token;
    room.addBot(host);
    expect(() => room.rename(guest, 'Hacker', 0)).toThrow(/eigenen/);
    expect(() => room.rename(guest, 'Bot', 2)).toThrow(/eigenen/);
    expect(() => room.rename(host, 'Hiasl', 1)).toThrow(/eigenen/);
    room.rename(host, 'Kare (PC)', 2);
    expect(room.data.players[2].name).toBe('Kare (PC)');
  });

  it('Ruhmeshalle wandert mit, Verlauf zeigt den neuen Namen', () => {
    const { room, tokens } = setup();
    room.data.sie.push({ name: 'Vroni', seat: 2, at: '2026-01-01', cards: [] });
    room.data.sie.push({ name: 'Gustl', at: '2026-01-02', cards: [] }); // alter Eintrag ohne Platz
    room.rename(tokens[2], 'Veronika');
    room.rename(tokens[3], 'Gustav');
    expect(room.data.sie.map((e) => e.name)).toEqual(['Veronika', 'Gustav']);
    const v = room.view(tokens[0], () => true);
    expect(v.players.find((p) => p.seat === 2)?.name).toBe('Veronika');
  });
});

describe('Zusammenwerfen über mehrere Spiele', () => {
  it('doppelt: das nächste gespielte Spiel zählt doppelt, mehrfach hintereinander verdoppelt weiter', () => {
    const room = Room.create('x', { ...DEFAULT_RULES, redeal: 'double' });
    const tokens = ['A', 'B', 'C', 'D'].map((n) => room.join(undefined, n).token);
    room.start(tokens[0]);
    playOut(room, tokens, () => false);
    expect(room.data.pendingDoubles).toBe(1);
    playOut(room, tokens, () => false);
    expect(room.data.pendingDoubles).toBe(2);
    expect(room.data.hand!.bock).toBe(2);
    playOut(room, tokens, (seat, dealer) => seat === (dealer + 1) % 4);
    const last = room.data.history.at(-1)!.result;
    expect(last.kind).toBe('game');
    expect(last.multiplier).toBe(4);
    expect(room.data.pendingDoubles).toBe(0);
  });

  it('Stock: wird eingezahlt und bleibt in Summe ausgeglichen', () => {
    const room = Room.create('x', { ...DEFAULT_RULES, redeal: 'stock' });
    const tokens = ['A', 'B', 'C', 'D'].map((n) => room.join(undefined, n).token);
    room.start(tokens[0]);
    playOut(room, tokens, () => false);
    playOut(room, tokens, () => false);
    expect(room.data.stock).toBe(80);
    expect(room.data.balance).toEqual([-20, -20, -20, -20]);
    for (let i = 0; i < 20; i++) playOut(room, tokens, (seat, dealer) => seat === (dealer + 1) % 4);
    expect(room.data.balance.reduce((a, b) => a + b, 0) + (room.data.stock ?? 0)).toBe(0);
  });
});

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
