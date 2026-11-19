import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RoomData } from './room';

/**
 * Speichert jede Runde als JSON-Datei. Auf Render (Free) ist das Dateisystem
 * flüchtig – mit einer Persistent Disk (oder lokal) bleiben die Runden erhalten.
 */
export class FileStore {
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private dir: string) {}

  async init() {
    await mkdir(this.dir, { recursive: true });
  }

  async loadAll(maxAgeDays: number): Promise<RoomData[]> {
    const out: RoomData[] = [];
    const cutoff = Date.now() - maxAgeDays * 86400_000;
    for (const f of await readdir(this.dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(await readFile(join(this.dir, f), 'utf8')) as RoomData;
        if (Date.parse(data.updatedAt) < cutoff) {
          await unlink(join(this.dir, f));
          continue;
        }
        out.push(data);
      } catch (e) {
        console.warn(`Konnte ${f} nicht laden:`, e);
      }
    }
    return out;
  }

  /** Verzögertes Speichern, damit schnelle Spielzüge nicht jedes Mal schreiben. */
  save(data: RoomData) {
    clearTimeout(this.timers.get(data.id));
    this.timers.set(
      data.id,
      setTimeout(() => {
        this.timers.delete(data.id);
        void this.write(data);
      }, 500),
    );
  }

  private async write(data: RoomData) {
    const file = join(this.dir, `${data.id}.json`);
    try {
      await writeFile(`${file}.tmp`, JSON.stringify(data));
      await rename(`${file}.tmp`, file);
    } catch (e) {
      console.error('Speichern fehlgeschlagen:', e);
    }
  }

  async flush(rooms: Iterable<RoomData>) {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    await Promise.all([...rooms].map((r) => this.write(r)));
  }
}
