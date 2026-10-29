// Almacén para MODO DESARROLLO: un único JSON en .data/players.json.
// Misma interfaz que SupabaseStore, así el resto del código no sabe cuál usa.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export class LocalFileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};
    this.timer = null;
    if (existsSync(filePath)) {
      try {
        this.data = JSON.parse(readFileSync(filePath, "utf-8"));
      } catch (e) {
        console.error("[LocalFileStore] Archivo corrupto, se empieza vacío:", e.message);
      }
    }
  }

  async load(uid) {
    const p = this.data[uid];
    return p ? JSON.parse(JSON.stringify(p)) : null;
  }

  /**
   * Libro contable local (misma regla que la función apply_ledger de Postgres):
   * rechaza saldos negativos y no repite un movimiento con la misma idempotency key.
   * @returns {{ok:boolean, balance:number, duplicate:boolean}}
   */
  async applyLedger(uid, delta, reason, { ref = null, key = null } = {}) {
    const profile = this.data[uid];
    if (!profile) throw new Error("player_not_found");
    this.ledger = this.ledger || (this.data._ledger ||= []);
    if (key) {
      if (this.ledger.some((l) => l.uid === uid && l.key === key)) return { ok: true, balance: profile.balance || 0, duplicate: true };
    }
    const balance = profile.balance || 0;
    if (balance + delta < 0) return { ok: false, balance, duplicate: false };
    profile.balance = balance + delta;
    this.ledger.push({ uid, delta, balanceAfter: profile.balance, reason, ref, key, at: Date.now() });
    this.scheduleFlush();
    return { ok: true, balance: profile.balance, duplicate: false };
  }

  scheduleFlush() {
    if (!this.timer) this.timer = setTimeout(() => this.flushSync(), 300);
  }

  async save(uid, data) {
    // El saldo solo cambia por applyLedger: un guardado normal nunca lo toca
    const { balance, ...safe } = JSON.parse(JSON.stringify(data));
    this.data[uid] = { ...(this.data[uid] || {}), ...safe };
    // Escritura diferida: agrupa varios guardados seguidos en un solo acceso a disco
    this.scheduleFlush();
  }

  flushSync() {
    clearTimeout(this.timer);
    this.timer = null;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.filePath); // reemplazo atómico: nunca queda a medias
  }

  async flush() {
    if (this.timer) this.flushSync();
  }
}
