// =============================================================================
// SimUI: lo que ve el jugador de la simulación de vida (Fase 5)
//   - barras de salud y necesidades, saldo en Infinitas, reloj del juego, raciones
//   - menú de acciones al hacer clic en un objeto (nevera, cama, baño...)
//   - barra de progreso de la actividad en curso
// El servidor decide todo; esta clase solo muestra y envía peticiones.
// =============================================================================
import { EVENTS } from "/shared/config/events.js";
import { getGameTime } from "/shared/config/time.js";
import { OnboardingUI, moneyHtml } from "./onboardingUI.js";

const BARS = [
  { id: "health", label: "Salud", icon: "❤", color: "#e0575b" },
  { id: "hunger", label: "Hambre", icon: "🍽", color: "#e3a23c" },
  { id: "thirst", label: "Sed", icon: "💧", color: "#4aa3df" },
  { id: "bladder", label: "Vejiga", icon: "🚻", color: "#d6c447" },
  { id: "energy", label: "Energía", icon: "⚡", color: "#8f80e6" },
  { id: "hygiene", label: "Higiene", icon: "🚿", color: "#4cc3a8" }
];
const ITEM_NAMES = { ration: ["ración", "raciones"] };
const itemText = (k, n) => `${n} ${ITEM_NAMES[k] ? ITEM_NAMES[k][n === 1 ? 0 : 1] : k}`;
const MAX_DISTANCE = 2; // igual que en el servidor

export class SimUI {
  constructor(game) {
    this.game = game;
    this.ready = false;
    this.clockOffset = 0;
    this.currency = { name: "Infinitas", singular: "Infinita" };
    this.pending = null; // { objectId, action, x, y }: ir hasta el objeto y usarlo al llegar
    this.activity = null;
    this.onboarding = new OnboardingUI(game);
    this.build();
    setInterval(() => this.updateClock(), 1000);
  }

  build() {
    const root = document.getElementById("ui-overlay");
    this.hud = document.createElement("div");
    this.hud.id = "sim-hud";
    this.hud.hidden = true;
    this.hud.innerHTML = `
      <div class="sim-money"><span id="sim-balance"></span><span id="sim-delta"></span></div>
      <div class="sim-clock"><span id="sim-clock-icon">☀</span><span id="sim-clock"></span></div>
      <div class="sim-bars">${BARS.map((b) => `
        <div class="sim-bar" data-need="${b.id}" title="${b.label}">
          <span class="sim-bar-icon">${b.icon}</span>
          <div class="sim-bar-track"><div class="sim-bar-fill" style="background:${b.color}"></div></div>
          <span class="sim-bar-val">100</span>
        </div>`).join("")}
      </div>
      <div class="sim-inv" id="sim-inv"></div>
      <div class="sim-job" id="sim-job"></div>`;
    root.appendChild(this.hud);

    this.bar = document.createElement("div");
    this.bar.id = "activity-bar";
    this.bar.hidden = true;
    this.bar.innerHTML = `<span id="activity-label"></span><div class="activity-track"><div id="activity-fill"></div></div><button id="activity-cancel" type="button">Cancelar</button>`;
    root.appendChild(this.bar);
    this.bar.querySelector("#activity-cancel").addEventListener("click", () => this.game.network.cancelActivity());

    this.menu = document.createElement("div");
    this.menu.id = "object-menu";
    this.menu.hidden = true;
    document.body.appendChild(this.menu);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") this.closeMenu(); });

    this.els = {
      balance: this.hud.querySelector("#sim-balance"),
      delta: this.hud.querySelector("#sim-delta"),
      clock: this.hud.querySelector("#sim-clock"),
      clockIcon: this.hud.querySelector("#sim-clock-icon"),
      inv: this.hud.querySelector("#sim-inv"),
      job: this.hud.querySelector("#sim-job")
    };
  }

  // ---- Mensajes del servidor -------------------------------------------------
  handle(type, p) {
    switch (type) {
      case EVENTS.ONBOARDING_REQUIRED:
        this.ready = false;
        this.hud.hidden = true;
        this.currency = p.currency || this.currency;
        this.onboarding.show(p);
        break;
      case EVENTS.ONBOARDING_ERROR:
        this.onboarding.showError(p.message);
        break;
      case EVENTS.SIM_STATE:
        this.onboarding.hide();
        this.ready = true;
        this.currency = p.currency || this.currency;
        this.clockOffset = (p.serverNow || Date.now()) - Date.now();
        this.hud.hidden = false;
        this.setNeeds(p);
        this.setBalance(p.balance);
        this.setInventory(p.inventory || {});
        this.els.job.textContent = p.job ? `${p.job.name}${p.housing ? " · " + p.housing.name : ""}` : "";
        this.els.job.hidden = !p.job;
        this.updateClock();
        break;
      case EVENTS.NEEDS_UPDATE:
        this.setNeeds(p);
        break;
      case EVENTS.ECON_BALANCE:
        this.setBalance(p.balance, p.delta);
        break;
      case EVENTS.INVENTORY_UPDATE:
        this.setInventory(p.inventory || {});
        break;
      case EVENTS.ACTIVITY_START:
        this.pending = null;
        this.activity = { ...p, startedAt: performance.now() };
        this.bar.hidden = false;
        this.bar.querySelector("#activity-label").textContent = p.label;
        this.animateActivity();
        break;
      case EVENTS.ACTIVITY_END:
        this.activity = null;
        this.bar.hidden = true;
        break;
      case EVENTS.PLAYER_STATUS: {
        const e = this.game.entityManager.getEntity(p.id);
        if (e) e.status = p.text || null;
        break;
      }
    }
  }

  setNeeds({ health, needs }) {
    const all = { health, ...needs };
    for (const b of BARS) {
      const v = all[b.id];
      if (v === undefined) continue;
      const row = this.hud.querySelector(`[data-need="${b.id}"]`);
      row.querySelector(".sim-bar-fill").style.width = `${v}%`;
      row.querySelector(".sim-bar-val").textContent = v;
      row.classList.toggle("low", v <= 25);
      row.classList.toggle("critical", v <= 8);
    }
  }

  setBalance(balance, delta) {
    this.balance = balance;
    this.els.balance.innerHTML = moneyHtml(balance, this.currency.name);
    if (delta) {
      const d = this.els.delta;
      d.textContent = (delta > 0 ? "+" : "") + delta;
      d.className = delta > 0 ? "gain" : "loss";
      d.style.animation = "none"; void d.offsetWidth; d.style.animation = "";
    }
  }

  setInventory(inv) {
    const parts = Object.entries(inv).map(([k, v]) => itemText(k, v));
    this.els.inv.textContent = parts.length ? `🎒 ${parts.join(" · ")}` : "🎒 Vacío";
  }

  updateClock() {
    if (!this.ready) return;
    const t = getGameTime(Date.now() + this.clockOffset);
    this.els.clock.textContent = t.label;
    this.els.clockIcon.textContent = t.hour >= 6 && t.hour < 19 ? "☀" : "☾";
  }

  animateActivity() {
    const fill = this.bar.querySelector("#activity-fill");
    const tick = () => {
      if (!this.activity) return;
      const f = Math.min(1, (performance.now() - this.activity.startedAt) / this.activity.durationMs);
      fill.style.width = `${f * 100}%`;
      requestAnimationFrame(tick);
    };
    tick();
  }

  // ---- Menú de acciones sobre objetos -----------------------------------------
  openObjectMenu(obj, clientX, clientY) {
    if (this.activity) return;
    this.menu.innerHTML = `<div class="om-title">${this.objectTitle(obj)}</div>`;
    for (const a of obj.actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      const secs = a.durationMs ? `${Math.round(a.durationMs / 1000)} s` : "";
      const cons = a.consumes ? ` · usa ${Object.entries(a.consumes).map(([k, v]) => itemText(k, v)).join(", ")}` : "";
      btn.innerHTML = `${a.label}<small>${secs}${cons}</small>`;
      btn.addEventListener("click", () => { this.closeMenu(); this.use(obj, a.id); });
      this.menu.appendChild(btn);
    }
    this.menu.hidden = false;
    const w = this.menu.offsetWidth, h = this.menu.offsetHeight;
    this.menu.style.left = `${Math.max(8, Math.min(clientX + 8, innerWidth - w - 8))}px`;
    this.menu.style.top = `${Math.max(8, Math.min(clientY + 8, innerHeight - h - 8))}px`;
  }

  objectTitle(obj) {
    return { bed: "Cama", fridge: "Nevera", sink: "Lavabo", toilet: "Inodoro", shower: "Ducha" }[obj.type] || obj.type;
  }

  closeMenu() {
    this.menu.hidden = true;
  }

  clearPending() {
    this.pending = null;
  }

  /** Usa el objeto: si estás cerca lo hace ya; si no, camina hasta una celda libre pegada a él. */
  use(obj, action) {
    const me = this.game.gameState.self;
    if (!me) return;
    const dist = (x, y) => Math.max(obj.x - x, 0, x - (obj.x + obj.w - 1)) + Math.max(obj.y - y, 0, y - (obj.y + obj.h - 1));
    if (dist(me.x, me.y) <= MAX_DISTANCE) {
      this.game.network.interact(obj.id, action);
      return;
    }
    const target = this.freeCellNear(obj, me);
    if (!target) return;
    this.pending = { objectId: obj.id, action, x: target.x, y: target.y };
    this.game.setDestination(target);
    this.game.network.moveRequest(target.x, target.y, { keepPending: true });
  }

  freeCellNear(obj, me) {
    const z = this.game.gameState.zone;
    const blockedObj = new Set();
    for (const o of z.objects || []) {
      if (!o.blocks) continue;
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) blockedObj.add(`${x},${y}`);
    }
    const exits = new Set((z.exits || []).map((e) => `${e.x},${e.y}`));
    let best = null;
    for (let y = obj.y - 1; y <= obj.y + obj.h; y++) {
      for (let x = obj.x - 1; x <= obj.x + obj.w; x++) {
        const inside = x >= obj.x && x < obj.x + obj.w && y >= obj.y && y < obj.y + obj.h;
        if (inside || x < 0 || y < 0 || x >= z.width || y >= z.height) continue;
        if ((x < obj.x || x >= obj.x + obj.w) && (y < obj.y || y >= obj.y + obj.h)) continue; // sin diagonales
        if (z.collision?.[y]?.[x] || blockedObj.has(`${x},${y}`) || exits.has(`${x},${y}`)) continue;
        const d = Math.abs(x - me.x) + Math.abs(y - me.y);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    return best;
  }

  /** El servidor confirmó un paso: si llegamos al destino de una acción pendiente, se usa el objeto. */
  onArrive(x, y) {
    const p = this.pending;
    if (p && p.x === x && p.y === y) {
      this.pending = null;
      this.game.network.interact(p.objectId, p.action);
    }
  }
}
