import { isInBounds } from "../core/utils.js";

export function validateMove(worldManager, player, targetX, targetY) {
  const zone = worldManager.zoneManager.getZone(player.zoneId);
  if (!zone) return { valid: false, reason: "invalid_zone" };
  
  // Comprobar límites
  if (!isInBounds(targetX, targetY, zone.width, zone.height)) {
    return { valid: false, reason: "out_of_bounds" };
  }
  
  // Comprobar colisión
  if (worldManager.zoneManager.isCellBlocked(player.zoneId, targetX, targetY)) {
    return { valid: false, reason: "blocked" };
  }
  
  // Comprobar si hay otro jugador en esa celda (opcional por ahora, permitir)
  // Para Fase 1 permitimos que se apilen, lo puliremos después
  
  return { valid: true };
}
