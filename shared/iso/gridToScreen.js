import { TILE_WIDTH, TILE_HEIGHT, TILE_HALF_WIDTH, TILE_HALF_HEIGHT } from "../config/constants.js";

/**
 * Convierte coordenadas de cuadrícula (grid) a coordenadas de pantalla (isométrico)
 * @param {number} x - Coordenada X en grid
 * @param {number} y - Coordenada Y en grid
 * @param {number} offsetX - Offset de cámara X
 * @param {number} offsetY - Offset de cámara Y
 * @returns {{x: number, y: number}} Coordenadas en pantalla
 */
export function gridToScreen(x, y, offsetX = 0, offsetY = 0) {
  const screenX = (x - y) * TILE_HALF_WIDTH + offsetX;
  const screenY = (x + y) * TILE_HALF_HEIGHT + offsetY;
  return { x: screenX, y: screenY };
}
