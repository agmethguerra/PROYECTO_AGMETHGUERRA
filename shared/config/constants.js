// Constantes compartidas entre cliente y servidor
// Vista isométrica estilo Habbo

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const TILE_HALF_WIDTH = TILE_WIDTH / 2;
export const TILE_HALF_HEIGHT = TILE_HEIGHT / 2;

// Direcciones
export const DIRECTIONS = {
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
  UP: "up"
};

export const DIR_VECTORS = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 }
};

// Colores para placeholders
export const TILE_COLORS = {
  FLOOR: "#4a7c59",
  FLOOR_ALT: "#5a8c69",
  WALL: "#8b7355",
  BLOCKED: "#d2691e",
  EXIT: "#ffd700",
  DEBUG: "rgba(255,255,255,0.3)"
};

export const PLAYER_COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e74c3c",
  "#2ecc71"
];

export const DEFAULT_SPAWN = { x: 5, y: 5 };
export const MOVE_SPEED = 200; // ms por paso (celda). El servidor lo aplica; el cliente lo usa para animar
export const MAX_STEP_HEIGHT = 1; // desnivel máximo entre dos celdas contiguas para poder caminar de una a otra
export const MAX_PATH_LENGTH = 80; // celdas máximas de una ruta pedida con un clic
export const CHAT_MAX_LENGTH = 100;
