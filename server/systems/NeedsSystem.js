// =============================================================================
// NeedsSystem: necesidades y salud del personaje (todo definido en data/needs/needs.json).
// - Cada necesidad baja 1 punto cada `secondsPerPoint` segundos (solo mientras estás conectado).
// - Una necesidad en 0 daña la salud, y el daño crece cuanto más tiempo sigue en 0.
// - Con la salud en 0 el personaje se desmaya: multa, vuelve a casa y se recupera un poco.
// =============================================================================
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { EVENTS } from "../../shared/config/events.js";
import { createMessage } from "../../shared/protocol/messages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CFG = JSON.parse(readFileSync(join(__dirname, "../../data/needs/needs.json"), "utf-8"));
export const NEED_IDS = Object.keys(CFG.needs);
const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const round2 = (v) => Math.round(v * 100) / 100;

export function defaultNeeds() {
  const n = { health: 100, zero: {}, regenAcc: 0 };
  for (const id of NEED_IDS) n[id] = 100;
  return n;
}

/** Valida lo guardado: números dentro de rango; lo que falte, a 100. */
export function normalizeNeeds(raw) {
  const n = defaultNeeds();
  if (!raw || typeof raw !== "object") return n;
  if (Number.isFinite(raw.health)) n.health = clamp(raw.health);
  for (const id of NEED_IDS) if (Number.isFinite(raw[id])) n[id] = clamp(raw[id]);
  for (const id of NEED_IDS) {
    const z = raw.zero?.[id];
    if (Number.isFinite(z) && z > 0 && z < 1e7) n.zero[id] = z;
  }
  return n;
}

export function packNeeds(n) {
  const out = { health: round2(n.health), zero: {} };
  for (const id of NEED_IDS) out[id] = round2(n[id]);
  for (const [id, z] of Object.entries(n.zero || {})) if (z > 0) out.zero[id] = Math.round(z);
  return out;
}

export function publicNeeds(n) {
  const needs = {};
  for (const id of NEED_IDS) needs[id] = Math.round(n[id]);
  return { health: Math.round(n.health), needs };
}

export class NeedsSystem {
  /** ctx: { getSocket(player), sendToSocket, sendHome(player), economy, activity, say(player,text) } */
  constructor(world, ctx) {
    this.world = world;
    this.ctx = ctx;
    this.cfg = CFG;
  }

  tick(now = Date.now()) {
    for (const p of this.world.playerManager.players.values()) {
      if (!p.needs || p.onboarded === false) continue;
      const dt = Math.min(5, Math.max(0, (now - (p._needsAt || now)) / 1000));
      p._needsAt = now;
      if (dt > 0) this.advance(p, dt);
    }
  }

  advance(p, dt) {
    const n = p.needs;
    const mult = p.activity?.def?.decayMultiplier ?? 1;
    let drain = 0;
    for (const id of NEED_IDS) {
      const def = CFG.needs[id];
      n[id] = clamp(n[id] - (dt / def.secondsPerPoint) * mult);
      if (n[id] <= 0) {
        if (def.onZero?.type === "accident") {
          this.accident(p);
        } else if (def.onZero?.type === "health") {
          n.zero[id] = (n.zero[id] || 0) + dt;
          const minutes = n.zero[id] / 60;
          drain += ((def.onZero.basePerMin + def.onZero.growthPerMin * minutes) / 60) * dt;
        }
      } else if (n.zero[id]) {
        delete n.zero[id];
      }
    }
    if (drain > 0) {
      n.health = clamp(n.health - drain);
      n.regenAcc = 0;
    } else if (n.health < 100) {
      const req = CFG.health.regen.requireAtLeast;
      if (Object.entries(req).every(([id, min]) => n[id] >= min)) {
        n.regenAcc += dt;
        if (n.regenAcc >= CFG.health.regen.intervalSec) {
          n.regenAcc = 0;
          n.health = clamp(n.health + CFG.health.regen.amount);
        }
      }
    }
    if (n.health <= 0) this.faint(p);
    this.push(p);
  }

  accident(p) {
    const n = p.needs;
    n.bladder = CFG.accident.bladderAfter;
    n.hygiene = clamp(n.hygiene - CFG.accident.hygienePenalty);
    this.ctx.say(p, "💧 No llegaste a tiempo al baño. Tu higiene bajó.");
  }

  async faint(p) {
    const n = p.needs;
    this.ctx.activity?.cancel(p, "Te desmayaste");
    n.health = CFG.faint.healthAfter;
    for (const id of NEED_IDS) if (id !== "hygiene") n[id] = Math.max(n[id], CFG.faint.minNeedsAfter);
    n.zero = {};
    n.regenAcc = 0;
    let fine = 0;
    try {
      const have = p.balance || 0;
      fine = Math.min(have, CFG.faint.fine);
      if (fine > 0) await this.ctx.economy.debit(p, fine, "faint_fine");
    } catch (e) {
      console.error("[Needs] multa:", e.message);
    }
    this.ctx.say(p, `🏥 Te desmayaste y te llevaron a casa.${fine ? ` El hospital cobró ${fine} Infinitas.` : ""}`);
    this.ctx.sendHome(p);
    this.push(p, true);
  }

  /** Avisa al cliente solo si lo que ve (enteros) cambió. */
  push(p, force = false) {
    const pub = publicNeeds(p.needs);
    const key = JSON.stringify(pub);
    if (!force && key === p._needsSent) return;
    p._needsSent = key;
    const ws = this.ctx.getSocket(p);
    if (ws) this.ctx.sendToSocket(ws, createMessage(EVENTS.NEEDS_UPDATE, pub));
  }
}
