// =============================================================================
// MovementSystem: el servidor es el ÚNICO que mueve a los jugadores.
//   1. El cliente pide ir a una celda (clic o tecla).
//   2. Aquí se calcula la ruta con A* sobre el mapa real (paredes, objetos, alturas).
//   3. Cada MOVE_SPEED ms el servidor avanza UNA celda y lo comunica.
// Así nadie puede teletransportarse, atravesar paredes ni correr más que los demás.
// =============================================================================
import { EVENTS } from "../../shared/config/events.js";
import { MOVE_SPEED, MAX_PATH_LENGTH } from "../../shared/config/constants.js";
import { createMessage } from "../../shared/protocol/messages.js";
import { changeZone } from "../network/handlers/move.js";

function dirFromDelta(dx, dy) {
  if (dx > 0) return "right";
  if (dx < 0) return "left";
  if (dy > 0) return "down";
  return "up";
}

export class MovementSystem {
  /**
   * @param ctx.getSocket(player)     -> ws del jugador
   * @param ctx.sendToSocket(ws, msg)
   * @param ctx.broadcastToZone(zoneId, msg, excludeId)
   */
  constructor(worldManager, ctx) {
    this.world = worldManager;
    this.ctx = ctx;
  }

  /**
   * Procesa una petición de movimiento.
   * @returns {{ok:true}|{ok:false, reason:string}}
   */
  requestMove(player, targetX, targetY) {
    const zones = this.world.zoneManager;
    const zone = zones.getZone(player.zoneId);
    if (!zone) return { ok: false, reason: "invalid_zone" };

    if (targetX < 0 || targetY < 0 || targetX >= zone.width || targetY >= zone.height) {
      return { ok: false, reason: "out_of_bounds" };
    }
    if (zones.isCellBlocked(player.zoneId, targetX, targetY)) {
      return { ok: false, reason: "blocked" };
    }

    const path = zones.findPath(
      player.zoneId,
      { x: player.x, y: player.y },
      { x: targetX, y: targetY },
      { maxLength: MAX_PATH_LENGTH }
    );
    if (path === null) return { ok: false, reason: "no_path" };

    // Una petición nueva sustituye a la anterior, pero NO reinicia el temporizador de paso:
    // por mucho que el cliente envíe peticiones, la velocidad máxima no cambia.
    player.path = path;
    return { ok: true };
  }

  /** Se llama muy a menudo (ver GameServer): avanza un paso a quien le toque. */
  tick(now = Date.now()) {
    for (const player of this.world.playerManager.players.values()) {
      if (!player.path || player.path.length === 0) continue;
      if (now < (player.nextStepAt || 0)) continue;
      this.step(player, now);
    }
  }

  step(player, now) {
    const zones = this.world.zoneManager;
    const next = player.path[0];

    // El mapa podría haber cambiado desde que se calculó la ruta: se revalida cada paso
    if (!zones.canStep(player.zoneId, player.x, player.y, next.x, next.y)) {
      player.path = [];
      this.send(player, createMessage(EVENTS.PLAYER_MOVE_REJECT, { reason: "blocked" }));
      return;
    }
    player.path.shift();

    player.dir = dirFromDelta(next.x - player.x, next.y - player.y);
    player.x = next.x;
    player.y = next.y;
    player.lastMoveAt = now;
    player.nextStepAt = now + MOVE_SPEED;

    this.send(player, createMessage(EVENTS.PLAYER_MOVE_ACCEPT, { x: player.x, y: player.y, dir: player.dir }));
    this.ctx.broadcastToZone(player.zoneId, createMessage(EVENTS.PLAYER_MOVED, {
      id: player.id,
      x: player.x,
      y: player.y,
      dir: player.dir,
      zoneId: player.zoneId
    }), player.id);

    // Si el último paso cae sobre una salida, se cambia de zona
    if (player.path.length === 0) {
      const exit = zones.getExitAt(player.zoneId, player.x, player.y);
      if (exit) {
        const ws = this.ctx.getSocket(player);
        if (ws) changeZone(this.world, ws, player.socketId, player, exit, this.ctx.sendToSocket, this.ctx.broadcastToZone);
      }
    }
  }

  send(player, message) {
    const ws = this.ctx.getSocket(player);
    if (ws) this.ctx.sendToSocket(ws, message);
  }
}
