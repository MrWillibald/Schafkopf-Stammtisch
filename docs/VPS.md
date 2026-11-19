# Auf einem eigenen VPS betreiben (z. B. netcup)

Diese Anleitung bringt die App auf einen kleinen Linux-Server. Danach läuft sie dauerhaft
unter deiner eigenen Adresse, z. B. `https://schafkopf.deine-domain.de`, mit HTTPS, und
Runden, Saldo und Ruhmeshalle bleiben auch nach Neustarts und Updates erhalten.

Aufbau auf dem Server:

```
Internet ──► Caddy (Port 80/443, holt automatisch das HTTPS-Zertifikat)
                └──► App (Node.js, Port 3001, nur intern)
                        └──► Volume „schafkopf-data“ (gespeicherte Runden)
```

Beides läuft in Docker-Containern, gestartet mit `docker compose`.

## 1. VPS bestellen

- Ein kleiner Linux-VPS reicht völlig aus (1–2 CPU-Kerne, 1–2 GB RAM). Vier Spieler
  erzeugen praktisch keine Last.
- Als Betriebssystem **Ubuntu 24.04** oder **Debian 12** wählen.
- Nach der Bereitstellung bekommst du die **IP-Adresse** und das **root-Passwort**
  (bzw. hinterlegst einen SSH-Schlüssel).

## 2. Subdomain bei all-inkl auf den VPS zeigen lassen

Im KAS (Kundenadministration von all-inkl) bei den DNS-Einstellungen deiner Domain einen
Eintrag anlegen:

| Typ | Name | Wert |
|---|---|---|
| A | `schafkopf` | IP-Adresse des VPS |

Hat der VPS auch eine IPv6-Adresse, zusätzlich einen `AAAA`-Eintrag mit dieser Adresse.

Prüfen (am eigenen Rechner, kann ein paar Minuten bis Stunden dauern):

```bash
nslookup schafkopf.deine-domain.de
```

Erst wenn hier die IP des VPS erscheint, weitermachen – sonst kann Caddy kein Zertifikat holen.

## 3. Server einrichten

Per SSH anmelden:

```bash
ssh root@<IP-des-VPS>
```

System aktualisieren, automatische Sicherheitsupdates und Firewall einschalten:

```bash
apt update && apt upgrade -y
apt install -y git ufw unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades   # mit „Ja“ bestätigen

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443
ufw enable
```

Docker installieren (offizielles Installationsskript):

```bash
curl -fsSL https://get.docker.com | sh
docker --version
```

## 4. App holen

```bash
cd /opt
git clone https://github.com/MrWillibald/Schafkopf-Stammtisch.git schafkopf
cd schafkopf
```

Ist das Repository **privat**, braucht der Server einen Lesezugang. Am einfachsten mit
einem *Deploy Key*:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/schafkopf -N ""
cat ~/.ssh/schafkopf.pub
```

Den angezeigten Schlüssel auf GitHub unter *Repository → Settings → Deploy keys → Add deploy
key* eintragen (nur Lesezugriff). Dann klonen mit:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/schafkopf" git clone git@github.com:MrWillibald/Schafkopf-Stammtisch.git schafkopf
cd schafkopf
git config core.sshCommand "ssh -i ~/.ssh/schafkopf"
```

## 5. Domain eintragen und starten

```bash
cp .env.example .env
nano .env        # DOMAIN=schafkopf.deine-domain.de eintragen, speichern
docker compose up -d --build
```

Der erste Start dauert ein paar Minuten (Bauen der App). Danach:

```bash
docker compose ps          # beide Container sollten "running" bzw. "healthy" sein
docker compose logs caddy  # hier sieht man, ob das Zertifikat geholt wurde
```

Jetzt `https://schafkopf.deine-domain.de` im Browser öffnen – fertig.

## Updates einspielen

```bash
cd /opt/schafkopf
./deploy/update.sh
```

Das holt die neueste Version von GitHub, baut neu und startet die App neu. Laufende Runden
bleiben erhalten; wer gerade spielt, wird nach ein paar Sekunden automatisch wieder verbunden.

## Sicherung

```bash
./deploy/backup.sh
```

legt eine Sicherung aller Runden in `backups/` ab (die letzten 30 werden behalten).
Automatisch jede Nacht um 4 Uhr:

```bash
crontab -e
# Zeile hinzufügen:
0 4 * * * cd /opt/schafkopf && ./deploy/backup.sh >/dev/null 2>&1
```

Wiederherstellen einer Sicherung:

```bash
docker compose exec -T app sh -c 'rm -f /data/*.json && tar -C /data -xzf -' < backups/runden-JJJJ-MM-TT_HHMM.tar.gz
docker compose restart app
```

## Nützliche Befehle

| Zweck | Befehl |
|---|---|
| Status | `docker compose ps` |
| Logs der App | `docker compose logs -f app` |
| Neustart | `docker compose restart` |
| Stoppen | `docker compose down` (Daten bleiben erhalten) |

## Kosten und Aufwand

- VPS: ein paar Euro im Monat, je nach Tarif.
- Domain: läuft weiter bei all-inkl, es kommt nur der DNS-Eintrag dazu.
- HTTPS-Zertifikat: kostenlos (Let's Encrypt über Caddy, erneuert sich selbst).
