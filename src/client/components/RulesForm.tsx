import type { Rules } from '../../engine';

interface Props {
  rules: Rules;
  onChange: (r: Rules) => void;
  disabled?: boolean;
}

const GAME_LABELS: [keyof Rules['games'], string][] = [
  ['sauspiel', 'Sauspiel'],
  ['farbsolo', 'Farbsolo'],
  ['wenz', 'Wenz'],
  ['geier', 'Geier'],
  ['farbwenz', 'Farbwenz'],
  ['farbgeier', 'Farbgeier'],
];

function CentInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="field field--inline">
      <span>{label}</span>
      <span className="cent-input">
        <input
          type="number"
          min={0}
          step={5}
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        />
        <span>ct</span>
      </span>
    </label>
  );
}

export function RulesForm({ rules, onChange, disabled }: Props) {
  const set = (patch: Partial<Rules>) => onChange({ ...rules, ...patch });
  const setGame = (k: keyof Rules['games'], v: boolean) => {
    const games = { ...rules.games, [k]: v };
    if (!Object.values(games).some(Boolean)) return; // mindestens eine Spielart
    set({ games });
  };
  const setTariff = (k: keyof Rules['tariff'], v: number) => set({ tariff: { ...rules.tariff, [k]: v } });

  return (
    <div className="rules-form">
      <fieldset disabled={disabled}>
        <legend>Blatt</legend>
        <div className="segmented">
          <label className={rules.deck === 'long' ? 'active' : ''}>
            <input type="radio" name="deck" checked={rules.deck === 'long'} onChange={() => set({ deck: 'long' })} />
            Langes Blatt <small>32 Karten</small>
          </label>
          <label className={rules.deck === 'short' ? 'active' : ''}>
            <input type="radio" name="deck" checked={rules.deck === 'short'} onChange={() => set({ deck: 'short' })} />
            Kurzes Blatt <small>24 Karten</small>
          </label>
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend>Spielarten</legend>
        <div className="checks">
          {GAME_LABELS.map(([k, label]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={rules.games[k]} onChange={(e) => setGame(k, e.target.checked)} />
              {label}
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={rules.tout} onChange={(e) => set({ tout: e.target.checked })} />
            Tout (×2)
          </label>
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend>Wenn alle „weiter" sagen</legend>
        <div className="segmented">
          <label className={rules.allPass === 'redeal' ? 'active' : ''}>
            <input type="radio" name="allpass" checked={rules.allPass === 'redeal'} onChange={() => set({ allPass: 'redeal' })} />
            Zusammenwerfen
          </label>
          <label className={rules.allPass === 'ramsch' ? 'active' : ''}>
            <input type="radio" name="allpass" checked={rules.allPass === 'ramsch'} onChange={() => set({ allPass: 'ramsch' })} />
            Ramsch
          </label>
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend>Tarif</legend>
        <div className="tariffs">
          <CentInput label="Sauspiel" value={rules.tariff.game} onChange={(v) => setTariff('game', v)} />
          <CentInput label="Solo" value={rules.tariff.solo} onChange={(v) => setTariff('solo', v)} />
          <CentInput label="pro Laufendem" value={rules.tariff.laufende} onChange={(v) => setTariff('laufende', v)} />
          <CentInput label="Schneider / Schwarz" value={rules.tariff.schneider} onChange={(v) => setTariff('schneider', v)} />
          <label className="field field--inline">
            <span>Laufende ab</span>
            <select value={rules.laufendeMin} onChange={(e) => set({ laufendeMin: Number(e.target.value) })}>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="field field--inline">
            <span>… bei Wenz/Geier ab</span>
            <select value={rules.laufendeMinWenzGeier} onChange={(e) => set({ laufendeMinWenzGeier: Number(e.target.value) })}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="hint">Legen nach den ersten {rules.deck === 'long' ? 'vier' : 'drei'} Karten, bis 8-fach. Mit Kontra/Re höchstens 16-fach.</p>
      </fieldset>
    </div>
  );
}
