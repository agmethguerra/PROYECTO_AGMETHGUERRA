// =============================================================================
// HomeManager: cada cuenta con vivienda tiene su propia copia privada de la casa.
// Las instancias solo existen mientras el jugador está dentro (ZoneManager las borra al vaciarse).
// =============================================================================
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class HomeManager {
  constructor(world) {
    this.world = world;
    this.housing = JSON.parse(readFileSync(join(__dirname, "../../data/housing/housing.json"), "utf-8")).housing;
  }
  get(housingId) {
    return this.housing.find((h) => h.id === housingId) || null;
  }
  templateFor(housingId) {
    return this.get(housingId)?.template || null;
  }
  /** Crea (o recupera) la casa privada del jugador y la guarda en player.homeZoneId. */
  ensureHome(player) {
    const tplId = this.templateFor(player.housingId);
    if (!tplId) return null;
    const id = `home:${player.id}`;
    const zone = this.world.zoneManager.ensureInstance(tplId, id);
    if (zone) player.homeZoneId = id;
    return zone;
  }
}
