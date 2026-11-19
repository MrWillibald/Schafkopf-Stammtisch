# Regeln, wie die App sie spielt

Dieses Dokument beschreibt, wie die Spiel-Engine (`src/engine`) Schafkopf umsetzt.
Was hier steht, ist durch Tests abgesichert (`npm test`). Wenn eure Runde etwas anders
spielt: hier anpassen, dann im Code.

## Einstellbar beim Anlegen der Runde

| Einstellung | Auswahl | Standard |
|---|---|---|
| Blatt | langes (32 Karten, 8 pro Spieler) / kurzes (24 Karten, 6 pro Spieler) | lang |
| Spielarten | Sauspiel, Solo, Wenz, Geier, Farbwenz, Farbgeier | Sauspiel, Solo, Wenz |
| Wenn alle „weiter" sagen | Zusammenwerfen / Ramsch | Zusammenwerfen |
| Nach dem Zusammenwerfen | nichts / nächstes Spiel doppelt / Stock | nichts |
| Stock | Einzahlung pro Spieler in Cent | 10 ct |
| Tarif Sauspiel | in Cent | 10 ct |
| Tarif Solo | in Cent (gilt für alle Soli inkl. Wenz/Geier) | 30 ct |
| Laufende | in Cent pro Laufendem | 10 ct |
| Laufende ab | normal / bei Wenz und Geier | 3 / 2 |
| Schneider/Schwarz | in Cent, **nicht kumulativ** (Schwarz = Schneider) | 10 ct |

Die Regeln kann der Gastgeber bis zum ersten Spiel ändern.

## Ablauf eines Spiels

1. **Geben**: Der Geber wechselt jedes Spiel im Uhrzeigersinn. Vorhand ist links vom Geber.
2. **Legen**: Nach den ersten 4 Karten (kurzes Blatt: 3) entscheidet jeder ab Vorhand,
   ob er legt. Jedes Legen verdoppelt. **Legen und eine Verdopplung durch Zusammenwerfen
   zählen zusammen höchstens 8-fach.** Ist 8-fach erreicht, wird nicht mehr gefragt (steht
   z. B. schon ×2 aus dem Zusammenwerfen an, dürfen nur noch zwei legen).
3. **Rest geben**. Hat jemand alle vier Ober und alle vier Unter, ist das eine **Sie**
   (nur langes Blatt): Sie wird in der Ruhmeshalle verewigt, **nicht gespielt und nicht
   ausbezahlt**, der nächste Geber gibt.
4. **Reizen**: Jeder sagt ab Vorhand „Ich spiel" oder „Weiter".
   - **Wer gelegt hat, muss „Ich spiel" sagen** (sofern er überhaupt ein erlaubtes Spiel hat).
   - Wollen mehrere spielen, hat der Vordere Vorrang. Ein Hinterer muss eine höhere Stufe
     bieten (Sauspiel < Solo; Wenz, Geier usw. zählen als Solo); der Vordere darf
     „mitgehen" (halten). Wer überboten wird, muss nicht spielen – auch nicht, wenn er
     gelegt hat. Tout ist beim Reizen keine eigene Stufe.
   - Sagen alle weiter: je nach Einstellung zusammenwerfen oder Ramsch.
5. **Ansagen**: Der Gewinner des Reizens wählt sein Spiel (mindestens die gebotene Stufe).
   Ein Sauspiel geht nur auf eine Farbsau (nicht Herz), die man nicht selbst hat, und nur
   mit mindestens einer Karte dieser Farbe. Zu einem Solo oder Wenz/Geier kann er
   zusätzlich **Tout** ansagen (kein eigenes Spiel, sondern eine Zusatzansage; nicht zum Sauspiel).
6. **Kontra / Re**: Ein Gegenspieler kann Kontra geben, **solange er selbst noch keine Karte
   gespielt hat**. Die Spielpartei kann danach Re geben, solange der erste Stich nicht fertig
   ist. Beides verdoppelt. Der Gesamtfaktor
   ist auf **16-fach** gedeckelt: Bei 8-fach geht also nur noch Kontra, kein Re mehr.
7. **Spielen**: Farbe bzw. Trumpf muss bedient werden.

## Trümpfe

| Spiel | Trümpfe (höchster zuerst) |
|---|---|
| Sauspiel, Ramsch | Ober (E G H S), Unter (E G H S), Herz A 10 K 9 8 7 |
| Solo | Ober, Unter, Trumpffarbe A 10 K 9 8 7 |
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

## Zusammenwerfen

Sagen alle „weiter" und ist Zusammenwerfen eingestellt, wird neu gegeben. Was danach passiert,
ist einstellbar:

- **Nichts**: einfach neu geben.
- **Nächstes Spiel doppelt**: Das nächste tatsächlich gespielte Spiel zählt doppelt. Wird
  mehrmals hintereinander zusammengeworfen, verdoppelt es sich weiter (×2, ×4, ×8). Legen und
  Zusammenwerfen zählen **zusammen höchstens 8-fach**; nur Kontra/Re können dann noch auf
  16-fach verdoppeln. Bei 16-fach ist in jedem Fall Schluss. Eine Sie verbraucht die
  Verdopplung nicht.
- **Stock**: Jeder zahlt den eingestellten Betrag in den Stock. Der Stock wird mit dem
  **nächsten gewonnenen Sauspiel** ausbezahlt und zu gleichen Teilen an die Spielpartei
  verteilt. Verlorene Sauspiele, Soli und Ramsch lassen den Stock liegen.
- **Sauspiel**: Jeder der Spielpartei bekommt bzw. zahlt den Wert von je einem Gegner.
- **Solo**: Der Solist bekommt bzw. zahlt den Wert von jedem der drei Gegner.
- **Ramsch** (falls eingestellt): Wer die meisten Augen hat, zahlt jedem anderen den
  Sauspiel-Tarif (× Legen). Bei Gleichstand zahlen alle mit den meisten Augen. Macht
  jemand alle Stiche (Durchmarsch), bekommt er von jedem den Tarif.

## Noch nicht umgesetzt

Bettel, Hochzeit, Ramsch-Sonderregeln (Jungfrau, Schieben), Klopfen statt Legen,
Stock, Spiele mit 3 oder 5+ Spielern.
