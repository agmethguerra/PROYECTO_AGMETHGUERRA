export function depthSort(entities) {
  return entities.slice().sort((a, b) => {
    // Ordenar por y + x para correcto depth sorting isométrico
    const depthA = (a.y || 0) + (a.x || 0);
    const depthB = (b.y || 0) + (b.x || 0);
    if (depthA === depthB) {
      // Si misma profundidad, dibujar por tipo
      if (a.type === "player" && b.type === "tile") return 1;
      if (a.type === "tile" && b.type === "player") return -1;
      return 0;
    }
    return depthA - depthB;
  });
}
