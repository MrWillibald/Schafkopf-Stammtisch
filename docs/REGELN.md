# Regeln, wie die App sie spielt

Dieses Dokument beschreibt, wie die Spiel-Engine (`src/engine`) Schafkopf umsetzt.
Was hier steht, ist durch Tests abgesichert (`npm test`). Wenn eure Runde etwas anders
spielt: hier anpassen, dann im Code.

## Einstellbar beim Anlegen der Runde

| Einstellung | Auswahl | Standard |
|---|---|---|
| Blatt | langes (32 Karten, 8 pro Spieler) / kurzes (24 Karten, 6 pro Spieler) | lang |
| Spielarten | Sauspiel, Farbsolo, Wenz, Geier, Farbwenz, Farbgeier | Sauspiel, Farbsolo, Wenz |
| Tout | an / aus | an |
| Wenn alle „weiter" sagen | Zusammenwerfen / Ramsch | Zusammenwerfen |
| Tarif Sauspiel | in Cent | 10 ct |
| Tarif Solo | in Cent (gilt für alle Soli inkl. Wenz/Geier) | 30 ct |
| Laufende | in Cent pro Laufendem | 10 ct |
| Laufende ab | normal / bei Wenz und Geier | 3 / 2 |
| Schneider/Schwarz | in Cent, **nicht kumulativ** (Schwarz = Schneider) | 10 ct |

Die Regeln kann der Gastgeber bis zum ersten Spiel ändern.

## Ablauf eines Spiels

1. **Geben**: Der Geber wechselt jedes Spiel im Uhrzeigersinn. Vorhand ist links vom Geber.
2. **Legen**: Nach den ersten 4 Karten (kurzes Blatt: 3) entscheidet jeder ab Vorhand,
   ob er legt. Jedes Legen verdoppelt. **Höchstens dreimal → 8-fach.** Danach wird nicht
   mehr gefragt.
3. **Rest geben**. Hat jemand alle vier Ober und alle vier Unter, ist das eine **Sie**
   (nur langes Blatt): Sie wird in der Ruhmeshalle verewigt, **nicht gespielt und nicht
   ausbezahlt**, der nächste Geber gibt.
4. **Reizen**: Jeder sagt ab Vorhand „Ich spiel" oder „Weiter".
   - **Wer gelegt hat, muss „Ich spiel" sagen** (sofern er überhaupt ein erlaubtes Spiel hat).
   - Wollen mehrere spielen, hat der Vordere Vorrang. Ein Hinterer muss eine höhere Stufe
     bieten (Sauspiel < Solo < Tout); der Vordere darf „mitgehen" (halten). Wer überboten
     wird, muss nicht spielen – auch nicht, wenn er gelegt hat.
   - Sagen alle weiter: je nach Einstellung zusammenwerfen oder Ramsch.
5. **Ansagen**: Der Gewinner des Reizens wählt sein Spiel (mindestens die gebotene Stufe).
   Ein Sauspiel geht nur auf eine Farbsau (nicht Herz), die man nicht selbst hat, und nur
   mit mindestens einer Karte dieser Farbe.
6. **Kontra / Re**: Die Gegenspieler können Kontra geben, die Spielpartei danach Re –
   jeweils verdoppelnd und **solange der erste Stich nicht fertig ist**. Der Gesamtfaktor
   ist auf **16-fach** gedeckelt: Bei 8-fach gelegt geht also nur noch Kontra.
7. **Spielen**: Farbe bzw. Trumpf muss bedient werden.

## Trümpfe

| Spiel | Trümpfe (höchster zuerst) |
|---|---|
| Sauspiel, Ramsch | Ober (E G H S), Unter (E G H S), Herz A 10 K 9 8 7 |
| Farbsolo | Ober, Unter, Trumpffarbe A 10 K 9 8 7 |
| Wenz | nur die vier Unter; Ober zählt als Farbkarte zwischen König und Neun |
| Farbwenz | Unter, dann Trumpffarbe A 10 K O 9 8 7 |
| Geier | nur die vier Ober; Unter zählt als Farbkarte zwischen König und Neun |
| Farbgeier | Ober, dann Trumpffarbe A 10 K U 9 8 7 |

## Rufsau (Sauspiel)

- Wird die gerufene Farbe angespielt, **muss die Rufsau zugegeben werden**.
- Die Rufsau darf **nicht geschmiert** (abgeworfen) werden, solange die Farbe nicht
  gesucht wurde – außer im letzten Stich.
- Wer die Rufsau hat, darf die Farbe nur mit der Sau anspielen – außer er hat
  **mindestens 4 Karten** dieser Farbe (kurzes Blatt: 3), dann darf er **davonlaufen**.
- Der Partner wird für alle sichtbar, sobald die Rufsau fällt.

## Abrechnung

- **Gewonnen** hat die Spielpartei mit mindestens 61 Augen. Tout ist nur mit allen Stichen
  gewonnen.
- **Schneider**: Verlierer hat höchstens 30 Augen. **Schwarz**: Verlierer hat keinen Stich.
  Beides gibt denselben Zuschlag, er zählt nur einmal.
- **Laufende**: ununterbrochene höchste Trümpfe einer Partei (egal welcher), ab der
  eingestellten Mindestanzahl. Sie zählen auch, wenn die Spielpartei verliert.
- **Wert** = (Grundtarif + Schneider/Schwarz + Laufende × Tarif) × 2^(Legen + Kontra + Re),
  höchstens ×16.
- **Tout**: Grundtarif + Laufende, alles **×2**. Kein Schneider/Schwarz-Zuschlag.
- **Sauspiel**: Jeder der Spielpartei bekommt bzw. zahlt den Wert von je einem Gegner.
- **Solo**: Der Solist bekommt bzw. zahlt den Wert von jedem der drei Gegner.
- **Ramsch** (falls eingestellt): Wer die meisten Augen hat, zahlt jedem anderen den
  Sauspiel-Tarif (× Legen). Bei Gleichstand zahlen alle mit den meisten Augen. Macht
  jemand alle Stiche (Durchmarsch), bekommt er von jedem den Tarif.

## Noch nicht umgesetzt

Bettel, Hochzeit, Ramsch-Sonderregeln (Jungfrau, Schieben), Klopfen statt Legen,
Stock, Spiele mit 3 oder 5+ Spielern.
