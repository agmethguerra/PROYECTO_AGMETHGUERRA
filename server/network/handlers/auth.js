import { EVENTS } from "../../../shared/config/events.js";
import { createMessage } from "../../../shared/protocol/messages.js";
import { verifyIdentity } from "../../services/supabase.js";
import { defaultNeeds } from "../../systems/NeedsSystem.js";
import { sendSimState, sendOnboardingRequired } from "./sim.js";

/**
 * Mete a un jugador ya creado en el mundo: lo registra en su zona, le manda el
 * snapshot y avisa a los demás. Lo comparten el login de invitado y el de cuenta.
 */
function enterWorld(worldManager, ws, socketId, player, zone, sendToSocket, broadcastToZone) {
  worldManager.roomManager.addConnection(socketId, player.id);
  worldManager.zoneManager.addPlayerToZone(player.id, player.zoneId);

  // Enviar snapshot al jugador
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
    zone: worldManager.zoneManager.getClientPayload(zone.id),
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

  sendToSocket(ws, createMessage(EVENTS.WORLD_SNAPSHOT, snapshot));

  // Avisar a otros jugadores de la zona
  broadcastToZone(player.zoneId, createMessage(EVENTS.PLAYER_JOINED, {
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    dir: player.dir,
    appearance: player.appearance,
    zoneId: player.zoneId
  }), player.id);

  // Mensaje de sistema
  broadcastToZone(player.zoneId, createMessage(EVENTS.CHAT_MSG, {
    type: "system",
    text: `${player.name} ha entrado a la zona`,
    timestamp: Date.now()
  }), player.id);
}

// ---------------------------------------------------------------------------
// Invitado: sin cuenta, sin guardado (comportamiento de las fases 1 y 2)
// ---------------------------------------------------------------------------
export function handleAuthAnon(worldManager, ws, socketId, sendToSocket, broadcastToZone) {
  // Una conexión solo puede identificarse una vez
  if (worldManager.roomManager.getPlayerId(socketId)) return;

  // Crear jugador anónimo
  const player = worldManager.playerManager.createPlayer(socketId, "hub");
  player.dir = "down";
  player.guest = true;
  // Asignar apariencia por defecto
  const gender = Math.random() < 0.5 ? "male" : "female";
  player.appearance = worldManager.appearanceManager.getDefaultAppearance(gender);

  // Asignar spawn del hub
  let zone = worldManager.zoneManager.getZone("hub");
  if (!zone) {
    console.error("[Auth] Zone 'hub' not found!");
    console.error("[Auth] Available zones:", Array.from(worldManager.zoneManager.zones?.keys() || []));
    worldManager.zoneManager.loadZones();
    zone = worldManager.zoneManager.getZone("hub");
  }

  if (!zone) {
    console.error("[Auth] Still cannot find hub zone. Closing connection.");
    worldManager.playerManager.removePlayer(player.id);
    ws.close();
    return;
  }

  if (zone.spawns && zone.spawns.length > 0) {
    const spawn = zone.spawns[0];
    player.x = spawn.x;
    player.y = spawn.y;
  } else {
    player.x = 5;
    player.y = 5;
  }

  // Simulación: el invitado también tiene necesidades y fondos, pero solo en memoria (sin casa)
  player.needs = defaultNeeds();
  player.inventory = { ration: 8 };
  player._needsAt = Date.now();
  worldManager.economy.open(player).then(() => {
    if (ws.readyState === ws.OPEN && worldManager.roomManager.getPlayerId(socketId)) sendSimState(worldManager, sendToSocket, ws, player);
  });

  sendToSocket(ws, createMessage(EVENTS.AUTH_OK, { name: player.name, guest: true }));
  enterWorld(worldManager, ws, socketId, player, zone, sendToSocket, broadcastToZone);
  console.log(`[Auth] ${player.name} (${player.id}) connected to ${player.zoneId} [invitado]`);
}

// ---------------------------------------------------------------------------
// Cuenta: verifica el token, carga el progreso guardado y entra al mundo
// ---------------------------------------------------------------------------
/**
 * @param ctx { worldManager, profileManager, sendToSocket, broadcastToZone, kickSession(socketId) }
 */
export async function handleAuthLogin(ctx, ws, socketId, payload) {
  const { worldManager, profileManager, sendToSocket, broadcastToZone } = ctx;
  const fail = (message) => sendToSocket(ws, createMessage(EVENTS.AUTH_ERROR, { message }));

  if (worldManager.roomManager.getPlayerId(socketId)) return; // ya identificado

  // 1) ¿Quién es? (si el token es falso o caducó, aquí se corta)
  let identity;
  try {
    identity = await verifyIdentity(payload?.idToken);
  } catch (e) {
    console.warn(`[Auth] Login rechazado (${socketId}): ${e.message}`);
    return fail("No se pudo verificar tu sesión. Inicia sesión de nuevo.");
  }
  if (ws.readyState !== ws.OPEN) return; // se desconectó mientras verificábamos

  // 2) Una sola sesión por cuenta: la anterior se guarda y se expulsa
  const previousSocket = profileManager.getSocketForUid(identity.uid);
  if (previousSocket && previousSocket !== socketId) {
    await ctx.kickSession(previousSocket);
  }
  // Reservamos la cuenta YA, antes de cualquier espera, para que dos logins
  // simultáneos de la misma cuenta no entren los dos.
  profileManager.bindSession(identity.uid, socketId);

  try {
    // 3) Cargar (o crear) el perfil
    const profile = await profileManager.loadOrCreate(identity, payload?.name);
    if (ws.readyState !== ws.OPEN || profileManager.getSocketForUid(identity.uid) !== socketId) {
      profileManager.releaseSession(identity.uid, socketId);
      return;
    }

    // Cuenta nueva: la fila debe existir antes de poder darle dinero en el libro contable
    if (profile.isNew) await profileManager.createRow(identity.uid, profile);

    const player = worldManager.playerManager.createPlayer(socketId, "hub");
    player.uid = identity.uid;      // privado: nunca se envía a otros clientes
    player.guest = false;
    player.onboarded = profile.onboarded;
    player.jobId = profile.jobId;
    player.housingId = profile.housingId;
    player.needs = profile.needs;
    player.inventory = profile.inventory;
    player._needsAt = Date.now();
    // La casa privada se crea al entrar; si la cuenta no tiene vivienda, vuelve al hub
    let zoneId = profile.zoneId;
    if (zoneId === "@home") {
      const home = worldManager.homeManager.ensureHome(player);
      zoneId = home ? home.id : "hub";
      if (!home) { const sp = worldManager.zoneManager.getRandomSpawn("hub"); profile.x = sp.x; profile.y = sp.y; }
    }
    player.zoneId = zoneId;
    const zone = worldManager.zoneManager.getZone(zoneId);
    player.name = profile.name;
    player.appearance = profile.appearance;
    player.x = profile.x;
    player.y = profile.y;
    player.dir = profile.dir;
    player._isNew = profile.isNew;

    await worldManager.economy.open(player, profile.balance);
    if (ws.readyState !== ws.OPEN || profileManager.getSocketForUid(identity.uid) !== socketId) {
      worldManager.playerManager.removePlayer(player.id);
      profileManager.releaseSession(identity.uid, socketId);
      return;
    }

    sendToSocket(ws, createMessage(EVENTS.AUTH_OK, { name: player.name, guest: false, isNew: profile.isNew }));
    enterWorld(worldManager, ws, socketId, player, zone, sendToSocket, broadcastToZone);
    if (player.onboarded) sendSimState(worldManager, sendToSocket, ws, player);
    else sendOnboardingRequired(worldManager, sendToSocket, ws, player);

    // Guardado inicial: crea el documento si es cuenta nueva
    await profileManager.savePlayer(player, { force: true });
    console.log(`[Auth] ${player.name} (${identity.uid}) entró a ${player.zoneId} [${profile.isNew ? "cuenta nueva" : "progreso cargado"}]`);
  } catch (e) {
    console.error("[Auth] Error cargando perfil:", e);
    profileManager.releaseSession(identity.uid, socketId);
    fail("Error cargando tu perfil. Inténtalo de nuevo.");
  }
}
