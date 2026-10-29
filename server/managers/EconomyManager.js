// =============================================================================
// EconomyManager: ÚNICA puerta para tocar el dinero (Infinitas) de un jugador.
// - Cuentas: cada movimiento pasa por el libro contable del almacén (Postgres o archivo dev).
// - Invitados: cartera solo en memoria (150 al entrar, se pierde al salir).
// - Operaciones de un mismo jugador en cola; nunca saldo negativo.
// =============================================================================
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class EconomyManager {
  /** notify(player, {balance, delta, reason}) avisa al cliente */
  constructor(store, notify) {
    this.store = store;
    this.notify = notify || (() => {});
    const cfg = JSON.parse(readFileSync(join(__dirname, "../../data/economy.json"), "utf-8"));
    this.currency = cfg.currency;
  }

  /** Al entrar: da los fondos iniciales UNA vez por cuenta (clave idempotente) y carga el saldo. */
  async open(player, savedBalance = 0) {
    if (!player.uid) { player.balance = this.currency.startingFunds; return player.balance; }
    player.balance = savedBalance;
    const r = await this.credit(player, this.currency.startingFunds, "welcome_grant", {
      key: `welcome_grant:${player.uid}`, silent: true
    });
    return r.balance;
  }

  debit(player, amount, reason, opts = {}) { return this.change(player, -this.valid(amount), reason, opts); }
  credit(player, amount, reason, opts = {}) { return this.change(player, this.valid(amount), reason, opts); }

  valid(a) {
    if (!Number.isInteger(a) || a < 0) throw new Error(`Cantidad inválida: ${a}`);
    return a;
  }

  change(player, delta, reason, { ref = null, key = null, silent = false } = {}) {
    const run = (player._econQueue || Promise.resolve()).then(async () => {
      if (delta === 0) return { ok: true, balance: player.balance, duplicate: false };
      let r;
      if (player.uid) r = await this.store.applyLedger(player.uid, delta, reason, { ref, key });
      else if (player.balance + delta >= 0) r = { ok: true, balance: player.balance + delta, duplicate: false };
      else r = { ok: false, balance: player.balance, duplicate: false };
      player.balance = r.balance;
      if (r.ok && !r.duplicate && !silent) this.notify(player, { balance: r.balance, delta, reason });
      return r;
    });
    player._econQueue = run.catch(() => {});
    return run;
  }
}
