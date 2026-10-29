import { randomInt } from "../../shared/utils/math.js";
import { PLAYER_COLORS } from "../../shared/config/constants.js";

export function generateGuestName() {
  return `Guest${randomInt(1000, 9999)}`;
}

export function getRandomColor() {
  return PLAYER_COLORS[randomInt(0, PLAYER_COLORS.length - 1)];
}

export function isInBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}
