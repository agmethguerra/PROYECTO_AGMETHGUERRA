import { GameState } from "../world/state.js";
import { Camera } from "./camera.js";
import { Renderer } from "../render/renderer.js";
import { NetworkClient } from "../network/socket.js";
import { MouseInput } from "../input/mouse.js";
import { KeyboardInput } from "../input/keyboard.js";
import { ChatUI } from "../ui/chat.js";
import { HUD } from "../ui/hud.js";
import { PlayersUI } from "../ui/players.js";
import { EntityManager } from "../world/entities.js";
import { AvatarEditor } from "../ui/avatarEditor.js";
import { avatarData } from "../avatars/avatarData.js";
import { spriteLoader } from "../avatars/spriteLoader.js";
import { gridToScreen } from "../iso/math.js";
import { pickCell } from "../iso/pick.js";
import { CLIENT_CONFIG } from "./config.js";
import { EVENTS } from "/shared/config/events.js";
import { authService } from "../auth/authService.js";
import { LoginUI } from "../ui/loginUI.js";
import { SimUI } from "../ui/simUI.js";

class Game {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.gameState = new GameState();
    this.camera = new Camera(this.canvas);
    this.renderer = new Renderer(this.canvas, this.gameState);
    this.network = new NetworkClient(this);
    this.mouseInput = new MouseInput(this.canvas, this);
    this.keyboardInput = new KeyboardInput(this);
    this.chatUI = new ChatUI(this);
    this.hud = new HUD();
    this.playersUI = new PlayersUI();
    this.entityManager = new EntityManager();
    this.sim = new SimUI(this);
    this.renderer.entityManager = this.entityManager;
    this.avatarEditor = null;
    
    this.lastTime = 0;
    this.mousePos = { x: 0, y: 0 };
    
    this.init();
  }
  
  async init() {
    await avatarData.load();
    await spriteLoader.load();
    this.avatarEditor = new AvatarEditor(this);
    
    this.renderer.resize();
    window.addEventListener("resize", () => this.renderer.resize());
    
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;
      
      const cell = this.pickAt(this.mousePos.x, this.mousePos.y);
      this.renderer.setMouseCell(cell);
      this.canvas.style.cursor = cell.object?.actions?.length ? "help" : "pointer";
      this.hud.updateCoords(cell.x, cell.y);
    });
    
    document.addEventListener("keydown", (e) => {
      const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if (!typing && e.key === "Enter") {
        e.preventDefault();
        document.getElementById("chat-input")?.focus();
      }
      if (!typing && (e.key === "g" || e.key === "G")) {
        this.renderer.toggleDebug();
      }
    });
    
    this.startAuth(); // la conexión al servidor empieza cuando el jugador se identifica
    this.gameLoop();
  }

  // ---------------------------------------------------------------------------
  // Fase 3: identificación (login / invitado)
  // ---------------------------------------------------------------------------
  async startAuth() {
    this.loginUI = new LoginUI((choice) => this.enter(choice));
    document.getElementById("btn-logout").addEventListener("click", () => this.logout());

    let restored = null;
    try {
      restored = await authService.init();
    } catch (error) {
      console.error("[Auth] No se pudo iniciar el login:", error);
    }
    this.loginUI.applyMode();

    // Si ya había una sesión abierta de antes, entramos directamente
    if (restored) this.enter({ kind: "account" });
    else this.loginUI.show();
  }

  /** Configura cómo se identificará la conexión y la abre. */
  enter(choice) {
    if (this.network.isActive()) return;

    if (choice.kind === "guest") {
      this.network.authProvider = async () => ({ type: EVENTS.AUTH_ANON, payload: {} });
    } else {
      let firstName = choice.name; // el nombre solo se envía en el primer login tras registrarse
      this.network.authProvider = async () => {
        const payload = { idToken: await authService.getIdToken() };
        if (firstName) payload.name = firstName;
        firstName = undefined;
        return { type: EVENTS.AUTH_LOGIN, payload };
      };
    }
    this.loginUI.setBusy(true);
    this.loginUI.showMessage("Entrando...", false);
    this.network.shouldReconnect = true;
    this.network.connect();
  }

  handleAuthOk(payload) {
    console.log("[Game] Autenticado:", payload);
    this.loginUI.hide();
  }

  async handleAuthError(payload) {
    this.network.disconnect();
    await authService.signOut().catch(() => {});
    this.loginUI.applyMode();
    this.loginUI.show(payload?.message || "No se pudo iniciar sesión.");
  }

  async handleSessionReplaced() {
    this.network.disconnect();
    await authService.signOut().catch(() => {});
    this.loginUI.applyMode();
    this.loginUI.show("Tu cuenta se abrió en otra pestaña o dispositivo.");
  }

  async logout() {
    this.network.disconnect(); // el servidor guarda tu posición al detectar que te vas
    await authService.signOut().catch(() => {});
    location.reload();
  }
  
  gameLoop(currentTime = 0) {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    if (this.keyboardInput) {
      this.keyboardInput.update();
    }
    
    this.entityManager.update(deltaTime, (x, y) => this.heightAt(x, y));
    this.camera.update();
    this.renderer.render(this.camera);
    
    requestAnimationFrame((time) => this.gameLoop(time));
  }
  
  // ---------------------------------------------------------------------------
  // Fase 4: alturas y selección de celdas
  // ---------------------------------------------------------------------------
  heightAt(x, y) {
    return this.gameState.zone?.heightMap?.[y]?.[x] || 0;
  }

  /** Posición en pantalla de una celda teniendo en cuenta su altura (para la cámara). */
  screenPosOf(x, y) {
    const pos = gridToScreen(x, y);
    pos.y -= this.heightAt(Math.round(x), Math.round(y)) * CLIENT_CONFIG.HEIGHT_PX;
    return pos;
  }

  /** Celda bajo un punto de la pantalla, contando suelos elevados y objetos. */
  pickAt(screenX, screenY) {
    const offset = this.camera.getOffset();
    return pickCell(screenX, screenY, this.gameState.zone, offset.x, offset.y);
  }

  /** Marca la celda destino; se borra al llegar o si el servidor rechaza la ruta. */
  setDestination(cell) {
    this.renderer.destination = cell;
  }

  handleWorldSnapshot(payload) {
    console.log("[Game] World snapshot received", payload);
    
    this.gameState.setSelf(payload.self);
    this.gameState.clearPlayers();
    this.entityManager.clear();
    
    this.entityManager.addEntity({
      type: "player",
      id: payload.self.id,
      x: payload.self.x,
      y: payload.self.y,
      displayX: payload.self.x,
      displayY: payload.self.y,
      targetX: payload.self.x,
      targetY: payload.self.y,
      name: payload.self.name,
      dir: payload.self.dir || "down",
      appearance: payload.self.appearance
    });
    
    for (const player of payload.players) {
      this.gameState.addPlayer(player);
      this.entityManager.addEntity({
        type: "player",
        id: player.id,
        x: player.x,
        y: player.y,
        displayX: player.x,
        displayY: player.y,
        targetX: player.x,
        targetY: player.y,
        name: player.name,
        dir: player.dir || "down",
        appearance: player.appearance
      });
    }
    
    this.gameState.setZone(payload.zone);
    this.playersUI.updatePlayers(payload.players, payload.self.id);
    
    this.hud.updateZone(payload.zone);
    this.hud.updatePlayer(payload.self);
    
    const pos = this.screenPosOf(payload.self.x, payload.self.y);
    this.camera.follow(pos.x, pos.y);
    this.camera.x = this.camera.targetX;
    this.camera.y = this.camera.targetY;
  }
  
  handlePlayerJoined(payload) {
    console.log("[Game] Player joined", payload);
    this.gameState.addPlayer(payload);
    this.entityManager.addEntity({
      type: "player",
      id: payload.id,
      x: payload.x,
      y: payload.y,
      displayX: payload.x,
      displayY: payload.y,
      targetX: payload.x,
      targetY: payload.y,
      name: payload.name,
      dir: payload.dir || "down",
      appearance: payload.appearance
    });
    this.playersUI.addPlayer(payload, this.gameState.self?.id);
  }
  
  handlePlayerLeft(payload) {
    console.log("[Game] Player left", payload);
    this.gameState.removePlayer(payload.id);
    this.entityManager.removeEntity(payload.id);
    this.playersUI.removePlayer(payload.id);
  }
  
  handlePlayerMoved(payload) {
    if (payload.id === this.gameState.self?.id) return;
    this.gameState.updatePlayer(payload.id, {
      x: payload.x,
      y: payload.y,
      dir: payload.dir
    });
    this.entityManager.updateEntity(payload.id, {
      targetX: payload.x,
      targetY: payload.y,
      dir: payload.dir
    });
  }
  
  handleMoveAccept(payload) {
    if (this.gameState.self) {
      this.gameState.self.x = payload.x;
      this.gameState.self.y = payload.y;
      if (payload.dir) this.gameState.self.dir = payload.dir;
      
      this.entityManager.updateEntity(this.gameState.self.id, {
        targetX: payload.x,
        targetY: payload.y,
        dir: payload.dir
      });
      
      const pos = this.screenPosOf(payload.x, payload.y);
      this.camera.follow(pos.x, pos.y);

      const dest = this.renderer.destination;
      if (dest && dest.x === payload.x && dest.y === payload.y) this.setDestination(null);
      this.sim.onArrive(payload.x, payload.y);
    }
  }
  
  handleMoveReject(payload) {
    console.log("[Game] Movimiento rechazado:", payload.reason);
    this.setDestination(null);
    this.sim.clearPending();
    const texts = { no_path: "No hay camino hasta ahí.", blocked: "Ese sitio está ocupado." };
    const now = Date.now();
    if (texts[payload.reason] && now - (this.lastRejectMsg || 0) > 2500) {
      this.lastRejectMsg = now;
      this.chatUI.addMessage({ type: "system", text: texts[payload.reason], timestamp: now });
    }
  }
  
  handleZoneChange(payload) {
    console.log("[Game] Zone change:", payload);
    this.gameState.clearPlayers();
    this.entityManager.clear();
    this.playersUI.clear();
    this.setDestination(null);
    this.sim.clearPending();
    this.sim.closeMenu();
  }
  
  handleChatMessage(payload) {
    this.chatUI.addMessage(payload);

    // Globo de chat sobre el avatar que habló
    if (payload.type !== "system" && payload.playerId) {
      const entity = this.entityManager.getEntity(payload.playerId);
      if (entity) {
        entity.bubble = { text: payload.text, until: Date.now() + 6000 };
      }
    }
  }

  handleAppearanceUpdate(payload) {
    if (payload.playerId) {
      this.gameState.updatePlayer(payload.playerId, { appearance: payload.appearance });
      const entity = this.entityManager.getEntity(payload.playerId);
      if (entity) {
        entity.appearance = payload.appearance;
      }
    } else if (payload.appearance && this.gameState.self) {
      this.gameState.self.appearance = payload.appearance;
      const entity = this.entityManager.getEntity(this.gameState.self.id);
      if (entity) {
        entity.appearance = payload.appearance;
      }
    }
  }
}

const game = new Game();
// Con ?debug en la URL se expone el juego en la consola (window.__game) para depurar y probar
if (new URLSearchParams(location.search).has("debug")) window.__game = game;
