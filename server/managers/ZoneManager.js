import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { MAX_STEP_HEIGHT } from "../../shared/config/constants.js";
import { findPath } from "../pathfinding/astar.js";

export class ZoneManager {
  constructor() {
    this.zones = new Map();
    this.zonesConfig = null;
    this.objectDefs = {};
    this.interactions = {};
  }

  loadInteractions() {
    try {
      const p = join(__dirname, "../../data/interactions/interactions.json");
      this.interactions = JSON.parse(readFileSync(p, "utf-8")).interactions || {};
    } catch (error) {
      console.error("[ZoneManager] Error cargando interacciones:", error);
    }
  }

  /** Definiciones de objetos (data/objects/definitions.json): qué bloquea, tamaño, estilo... */
  loadObjectDefs() {
    try {
      const p = join(__dirname, "../../data/objects/definitions.json");
      this.objectDefs = JSON.parse(readFileSync(p, "utf-8")).definitions || {};
    } catch (error) {
      console.error("[ZoneManager] Error cargando definiciones de objetos:", error);
    }
  }

  /**
   * Convierte los objetos del mapa en objetos completos (con tamaño, altura y estilo de su
   * definición) y calcula la cuadrícula de celdas bloqueadas: paredes del mapa + objetos sólidos.
   */
  buildZoneGrid(zoneId, mapData) {
    const { width, height } = mapData;
    const blocked = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => mapData.collision?.[y]?.[x] === true)
    );
    const objects = [];
    for (const raw of mapData.objects || []) {
      const def = this.objectDefs[raw.type];
      if (!def) {
        console.warn(`[ZoneManager] ${zoneId}: objeto "${raw.id}" con tipo desconocido "${raw.type}" (ignorado)`);
        continue;
      }
      const obj = {
        id: raw.id,
        type: raw.type,
        x: raw.x,
        y: raw.y,
        w: raw.w || def.w || 1,
        h: raw.h || def.h || 1,
        blocks: def.blocks === true,
        style: def.style || "box",
        levels: def.levels ?? 1,
        color: def.color || "#555555",
        actions: (def.actions || []).filter((a) => this.interactions[a]) // ids de interacciones disponibles
      };
      if (obj.x < 0 || obj.y < 0 || obj.x + obj.w > width || obj.y + obj.h > height) {
        console.warn(`[ZoneManager] ${zoneId}: objeto "${obj.id}" fuera del mapa (ignorado)`);
        continue;
      }
      if (obj.blocks) {
        for (let yy = obj.y; yy < obj.y + obj.h; yy++) {
          for (let xx = obj.x; xx < obj.x + obj.w; xx++) blocked[yy][xx] = true;
        }
      }
      objects.push(obj);
    }
    return { blocked, objects };
  }

  loadZones() {
    this.loadObjectDefs();
    this.loadInteractions();
    try {
      const zonesPath = join(__dirname, "../../data/zones/zones.json");
      const zonesData = JSON.parse(readFileSync(zonesPath, "utf-8"));
      this.zonesConfig = zonesData.zones;

      for (const [zoneId, config] of Object.entries(this.zonesConfig)) {
        const mapPath = join(__dirname, "../../data", config.mapFile.replace("maps/", "maps/"));
        const mapData = JSON.parse(readFileSync(mapPath, "utf-8"));
        
        const { blocked, objects } = this.buildZoneGrid(zoneId, mapData);
        this.zones.set(zoneId, {
          id: zoneId,
          name: config.name,
          width: mapData.width,
          height: mapData.height,
          tiles: mapData.tiles || [],
          collision: mapData.collision || [],   // solo paredes del mapa (lo que se dibuja como bloqueo)
          blocked,                              // paredes + objetos sólidos (lo que usa el servidor)
          objects,
          heightMap: mapData.heightMap || [],
          spawns: config.spawns || [],
          exits: mapData.exits || config.exits || [],
          template: config.instanced === true,        // plantilla de zona privada (casas): nunca se entra directamente
          entrySpawn: config.entrySpawn || null,
          players: new Set()
        });
      }
      console.log(`[ZoneManager] Loaded ${this.zones.size} zones`);
    } catch (error) {
      console.error("[ZoneManager] Error loading zones:", error);
    }
  }

  getZone(zoneId) {
    return this.zones.get(zoneId);
  }

  getAllZones() {
    return Array.from(this.zones.values());
  }

  addPlayerToZone(playerId, zoneId) {
    const zone = this.zones.get(zoneId);
    if (zone) {
      zone.players.add(playerId);
    }
  }

  removePlayerFromZone(playerId, zoneId) {
    const zone = this.zones.get(zoneId);
    if (zone) {
      zone.players.delete(playerId);
      // Las zonas privadas (casas) se destruyen al quedarse vacías: no consumen memoria
      if (zone.instance && zone.players.size === 0) this.zones.delete(zoneId);
    }
  }

  /**
   * Crea (o devuelve) una copia privada de una plantilla de zona, p. ej. la casa de un jugador.
   * Cada instancia tiene sus propios objetos para poder cambiarlos sin afectar a otras casas.
   */
  ensureInstance(templateId, instanceId) {
    const existing = this.zones.get(instanceId);
    if (existing) return existing;
    const tpl = this.zones.get(templateId);
    if (!tpl || !tpl.template) return null;
    const zone = {
      ...tpl,
      id: instanceId,
      instance: true,
      templateId,
      template: false,
      objects: tpl.objects.map((o) => ({ ...o })),
      players: new Set()
    };
    this.zones.set(instanceId, zone);
    return zone;
  }

  getPlayersInZone(zoneId) {
    const zone = this.zones.get(zoneId);
    if (!zone) return [];
    return Array.from(zone.players);
  }

  isCellBlocked(zoneId, x, y) {
    const zone = this.zones.get(zoneId);
    if (!zone) return true;
    if (x < 0 || x >= zone.width || y < 0 || y >= zone.height) return true;
    return zone.blocked[y][x] === true;
  }

  /** Nivel de altura de una celda (0 si el mapa no define alturas). */
  getHeight(zoneId, x, y) {
    const zone = this.zones.get(zoneId);
    return zone?.heightMap?.[y]?.[x] || 0;
  }

  /**
   * ¿Se puede pasar de (fx,fy) a (tx,ty)? Deben ser contiguas (4 direcciones), ambas libres,
   * y la diferencia de altura no puede superar MAX_STEP_HEIGHT (así hay que usar escaleras).
   */
  canStep(zoneId, fx, fy, tx, ty) {
    if (Math.abs(fx - tx) + Math.abs(fy - ty) !== 1) return false;
    if (this.isCellBlocked(zoneId, tx, ty)) return false;
    return Math.abs(this.getHeight(zoneId, tx, ty) - this.getHeight(zoneId, fx, fy)) <= MAX_STEP_HEIGHT;
  }

  /** Ruta A* entre dos celdas de una zona: [{x,y}, ...] sin la celda inicial, o null si no hay. */
  findPath(zoneId, from, to, options) {
    const zone = this.zones.get(zoneId);
    if (!zone) return null;
    const grid = {
      width: zone.width,
      height: zone.height,
      canEnter: (x, y) => !this.isCellBlocked(zoneId, x, y),
      canStep: (fx, fy, tx, ty) => this.canStep(zoneId, fx, fy, tx, ty),
      isExit: (x, y) => !!this.getExitAt(zoneId, x, y)
    };
    return findPath(grid, from, to, options);
  }

  /** Datos de la zona que se envían al cliente (sin nada interno del servidor). */
  getClientPayload(zoneId) {
    const z = this.zones.get(zoneId);
    if (!z) return null;
    return {
      id: z.id,
      name: z.name,
      width: z.width,
      height: z.height,
      collision: z.collision || [],
      heightMap: z.heightMap || [],
      exits: z.exits || [],
      objects: (z.objects || []).map((o) => ({
        ...o,
        // Al cliente solo le llega lo que necesita para mostrar el menú; los efectos se quedan en el servidor
        actions: o.actions.map((id) => ({
          id,
          label: this.interactions[id].label,
          durationMs: this.interactions[id].durationMs || 0,
          consumes: this.interactions[id].consumes || null
        }))
      }))
    };
  }

  getExitAt(zoneId, x, y) {
    const zone = this.zones.get(zoneId);
    if (!zone) return null;
    for (const exit of zone.exits) {
      if (exit.x === x && exit.y === y) {
        return exit;
      }
    }
    return null;
  }

  getRandomSpawn(zoneId) {
    const zone = this.zones.get(zoneId);
    if (!zone || zone.spawns.length === 0) {
      return { x: 5, y: 5 };
    }
    const idx = Math.floor(Math.random() * zone.spawns.length);
    return zone.spawns[idx] || { x: 5, y: 5 };
  }
}
