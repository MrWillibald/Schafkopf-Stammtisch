# Schafkopf-Stammtisch

Eine private Schafkopf-Runde im Browser – für vier Freunde, die sich nicht mehr so oft
am echten Stammtisch treffen. Runde anlegen, Einladungslink teilen, spielen.

- Läuft am Handy und am Rechner, ohne Account (Name + Einladungslink)
- Langes oder kurzes Blatt, Spielarten und Tarif pro Runde einstellbar
- Legen bis 8-fach, Kontra/Re, Tout als Zusatzansage, Laufende, Schneider/Schwarz
- Eigenes Blatt im Stil des bayerischen Bildes (Übersicht unter `/karten`)
- Laufende Abrechnung mit Saldo pro Spieler, Ruhmeshalle für jede **Sie**
- Wer die Seite neu lädt oder kurz die Verbindung verliert, sitzt sofort wieder am Tisch

Die genauen Regeln stehen in [docs/REGELN.md](docs/REGELN.md).

## Aufbau

```
src/engine   Spielregeln als reine TypeScript-Funktionen (ohne Server/Browser), mit Tests
src/server   Node + Express + Socket.io: Runden, Sitzplätze, Spielverlauf, Speicherung
src/client   React-App (Vite): Startseite, Lobby, Spieltisch, Abrechnung
src/shared   Nachrichtenformat zwischen Client und Server
```

Der Server ist die einzige Instanz, die mischt und Regeln prüft. Jeder Client bekommt
nur seine eigenen Karten zu sehen.

## Lokal starten

```bash
npm install
npm run dev        # Server auf :3001, App auf http://localhost:5173
npm test           # Regel-Tests (inkl. 3000 Zufallsspiele)
npm run typecheck
```

Produktionsbuild: `npm run build && npm start` → http://localhost:3001

## Auf Render veröffentlichen

1. Repository bei [render.com](https://render.com) verbinden → **New → Blueprint**.
   Die Datei `render.yaml` richtet den Web-Service automatisch ein.
2. Fertig – die App läuft unter `https://<name>.onrender.com`.

Hinweise zum **Free-Plan**:

- Der Dienst schläft nach ~15 Minuten ohne Besucher ein; der erste Aufruf dauert dann
  etwa eine Minute.
- Das Dateisystem ist flüchtig: Nach einem Neustart/Einschlafen sind laufende Runden,
  Saldo und Ruhmeshalle weg. Für dauerhafte Speicherung: Starter-Plan (~7 $/Monat) mit
  einer *Persistent Disk* und `DATA_DIR` auf den Disk-Pfad setzen – oder als nächster
  Schritt eine kostenlose Datenbank anbinden.

## Umgebungsvariablen

| Variable | Bedeutung | Standard |
|---|---|---|
| `PORT` | HTTP-Port | `3001` |
| `DATA_DIR` | Ordner für gespeicherte Runden (JSON) | `data/rooms` |
| `ROOM_MAX_AGE_DAYS` | Runden ohne Aktivität werden danach gelöscht | `90` |
