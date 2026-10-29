import { EVENTS } from "/shared/config/events.js";
import { authService } from "../auth/authService.js";

export class NetworkClient {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.connected = false;
    // Fase 3: función que devuelve el mensaje de identificación {type,payload}.
    // Se vuelve a llamar en cada reconexión para usar un token fresco.
    this.authProvider = null;
    this.shouldReconnect = true;
    this.reconnectTimer = null;
  }

  /** Cierra la conexión y NO intenta reconectar (cerrar sesión, sesión reemplazada...). */
  disconnect() {
    this.shouldReconnect = false;
    clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }

  /** ¿Hay ya una conexión abierta o abriéndose? */
  isActive() {
    return !!this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING);
  }

  connect() {
    // En Vercel el servidor del juego vive en otro dominio: viene en config.json (wsUrl).
    // En local (sin wsUrl) se usa el mismo servidor que sirvió la página.
    let url = authService.config?.wsUrl;
    if (!url) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      const port = window.location.port || "8080";
      url = `${protocol}//${host}:${port}`;
    }
    
    console.log(`[Network] Connecting to ${url}`);
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => {
      console.log("[Network] Connected");
      this.connected = true;
      // Identificarse es lo primero: el servidor ignora todo hasta saber quién eres
      if (this.authProvider) {
        Promise.resolve(this.authProvider())
          .then((msg) => msg && this.send(msg.type, msg.payload))
          .catch((e) => this.game.handleAuthError({ message: "No se pudo obtener tu sesión. Inicia sesión de nuevo." }));
      }
    };
    
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (error) {
        console.error("[Network] Error parsing message:", error);
      }
    };
    
    this.ws.onclose = () => {
      console.log("[Network] Disconnected");
      this.connected = false;
      // Intentar reconectar después de 2 segundos (salvo que lo hayamos cerrado a propósito)
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error("[Network] Error:", error);
    };
  }
  
  handleMessage(msg) {
    const { type, payload } = msg;
    
    switch (type) {
      case EVENTS.AUTH_OK:
        this.game.handleAuthOk(payload);
        break;
      case EVENTS.AUTH_ERROR:
        this.game.handleAuthError(payload);
        break;
      case EVENTS.SESSION_REPLACED:
        this.game.handleSessionReplaced();
        break;
      case EVENTS.WORLD_SNAPSHOT:
        this.game.handleWorldSnapshot(payload);
        break;
      case EVENTS.PLAYER_JOINED:
        this.game.handlePlayerJoined(payload);
        break;
      case EVENTS.PLAYER_LEFT:
        this.game.handlePlayerLeft(payload);
        break;
      case EVENTS.PLAYER_MOVED:
        this.game.handlePlayerMoved(payload);
        break;
      case EVENTS.PLAYER_MOVE_ACCEPT:
        this.game.handleMoveAccept(payload);
        break;
      case EVENTS.PLAYER_MOVE_REJECT:
        this.game.handleMoveReject(payload);
        break;
      case EVENTS.ZONE_CHANGE:
        this.game.handleZoneChange(payload);
        break;
      case EVENTS.CHAT_MSG:
        this.game.handleChatMessage(payload);
        break;
      case EVENTS.APPEARANCE_UPDATE:
        if (this.game.handleAppearanceUpdate) {
          this.game.handleAppearanceUpdate(payload);
        }
        break;
      case EVENTS.ONBOARDING_REQUIRED:
      case EVENTS.ONBOARDING_ERROR:
      case EVENTS.SIM_STATE:
      case EVENTS.NEEDS_UPDATE:
      case EVENTS.ECON_BALANCE:
      case EVENTS.INVENTORY_UPDATE:
      case EVENTS.ACTIVITY_START:
      case EVENTS.ACTIVITY_END:
      case EVENTS.PLAYER_STATUS:
        this.game.sim?.handle(type, payload);
        break;
      case EVENTS.ERROR:
        console.error("[Server Error]:", payload.message);
        break;
      default:
        console.log("[Network] Unknown message:", type);
    }
  }
  
  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }
  
  moveRequest(targetX, targetY, { keepPending = false } = {}) {
    if (!keepPending) this.game.sim?.clearPending(); // un movimiento manual cancela "ir a usar el objeto"
    this.send(EVENTS.PLAYER_MOVE_REQUEST, { target: { x: targetX, y: targetY } });
  }
  
  sendChat(text) {
    this.send(EVENTS.CHAT_SEND, { text });
  }

  interact(objectId, action) {
    this.send(EVENTS.OBJECT_INTERACT, { objectId, action });
  }

  cancelActivity() {
    this.send(EVENTS.ACTIVITY_CANCEL, {});
  }

  completeOnboarding(data) {
    this.send(EVENTS.ONBOARDING_COMPLETE, data);
  }

  setAppearance(appearance) {
    this.send(EVENTS.APPEARANCE_SET, { appearance });
  }
}
