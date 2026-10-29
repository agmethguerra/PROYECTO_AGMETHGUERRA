// =============================================================================
// ProfileManager: puente entre los jugadores en memoria y el almacén persistente.
// Guarda SOLO lo que debe sobrevivir entre sesiones (nombre, apariencia, posición).
// En fases siguientes aquí se añadirán inventario, moneda, misiones...
// =============================================================================

import { defaultNeeds, normalizeNeeds, packNeeds } from "../systems/NeedsSystem.js";

const NAME_REGEX = /^[\p{L}\p{N}_ ]{3,16}$/u;
const STARTER_INVENTORY = { ration: 8 }; // raciones iniciales en la despensa (hasta que haya mercado)
const PROFILE_SCHEMA = 2;

/** Limpia un nombre de usuario; devuelve "" si no es aceptable. */
export function sanitizeName(raw) {
  if (typeof raw !== "string") return "";
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return NAME_REGEX.test(name) ? name : "";
}

export class ProfileManager {
  constructor(store, worldManager) {
    this.store = store;
    this.world = worldManager;
    this.uidToSocket = new Map(); // uid -> socketId (una sola sesión por cuenta)
    this.pendingSaves = new Map(); // uid -> Promise del guardado en curso
  }

  // ---- Sesiones --------------------------------------------------------------
  getSocketForUid(uid) {
    return this.uidToSocket.get(uid);
  }
  bindSession(uid, socketId) {
    this.uidToSocket.set(uid, socketId);
  }
  /** Solo libera si la sesión sigue siendo de ese socket (evita borrar la de un login más nuevo). */
  releaseSession(uid, socketId) {
    if (this.uidToSocket.get(uid) === socketId) this.uidToSocket.delete(uid);
  }

  /** Libera la cuenta que tuviera este socket (al desconectar). */
  releaseSocket(socketId) {
    for (const [uid, sid] of this.uidToSocket) {
      if (sid === socketId) this.uidToSocket.delete(uid);
    }
  }

  // ---- Carga ----------------------------------------------------------------
  /**
   * Devuelve los datos con los que debe empezar el jugador (perfil guardado o nuevo),
   * ya validados contra los datos actuales del juego.
   */
  async loadOrCreate(identity, requestedName) {
    // Si esta cuenta se está guardando ahora mismo (p. ej. al recargar la página),
    // esperamos a que termine para no leer datos viejos.
    await this.pendingSaves.get(identity.uid);
    const saved = await this.store.load(identity.uid);
    const isNew = !saved;

    const name =
      sanitizeName(saved?.name) ||
      sanitizeName(requestedName) ||
      sanitizeName(identity.displayName) ||
      `Jugador${Math.floor(1000 + Math.random() * 9000)}`;

    const gender = Math.random() < 0.5 ? "male" : "female";
    const appearance = saved?.appearance
      ? this.world.appearanceManager.validateAppearance(saved.appearance)
      : this.world.appearanceManager.getDefaultAppearance(gender);

    const housingId = saved?.housingId || null;
    const spot = this.resolveSpot(saved, housingId);
    return {
      isNew,
      name,
      appearance,
      ...spot,
      // Fase 5
      onboarded: saved?.onboarded === true,
      jobId: saved?.jobId || null,
      housingId,
      needs: normalizeNeeds(saved?.needs),
      inventory: this.cleanInventory(saved?.inventory, !saved?.onboarded),
      balance: Number.isFinite(saved?.balance) ? saved.balance : 0
    };
  }

  /**
   * El servidor NO se fía del archivo guardado: si la zona ya no existe o la celda
   * quedó bloqueada (el mapa cambió), se recoloca al jugador en el spawn del hub.
   */
  /** Inventario válido: solo cantidades enteras >= 0. Una cuenta sin onboarding recibe el inicial. */
  cleanInventory(raw, isStarter) {
    if (isStarter) return { ...STARTER_INVENTORY };
    const inv = {};
    for (const [k, v] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
      if (Number.isInteger(v) && v > 0 && v < 1e6) inv[k] = v;
    }
    return inv;
  }

  resolveSpot(saved, housingId = null) {
    const zones = this.world.zoneManager;
    // Zona privada: se guarda como "@home" porque el id real de la casa cambia en cada sesión
    if (saved?.zoneId === "@home" && housingId) {
      const tpl = zones.getZone(this.world.homeManager?.templateFor(housingId));
      const x = Math.floor(saved.x), y = Math.floor(saved.y);
      if (tpl && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < tpl.width && y < tpl.height &&
          !zones.isCellBlocked(tpl.id, x, y)) {
        return { zoneId: "@home", x, y, dir: ["up", "down", "left", "right"].includes(saved.dir) ? saved.dir : "down" };
      }
      if (tpl) return { zoneId: "@home", x: tpl.entrySpawn?.x ?? 1, y: tpl.entrySpawn?.y ?? 1, dir: "down" };
    }
    if (saved && zones.getZone(saved.zoneId) && !zones.getZone(saved.zoneId).template) {
      const x = Math.floor(saved.x);
      const y = Math.floor(saved.y);
      const zone = zones.getZone(saved.zoneId);
      const inside = Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < zone.width && y < zone.height;
      if (inside && !zones.isCellBlocked(saved.zoneId, x, y)) {
        return { zoneId: saved.zoneId, x, y, dir: ["up", "down", "left", "right"].includes(saved.dir) ? saved.dir : "down" };
      }
    }
    const spawn = zones.getRandomSpawn("hub");
    return { zoneId: "hub", x: spawn.x, y: spawn.y, dir: "down" };
  }

  // ---- Guardado -------------------------------------------------------------
  serialize(player) {
    const zone = this.world.zoneManager.getZone(player.zoneId);
    return {
      schema: PROFILE_SCHEMA,
      name: player.name,
      appearance: player.appearance,
      zoneId: (zone?.instance || (player.homeZoneId && player.zoneId === player.homeZoneId)) ? "@home" : player.zoneId,
      x: player.x,
      y: player.y,
      dir: player.dir,
      // Fase 5 (el saldo NO se guarda aquí: solo cambia por el libro contable)
      onboarded: player.onboarded === true,
      jobId: player.jobId || null,
      housingId: player.housingId || null,
      needs: player.needs ? packNeeds(player.needs) : {},
      inventory: player.inventory || {}
    };
  }

  /** Crea la fila de una cuenta nueva (necesaria antes de poder darle dinero en el libro contable). */
  async createRow(uid, profile) {
    await this.store.save(uid, {
      schema: PROFILE_SCHEMA,
      name: profile.name,
      appearance: profile.appearance,
      zoneId: "hub", x: profile.x, y: profile.y, dir: "down",
      onboarded: false,
      needs: packNeeds(defaultNeeds()),
      inventory: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  /** Guarda al jugador si es una cuenta (no invitado) y algo cambió desde el último guardado. */
  async savePlayer(player, { force = false } = {}) {
    if (!player || !player.uid) return false;
    const data = this.serialize(player);
    const fingerprint = JSON.stringify(data);
    if (!force && fingerprint === player._lastSaved) return false;

    const now = Date.now();
    const payload = { ...data, updatedAt: now };
    if (player._isNew) payload.createdAt = now;

    // Encadenamos tras un guardado anterior de la misma cuenta para mantener el orden
    const previous = this.pendingSaves.get(player.uid) || Promise.resolve();
    const job = previous.then(async () => {
      try {
        await this.store.save(player.uid, payload);
        player._lastSaved = fingerprint;
        player._isNew = false;
        return true;
      } catch (e) {
        console.error(`[Profile] Error guardando a ${player.name}:`, e.message);
        return false;
      }
    });
    this.pendingSaves.set(player.uid, job);
    const ok = await job;
    if (this.pendingSaves.get(player.uid) === job) this.pendingSaves.delete(player.uid);
    return ok;
  }

  async saveAll() {
    const jobs = [];
    for (const p of this.world.playerManager.players.values()) jobs.push(this.savePlayer(p));
    await Promise.all(jobs);
  }
}
