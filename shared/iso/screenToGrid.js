import { TILE_WIDTH, TILE_HEIGHT, TILE_HALF_WIDTH, TILE_HALF_HEIGHT } from "../config/constants.js";

/**
 * Convierte coordenadas de pantalla a coordenadas de cuadrícula (inverso de isométrico)
 * @param {number} screenX - Coordenada X en pantalla
 * @param {number} screenY - Coordenada Y en pantalla
 * @param {number} offsetX - Offset de cámara X
 * @param {number} offsetY - Offset de cámara Y
 * @returns {{x: number, y: number}} Coordenadas en grid (float, redondear para obtener celda)
 */
export function screenToGrid(screenX, screenY, offsetX = 0, offsetY = 0) {
  const x = screenX - offsetX;
  const y = screenY - offsetY;
  
  const gridX = (x / TILE_HALF_WIDTH + y / TILE_HALF_HEIGHT) / 2;
  const gridY = (y / TILE_HALF_HEIGHT - x / TILE_HALF_WIDTH) / 2;
  
  return { x: gridX, y: gridY };
}

/**
 * Obtiene la celda de grid (entera) desde coordenadas de pantalla
 */
export function screenToGridCell(screenX, screenY, offsetX = 0, offsetY = 0) {
  const pos = screenToGrid(screenX, screenY, offsetX, offsetY);
  return {
    x: Math.floor(pos.x),
    y: Math.floor(pos.y)
  };
}
