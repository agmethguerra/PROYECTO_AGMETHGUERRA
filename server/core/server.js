import { WebSocketServer } from "ws";
import { createServer } from "http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve, sep, extname } from "path";
import { SERVER_CONFIG } from "./config.js";
import { WorldManager } from "../managers/WorldManager.js";
import { EVENTS } from "../../shared/config/events.js";
import { createMessage } from "../../shared/protocol/messages.js";
import { validateMessage } from "../network/validate.js";
import { RateLimiter } from "../network/rateLimit.js";
import { handleAuthAnon, handleAuthLogin } from "../network/handlers/auth.js";
import { initSupabase, getPublicClientConfig } from "../services/supabase.js";
import { createPlayerStore } from "../storage/index.js";
import { ProfileManager } from "../managers/ProfileManager.js";
import { MovementSystem } from "../systems/MovementSystem.js";
import { handleMoveRequest } from "../network/handlers/move.js";
import { handleChatSend } from "../network/handlers/chat.js";
import { handleAppearanceSet } from "../network/handlers/appearance.js";
import { EconomyManager } from "../managers/EconomyManager.js";
import { NeedsSystem } from "../systems/NeedsSystem.js";
import { ActivitySystem } from "../systems/ActivitySystem.js";
import { changeZone } from "../network/handlers/move.js";
import { handleOnboardingComplete, handleObjectInteract, handleActivityCancel } from "../network/handlers/sim.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, "../..");
const CONTENT_TYPES = {
  html: "text/html; charset=utf-8",
  js: "application/javascript",
  css: "text/css",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  json: "application/json",
  svg: "image/svg+xml"
};

/**
 * Sirve un archivo estático SOLO si queda dentro de la carpeta base permitida.
 * Evita rutas tipo /js/../../.env (path traversal), que antes dejaban leer
 * cualquier archivo del proyecto (ahora hay claves de Supabase, esto es crítico).
 */
function serveFile(res, baseDir, relativePath) {
  try {
    const base = resolve(ROOT, baseDir);
    const filePath = resolve(base, "." + sep + relativePath);
    if (filePath !== base && !filePath.startsWith(base + sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const content = readFileSync(filePath);
    const ext = extname(filePath).slice(1).toLowerCase();
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] || "text/plain" });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end("Not found");
  }
}

export class GameServer {
  constructor() {
    this.worldManager = new WorldManager();
    this.rateLimiter = new RateLimiter(20, 1000); // 20 requests por segundo
    this.clients = new Map();
    this.authState = new Map(); // socketId -> { attempts }
    this.profileManager = null; // se crea en start(), cuando Supabase ya está listo
  }

  async start() {
    await initSupabase(); // elige Supabase real o modo desarrollo
    this.worldManager.init();
    this.profileManager = new ProfileManager(createPlayerStore(), this.worldManager);

    // Movimiento autoritativo: el servidor hace avanzar a los jugadores por su ruta
    this.movement = new MovementSystem(this.worldManager, {
      getSocket: (player) => this.getSocketById(player.socketId),
      sendToSocket: this.sendToSocket.bind(this),
      broadcastToZone: this.broadcastToZone.bind(this)
    });
    this.moveTimer = setInterval(() => this.movement.tick(Date.now()), SERVER_CONFIG.MOVE_TICK_MS);
    this.moveTimer.unref();

    // Simulación de vida (Fase 5)
    const w = this.worldManager;
    const send = this.sendToSocket.bind(this);
    const say = (player, text) => {
      const ws = this.getSocketById(player.socketId);
      if (ws) send(ws, createMessage(EVENTS.CHAT_MSG, { type: "system", text, timestamp: Date.now() }));
    };
    w.economy = new EconomyManager(this.profileManager.store, (player, info) => {
      const ws = this.getSocketById(player.socketId);
      if (ws) send(ws, createMessage(EVENTS.ECON_BALANCE, info));
    });
    w.activitySystem = new ActivitySystem(w, {
      getSocket: (p) => this.getSocketById(p.socketId),
      sendToSocket: send,
      broadcastToZone: this.broadcastToZone.bind(this),
      say,
      sendInventory: (p) => {
        const ws = this.getSocketById(p.socketId);
        if (ws) send(ws, createMessage(EVENTS.INVENTORY_UPDATE, { inventory: p.inventory }));
      }
    });
    this.teleportHome = (player) => {
      const ws = this.getSocketById(player.socketId);
      if (!ws) return;
      const exit = player.housingId
        ? { targetZone: "@home", targetSpawn: { x: 1, y: 1 } }
        : { targetZone: "hub", targetSpawn: w.zoneManager.getRandomSpawn("hub") };
      changeZone(w, ws, player.socketId, player, exit, send, this.broadcastToZone.bind(this));
    };
    w.needsSystem = new NeedsSystem(w, {
      getSocket: (p) => this.getSocketById(p.socketId),
      sendToSocket: send,
      economy: w.economy,
      activity: w.activitySystem,
      say,
      sendHome: (p) => this.teleportHome(p)
    });
    this.simTimer = setInterval(() => w.needsSystem.tick(Date.now()), 1000);
    this.actTimer = setInterval(() => w.activitySystem.tick(Date.now()), 250);
    this.simTimer.unref(); this.actTimer.unref();
    console.log("[Server] Zones loaded:", Array.from(this.worldManager.zoneManager.zones.keys()));
    
    const server = createServer((req, res) => {
      // Solo el "pathname": se ignora ?query y se decodifica %2e%2e antes de validar
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      } catch (e) {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }

      if (pathname === "/" || pathname === "/index.html") {
        return serveFile(res, "client", "index.html");
      }

      // Comprobación de salud para el hosting (Render/Railway/Fly la usan para saber que vive)
      if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
        return;
      }

      // Configuración pública para el login del cliente (nunca incluye secretos)
      if (pathname === "/api/config" || pathname === "/config.json") {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(getPublicClientConfig()));
        return;
      }

      // Archivos estáticos: cliente, compartidos y datos del juego
      if (pathname.startsWith("/js/") || pathname.startsWith("/css/") || pathname.startsWith("/assets/")) {
        return serveFile(res, "client", pathname);
      }
      if (pathname.startsWith("/shared/")) {
        return serveFile(res, "shared", pathname.slice("/shared/".length));
      }
      if (pathname.startsWith("/data/")) {
        return serveFile(res, "data", pathname.slice("/data/".length));
      }

      res.writeHead(404);
      res.end("Not found");
    });
    
    const wss = new WebSocketServer({
      server,
      maxPayload: SERVER_CONFIG.MAX_PAYLOAD_BYTES,
      // Con el cliente en Vercel y el servidor en otro dominio, solo aceptamos
      // WebSockets que vengan de las webs permitidas (ALLOWED_ORIGINS).
      verifyClient: ({ origin }) => {
        const allowed = SERVER_CONFIG.ALLOWED_ORIGINS;
        if (allowed.length === 0) return true;          // no configurado: se acepta todo (desarrollo)
        return !!origin && allowed.includes(origin);
      }
    });
    
    wss.on("connection", (ws) => {
      const socketId = Math.random().toString(36).substr(2, 9);
      this.clients.set(socketId, ws);
      console.log(`[WS] New connection: ${socketId}`);
      
      // Ya no se entra solo: el cliente debe enviar auth:login (cuenta) o auth:anon (invitado).
      // Si no se identifica a tiempo, se cierra la conexión.
      this.authState.set(socketId, { attempts: 0 });
      const authTimer = setTimeout(() => {
        if (!this.worldManager.roomManager.getPlayerId(socketId)) ws.close(4002, "auth timeout");
      }, SERVER_CONFIG.AUTH_TIMEOUT_MS);
      ws.once("close", () => clearTimeout(authTimer));
      
      ws.on("message", (data) => {
        try {
          if (!this.rateLimiter.check(socketId)) {
            this.sendToSocket(ws, createMessage(EVENTS.ERROR, { message: "Rate limit exceeded" }));
            return;
          }
          
          const msg = JSON.parse(data.toString());
          if (!validateMessage(msg)) return;
          
          this.handleMessage(ws, socketId, msg);
        } catch (error) {
          console.error("[WS] Error parsing message:", error);
        }
      });
      
      ws.on("close", () => {
        console.log(`[WS] Disconnection: ${socketId}`);
        this.removeSocketPlayer(socketId).finally(() => {
          this.rateLimiter.remove(socketId);
          this.clients.delete(socketId);
          this.authState.delete(socketId);
        });
      });
      
      ws.on("error", (error) => {
        console.error(`[WS] Error for ${socketId}:`, error);
      });
    });
    
    // Autoguardado periódico (solo escribe a quien haya cambiado) y guardado final al apagar
    this.autosaveTimer = setInterval(() => this.profileManager.saveAll(), SERVER_CONFIG.AUTOSAVE_MS);
    this.autosaveTimer.unref();
    const shutdown = async (signal) => {
      console.log(`\n[Server] ${signal}: guardando progreso...`);
      try {
        await this.profileManager.saveAll();
        await this.profileManager.store.flush();
      } finally {
        process.exit(0);
      }
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));

    server.listen(SERVER_CONFIG.PORT, () => {
      console.log(`\n🎮 Servidor corriendo en http://${SERVER_CONFIG.HOST}:${SERVER_CONFIG.PORT}`);
      console.log(`📡 WebSocket en ws://${SERVER_CONFIG.HOST}:${SERVER_CONFIG.PORT}`);
      console.log(`\nAbre http://${SERVER_CONFIG.HOST}:${SERVER_CONFIG.PORT} en tu navegador\n`);
    });
  }
  
  /**
   * Quita al jugador de la zona (avisando a los demás), guarda su progreso y libera
   * su cuenta. Es seguro llamarlo varias veces: la segunda no hace nada.
   */
  async removeSocketPlayer(socketId) {
    const pm = this.worldManager.playerManager;
    const player = pm.removePlayerBySocketId(socketId);
    this.worldManager.roomManager.removeConnection(socketId);
    if (player) {
      this.worldManager.zoneManager.removePlayerFromZone(player.id, player.zoneId);
      this.broadcastToZone(player.zoneId, createMessage(EVENTS.PLAYER_LEFT, {
        id: player.id,
        name: player.name
      }), player.id);
      this.broadcastToZone(player.zoneId, createMessage(EVENTS.CHAT_MSG, {
        type: "system",
        text: `${player.name} se ha desconectado`,
        timestamp: Date.now()
      }), null);
      await this.profileManager.savePlayer(player, { force: true });
    }
    this.profileManager.releaseSocket(socketId);
  }

  /** Expulsa una sesión (otra pestaña entró con la misma cuenta). Espera a que se guarde. */
  async kickSession(socketId) {
    const ws = this.clients.get(socketId);
    if (ws) this.sendToSocket(ws, createMessage(EVENTS.SESSION_REPLACED, {}));
    await this.removeSocketPlayer(socketId);
    if (ws) ws.close(4000, "session replaced");
  }

  handleMessage(ws, socketId, msg) {
    const { type, payload } = msg;
    
    switch (type) {
      case EVENTS.AUTH_ANON:
        handleAuthAnon(this.worldManager, ws, socketId, this.sendToSocket.bind(this), this.broadcastToZone.bind(this));
        break;
      case EVENTS.AUTH_LOGIN: {
        const state = this.authState.get(socketId);
        if (!state || ++state.attempts > SERVER_CONFIG.MAX_AUTH_ATTEMPTS) {
          ws.close(4003, "too many auth attempts");
          break;
        }
        handleAuthLogin({
          worldManager: this.worldManager,
          profileManager: this.profileManager,
          sendToSocket: this.sendToSocket.bind(this),
          broadcastToZone: this.broadcastToZone.bind(this),
          kickSession: this.kickSession.bind(this)
        }, ws, socketId, payload).catch((e) => console.error("[Auth] Unexpected:", e));
        break;
      }
      case EVENTS.PLAYER_MOVE_REQUEST:
        handleMoveRequest(this.worldManager, ws, socketId, payload, this.sendToSocket.bind(this), this.broadcastToZone.bind(this), this.movement);
        break;
      case EVENTS.CHAT_SEND:
        handleChatSend(this.worldManager, ws, socketId, payload, this.sendToSocket.bind(this), this.broadcastToZone.bind(this));
        break;
      case EVENTS.APPEARANCE_SET:
        handleAppearanceSet(this.worldManager, ws, socketId, payload, this.sendToSocket.bind(this), this.broadcastToZone.bind(this));
        break;
      case EVENTS.ONBOARDING_COMPLETE:
        handleOnboardingComplete({
          world: this.worldManager, send: this.sendToSocket.bind(this), profileManager: this.profileManager,
          teleportHome: this.teleportHome
        }, ws, socketId, payload).catch((e) => console.error("[Onboarding] Unexpected:", e));
        break;
      case EVENTS.OBJECT_INTERACT:
        handleObjectInteract(this.worldManager, socketId, payload);
        break;
      case EVENTS.ACTIVITY_CANCEL:
        handleActivityCancel(this.worldManager, socketId);
        break;
      default:
        console.log(`[WS] Unknown message type: ${type}`);
    }
  }
  
  sendToSocket(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  broadcastToZone(zoneId, message, excludePlayerId = null) {
    const playerIds = this.worldManager.zoneManager.getPlayersInZone(zoneId);
    for (const playerId of playerIds) {
      if (excludePlayerId && playerId === excludePlayerId) continue;
      const player = this.worldManager.playerManager.getPlayer(playerId);
      if (!player) continue;
      const ws = this.getSocketById(player.socketId);
      if (ws) {
        this.sendToSocket(ws, message);
      }
    }
  }
  
  getSocketById(socketId) {
    return this.clients.get(socketId);
  }
}
