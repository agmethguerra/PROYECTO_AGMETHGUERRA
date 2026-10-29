import { CLIENT_CONFIG } from "../core/config.js";

export function gridToScreen(x, y, offsetX = 0, offsetY = 0) {
  const screenX = (x - y) * CLIENT_CONFIG.TILE_HALF_WIDTH + offsetX;
  const screenY = (x + y) * CLIENT_CONFIG.TILE_HALF_HEIGHT + offsetY;
  return { x: screenX, y: screenY };
}

export function screenToGrid(screenX, screenY, offsetX = 0, offsetY = 0) {
  const x = screenX - offsetX;
  const y = screenY - offsetY;
  
  const gridX = (x / CLIENT_CONFIG.TILE_HALF_WIDTH + y / CLIENT_CONFIG.TILE_HALF_HEIGHT) / 2;
  const gridY = (y / CLIENT_CONFIG.TILE_HALF_HEIGHT - x / CLIENT_CONFIG.TILE_HALF_WIDTH) / 2;
  
  return { x: gridX, y: gridY };
}

export function screenToGridCell(screenX, screenY, offsetX = 0, offsetY = 0) {
  const pos = screenToGrid(screenX, screenY, offsetX, offsetY);
  return {
    x: Math.floor(pos.x),
    y: Math.floor(pos.y)
  };
}
