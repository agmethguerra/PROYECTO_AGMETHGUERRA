// =============================================================================
// ActivitySystem: acciones con duración (comer, beber, dormir, ducharse...).
// El cliente solo pide "usar el objeto X con la acción Y"; el servidor valida distancia,
// ingredientes y tiempo, y es quien aplica los efectos al terminar.
// =============================================================================
import { EVENTS } from "../../shared/config/events.js";
import { createMessage } from "../../shared/protocol/messages.js";
import { NEED_IDS } from "./NeedsSystem.js";

const MAX_DISTANCE = 2; // celdas (Manhattan) entre el jugador y el objeto
const clamp = (v) => Math.min(100, Math.max(0, v));

export class ActivitySystem {
  /** ctx: { getSocket, sendToSocket, broadcastToZone, say, sendInventory } */
  constructor(world, ctx) {
    this.world = world;
    this.ctx = ctx;
  }

  start(player, { objectId, action }) {
    const reject = (text) => { this.ctx.say(player, text); return false; };
    const zones = this.world.zoneManager;
    const zone = zones.getZone(player.zoneId);
    const def = zones.interactions[action];
    if (!zone || !def || typeof objectId !== "string") return false;
    if (!player.needs) return false;
    if (player.activity) return reject("Ya estás ocupado.");

    const obj = zone.objects.find((o) => o.id === objectId);
    if (!obj || !obj.actions.includes(action)) return false;
    // Distancia al rectángulo del objeto (Manhattan)
    const dx = Math.max(obj.x - player.x, 0, player.x - (obj.x + obj.w - 1));
    const dy = Math.max(obj.y - player.y, 0, player.y - (obj.y + obj.h - 1));
    if (dx + dy > MAX_DISTANCE) return reject("Acércate más al objeto.");

    for (const [item, qty] of Object.entries(def.consumes || {})) {
      if ((player.inventory?.[item] || 0) < qty) return reject("No tienes raciones. Cuando abra el mercado podrás comprar más.");
    }
    if (def.endsWhenFull && player.needs[def.endsWhenFull] >= 99) return reject("No lo necesitas ahora.");

    player.path = []; // se queda quieto
    player.activity = { action, def, objectId, startedAt: Date.now(), lastTickAt: Date.now() };
    const ws = this.ctx.getSocket(player);
    if (ws) this.ctx.sendToSocket(ws, createMessage(EVENTS.ACTIVITY_START, { action, label: def.label, durationMs: def.durationMs }));
    this.ctx.broadcastToZone(player.zoneId, createMessage(EVENTS.PLAYER_STATUS, { id: player.id, text: def.status || def.label }), null);
    return true;
  }

  /** Cancela la actividad en curso (si hay). Lo ya ganado por tasa (dormir) se conserva. */
  cancel(player, reason = "cancelled") {
    if (!player?.activity) return;
    this.finish(player, false, reason);
  }

  tick(now = Date.now()) {
    for (const p of this.world.playerManager.players.values()) {
      const a = p.activity;
      if (!a) continue;
      const dt = Math.max(0, (now - a.lastTickAt) / 1000);
      a.lastTickAt = now;
      if (a.def.ratePerSec) {
        for (const [id, rate] of Object.entries(a.def.ratePerSec)) if (NEED_IDS.includes(id)) p.needs[id] = clamp(p.needs[id] + rate * dt);
      }
      const full = a.def.endsWhenFull && p.needs[a.def.endsWhenFull] >= 100;
      if (full || now - a.startedAt >= a.def.durationMs) this.finish(p, true);
    }
  }

  finish(player, completed) {
    const a = player.activity;
    if (!a) return;
    player.activity = null;
    const { def } = a;
    let ok = completed;
    if (completed) {
      // Ingredientes: se consumen al terminar (si los gastó en otro lado, no hay efecto)
      for (const [item, qty] of Object.entries(def.consumes || {})) {
        if ((player.inventory?.[item] || 0) < qty) ok = false;
      }
      if (ok) {
        for (const [item, qty] of Object.entries(def.consumes || {})) {
          player.inventory[item] -= qty;
          if (player.inventory[item] <= 0) delete player.inventory[item];
        }
        for (const [id, v] of Object.entries(def.effects || {})) if (NEED_IDS.includes(id)) player.needs[id] = clamp(player.needs[id] + v);
        for (const [id, v] of Object.entries(def.set || {})) if (NEED_IDS.includes(id)) player.needs[id] = clamp(v);
        if (def.consumes) this.ctx.sendInventory(player);
      }
    }
    const ws = this.ctx.getSocket(player);
    if (ws) this.ctx.sendToSocket(ws, createMessage(EVENTS.ACTIVITY_END, { action: a.action, completed: ok }));
    this.ctx.broadcastToZone(player.zoneId, createMessage(EVENTS.PLAYER_STATUS, { id: player.id, text: null }), null);
  }
}
