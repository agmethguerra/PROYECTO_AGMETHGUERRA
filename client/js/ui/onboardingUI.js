// =============================================================================
// Asistente inicial de una cuenta nueva: avatar -> empleo -> vivienda.
// El servidor valida todo (apariencia, que el empleo/vivienda existan y que te alcance el depósito).
// =============================================================================
import { avatarData } from "../avatars/avatarData.js";
import { spriteLoader } from "../avatars/spriteLoader.js";
import { SpriteDrawer } from "../avatars/spriteDrawer.js";

const DIRS = ["down", "right", "up", "left"];

/** HTML de una cantidad con el símbolo de la moneda (infinito vertical plateado). */
export function moneyHtml(n, name = "Infinitas") {
  return `<span class="money"><img src="assets/ui/infinita.svg" alt="" class="money-icon"><b>${n}</b> <span class="money-name">${name}</span></span>`;
}

export class OnboardingUI {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.step = 0;
    this.timer = null;
  }

  show(data) {
    this.data = data;
    this.appearance = JSON.parse(JSON.stringify(data.appearance));
    this.jobId = null;
    this.housingId = null;
    this.step = 0;
    this.busy = false;
    if (!this.root) {
      this.root = document.createElement("div");
      this.root.className = "modal onb-modal";
      document.body.appendChild(this.root);
    }
    this.root.hidden = false;
    this.root.style.display = "flex";
    this.render();
  }

  hide() {
    if (!this.root) return;
    this.root.style.display = "none";
    this.stopPreview();
  }

  showError(message) {
    this.busy = false;
    const el = this.root?.querySelector(".onb-error");
    if (el) el.textContent = message;
    const btn = this.root?.querySelector("#onb-next");
    if (btn) btn.disabled = false;
  }

  render() {
    const titles = ["1. Tu personaje", "2. ¿En qué quieres trabajar?", "3. ¿Dónde quieres vivir?"];
    this.root.innerHTML = `
      <div class="modal-content onb-card">
        <div class="modal-header"><h2>${titles[this.step]}</h2>
          <span class="onb-funds">${moneyHtml(this.data.balance, this.data.currency.name)}</span></div>
        <div class="onb-steps">${[0, 1, 2].map((i) => `<i class="${i === this.step ? "on" : i < this.step ? "done" : ""}"></i>`).join("")}</div>
        <div class="onb-body" id="onb-body"></div>
        <div class="onb-error" role="alert"></div>
        <div class="modal-footer onb-footer">
          <button type="button" id="onb-back" class="onb-secondary" ${this.step === 0 ? "hidden" : ""}>Atrás</button>
          <button type="button" id="onb-next" class="apply-btn">${this.step === 2 ? "Empezar mi vida" : "Siguiente"}</button>
        </div>
      </div>`;
    this.stopPreview();
    [this.renderAvatar, this.renderJobs, this.renderHousing][this.step].call(this, this.root.querySelector("#onb-body"));
    this.root.querySelector("#onb-back").addEventListener("click", () => { this.step--; this.render(); });
    this.root.querySelector("#onb-next").addEventListener("click", () => this.next());
    this.updateNext();
  }

  updateNext() {
    const btn = this.root.querySelector("#onb-next");
    btn.disabled = (this.step === 1 && !this.jobId) || (this.step === 2 && !this.housingId) || this.busy;
  }

  next() {
    this.root.querySelector(".onb-error").textContent = "";
    if (this.step < 2) { this.step++; this.render(); return; }
    this.busy = true;
    this.updateNext();
    this.game.network.completeOnboarding({
      appearance: { ...this.appearance, spriteId: spriteLoader.resolveCharacterId(this.appearance) },
      jobId: this.jobId,
      housingId: this.housingId
    });
  }

  // ---- Paso 1: avatar -------------------------------------------------------
  renderAvatar(body) {
    body.innerHTML = `
      <p class="onb-help">Elige tu personaje. Más adelante podrás cambiar tu aspecto desde el botón «Cambiar avatar».</p>
      <div class="onb-avatar"><canvas id="onb-preview" width="160" height="240"></canvas><div id="onb-genders"></div></div>`;
    const box = body.querySelector("#onb-genders");
    for (const char of spriteLoader.config?.characters || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "avatar-option-btn" + (this.appearance.gender === char.gender ? " active" : "");
      b.textContent = char.name;
      b.addEventListener("click", () => {
        this.appearance = JSON.parse(JSON.stringify(avatarData.getDefault(char.gender)));
        box.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
        this.drawPreview();
      });
      box.appendChild(b);
    }
    this.canvas = body.querySelector("#onb-preview");
    this.drawer = new SpriteDrawer(this.canvas.getContext("2d"));
    this.dirIdx = 0;
    this.drawPreview();
    this.timer = setInterval(() => { this.dirIdx = (this.dirIdx + 1) % DIRS.length; this.drawPreview(); }, 900);
  }

  drawPreview() {
    const ctx = this.canvas.getContext("2d");
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2, feetY = height - 22;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath(); ctx.ellipse(cx, feetY, 42, 21, 0, 0, Math.PI * 2); ctx.stroke();
    this.drawer.drawFrame(spriteLoader.resolveCharacterId(this.appearance), DIRS[this.dirIdx], 0, cx, feetY, 1);
  }

  stopPreview() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // ---- Paso 2: empleo -------------------------------------------------------
  renderJobs(body) {
    body.innerHTML = `<p class="onb-help">Cobrarás un sueldo por cada día del juego (7 horas reales). Los trabajos de cara al público pueden recibir propinas.</p><div class="onb-list"></div>`;
    const list = body.querySelector(".onb-list");
    for (const j of this.data.jobs) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "onb-option" + (this.jobId === j.id ? " selected" : "");
      card.innerHTML = `<div class="onb-opt-head"><b>${j.name}</b><span>${j.place}</span></div>
        <div class="onb-opt-line">Sueldo: ${moneyHtml(j.payPerGameDay, "/ día")} <span class="tag ${j.tips ? "tips" : ""}">${j.tips ? "Con propinas" : "Sin propinas"}</span></div>
        <small>${j.description}</small>`;
      card.addEventListener("click", () => {
        this.jobId = j.id;
        list.querySelectorAll(".onb-option").forEach((x) => x.classList.toggle("selected", x === card));
        this.updateNext();
      });
      list.appendChild(card);
    }
  }

  // ---- Paso 3: vivienda -----------------------------------------------------
  renderHousing(body) {
    body.innerHTML = `<p class="onb-help">Pagas un depósito ahora y una renta por día del juego. Tu casa es privada: solo entras tú.</p><div class="onb-list"></div>
      <p class="onb-note">El cobro automático de renta y sueldos se activa en la próxima actualización.</p>`;
    const list = body.querySelector(".onb-list");
    for (const h of this.data.housing) {
      const afford = h.deposit <= this.data.balance;
      const card = document.createElement("button");
      card.type = "button";
      card.disabled = !afford;
      card.className = "onb-option" + (this.housingId === h.id ? " selected" : "");
      card.innerHTML = `<div class="onb-opt-head"><b>${h.name}</b><span>Te quedan ${moneyHtml(this.data.balance - h.deposit, "")}</span></div>
        <div class="onb-opt-line">Depósito: ${moneyHtml(h.deposit, "")} · Renta: ${moneyHtml(h.rentPerGameDay, "/ día")}</div>
        <small>${afford ? h.description : "No te alcanza para el depósito."}</small>`;
      card.addEventListener("click", () => {
        this.housingId = h.id;
        list.querySelectorAll(".onb-option").forEach((x) => x.classList.toggle("selected", x === card));
        this.updateNext();
      });
      list.appendChild(card);
    }
  }
}
