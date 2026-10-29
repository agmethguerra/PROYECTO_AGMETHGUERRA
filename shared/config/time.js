// =============================================================================
// Reloj del juego, compartido por servidor y cliente.
// Un día del juego dura 7 horas REALES. Es el mismo para todos los jugadores y
// avanza siempre (conectados o no); lo que se pausa al desconectarse son las
// necesidades del personaje, no el reloj del mundo.
// =============================================================================
export const GAME_DAY_REAL_MS = 7 * 60 * 60 * 1000;
// Día 1 empieza a medianoche (hora de Colombia, UTC-5) del 28/oct/2026
export const GAME_EPOCH_MS = Date.UTC(2026, 9, 28, 5, 0, 0);

/** @returns {{day:number, hour:number, minute:number, label:string}} */
export function getGameTime(nowMs) {
  const elapsed = Math.max(0, nowMs - GAME_EPOCH_MS);
  const day = Math.floor(elapsed / GAME_DAY_REAL_MS) + 1;
  const minutesOfDay = Math.floor(((elapsed % GAME_DAY_REAL_MS) / GAME_DAY_REAL_MS) * 24 * 60);
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return { day, hour, minute, label: `Día ${day} · ${pad(hour)}:${pad(minute)}` };
}
