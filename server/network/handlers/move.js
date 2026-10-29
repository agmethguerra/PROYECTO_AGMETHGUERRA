import { EVENTS } from "../../../shared/config/events.js";
import { createMessage } from "../../../shared/protocol/messages.js";

/**
 * El cliente pide ir a una celda. NO se mueve nada aquí: el MovementSystem calcula la ruta
 * (A*) y hace avanzar al jugador celda a celda a la velocidad permitida.
 */
export function handleMoveRequest(worldManager, ws, socketId, payload, sendToSocket, broadcastToZone, movement) {
  const playerId = worldManager.roomManager.getPlayerId(socketId);
  const player = worldManager.playerManager.getPlayer(playerId);
  
  if (!player || player.onboarded === false) return;
  
  const { target } = payload;
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    sendToSocket(ws, createMessage(EVENTS.PLAYER_MOVE_REJECT, { reason: "invalid_target" }));
    return;
  }
  
  worldManager.activitySystem?.cancel(player); // moverse interrumpe lo que estés haciendo
  const result = movement.requestMove(player, Math.floor(target.x), Math.floor(target.y));
  if (!result.ok) {
    sendToSocket(ws, createMessage(EVENTS.PLAYER_MOVE_REJECT, { reason: result.reason }));
  }
}

export function changeZone(worldManager, ws, socketId, player, exit, sendToSocket, broadcastToZone) {
  // "@home" = el hogar propio de este jugador (cada cuenta tiene el suyo)
  if (exit.targetZone === "@home") {
    const home = worldManager.homeManager?.ensureHome(player);
    if (!home) {
      sendToSocket(ws, createMessage(EVENTS.CHAT_MSG, {
        type: "system", text: "Todavía no tienes un hogar.", timestamp: Date.now()
      }));
      return;
    }
    exit = { ...exit, targetZone: home.id, targetSpawn: home.entrySpawn || exit.targetSpawn };
  }
  worldManager.activitySystem?.cancel(player);

  // Mismo destino (p. ej. desmayo dentro de casa): solo se recoloca, sin salir de la zona
  if (exit.targetZone === player.zoneId) {
    player.x = exit.targetSpawn.x; player.y = exit.targetSpawn.y; player.dir = "down"; player.path = [];
    sendToSocket(ws, createMessage(EVENTS.PLAYER_MOVE_ACCEPT, { x: player.x, y: player.y, dir: player.dir }));
    broadcastToZone(player.zoneId, createMessage(EVENTS.PLAYER_MOVED, {
      id: player.id, x: player.x, y: player.y, dir: player.dir, zoneId: player.zoneId
    }), player.id);
    return;
  }
  const oldZoneId = player.zoneId;
  const oldZone = worldManager.zoneManager.getZone(oldZoneId);
  
  // Avisar a otros de la zona antigua que se va
  broadcastToZone(oldZoneId, createMessage(EVENTS.PLAYER_LEFT, {
    id: player.id,
    name: player.name,
    reason: "zone_change"
  }), player.id);
  
  // Mensaje de sistema en zona antigua
  broadcastToZone(oldZoneId, createMessage(EVENTS.CHAT_MSG, {
    type: "system",
    text: `${player.name} ha salido hacia ${worldManager.zoneManager.getZone(exit.targetZone)?.name || exit.targetZone}`,
    timestamp: Date.now()
  }), null);
  
  // Quitar de zona antigua
  worldManager.zoneManager.removePlayerFromZone(player.id, oldZoneId);
  
  // Cambiar a nueva zona
  player.zoneId = exit.targetZone;
  player.x = exit.targetSpawn.x;
  player.y = exit.targetSpawn.y;
  player.dir = "down";
  player.lastMoveAt = Date.now();
  player.path = []; // cancelar cualquier ruta pendiente
  
  // Añadir a nueva zona
  worldManager.zoneManager.addPlayerToZone(player.id, player.zoneId);
  
  const newZone = worldManager.zoneManager.getZone(player.zoneId);
  
  // Enviar snapshot de nueva zona
  const playersInZone = worldManager.playerManager.getPlayersInZone(player.zoneId);
  const snapshot = {
    self: {
      id: player.id,
      name: player.name,
      x: player.x,
      y: player.y,
      dir: player.dir,
      zoneId: player.zoneId,
      appearance: player.appearance
    },
    zone: worldManager.zoneManager.getClientPayload(player.zoneId),
    players: playersInZone
      .filter(p => p.id !== player.id)
      .map(p => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        dir: p.dir,
        appearance: p.appearance,
        zoneId: p.zoneId
      }))
  };
  
  sendToSocket(ws, createMessage(EVENTS.ZONE_CHANGE, {
    fromZone: oldZoneId,
    toZone: player.zoneId
  }));
  
  sendToSocket(ws, createMessage(EVENTS.PLAYER_MOVE_ACCEPT, {
    x: player.x,
    y: player.y,
    dir: player.dir
  }));
  
  sendToSocket(ws, createMessage(EVENTS.WORLD_SNAPSHOT, snapshot));
  
  // Avisar a otros de la nueva zona
  broadcastToZone(player.zoneId, createMessage(EVENTS.PLAYER_JOINED, {
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    dir: player.dir,
    appearance: player.appearance,
    zoneId: player.zoneId
  }), player.id);
  
  // Mensaje de sistema en nueva zona
  broadcastToZone(player.zoneId, createMessage(EVENTS.CHAT_MSG, {
    type: "system",
    text: `${player.name} ha entrado a la zona`,
    timestamp: Date.now()
  }), player.id);
  
  console.log(`[Zone] ${player.name} moved from ${oldZoneId} to ${player.zoneId}`);
}
