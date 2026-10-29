export function getAvatarHeight(direction) {
  // Ajuste ligero para dar sensación de altura según dirección
  return 0;
}

export function getDirectionIndex(dir) {
  const map = { down: 0, left: 1, right: 2, up: 3 };
  return map[dir] || 0;
}
