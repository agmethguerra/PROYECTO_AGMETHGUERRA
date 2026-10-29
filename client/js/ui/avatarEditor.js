import { avatarData } from "../avatars/avatarData.js";
import { spriteLoader } from "../avatars/spriteLoader.js";
import { SpriteDrawer } from "../avatars/spriteDrawer.js";

const PREVIEW_DIRECTIONS = ["down", "right", "up", "left"];

export class AvatarEditor {
  constructor(game) {
    this.game = game;
    this.modal = document.getElementById("avatar-editor");
    this.closeBtn = document.getElementById("avatar-editor-close");
    this.applyBtn = document.getElementById("avatar-editor-apply");
    this.previewCanvas = document.getElementById("avatar-preview");
    this.optionsContainer = document.getElementById("avatar-slots");

    this.previewCtx = this.previewCanvas?.getContext("2d");
    this.spriteDrawer = new SpriteDrawer(this.previewCtx);

    this.currentAppearance = null;
    this.previewTimer = null;
    this.previewStep = 0;

    this.closeBtn?.addEventListener("click", () => this.hide());
    this.applyBtn?.addEventListener("click", () => this.apply());
    this.modal?.addEventListener("click", (e) => {
      if (e.target === this.modal) this.hide();
    });

    document.getElementById("btn-personalizar")?.addEventListener("click", () => this.show());
  }

  async show() {
    await avatarData.load();
    if (!this.game.gameState.self) return;

    const current = this.game.gameState.self.appearance || avatarData.getDefault("male");
    this.currentAppearance = JSON.parse(JSON.stringify(current));
    this.modal.style.display = "flex";
    this.render();
    this.startPreview();
  }

  hide() {
    this.modal.style.display = "none";
    this.stopPreview();
  }

  selectGender(gender) {
    if (this.currentAppearance.gender === gender) return;
    this.currentAppearance = JSON.parse(JSON.stringify(avatarData.getDefault(gender)));
    this.render();
    this.drawPreview();
  }

  render() {
    if (!this.optionsContainer) return;
    this.optionsContainer.innerHTML = "";

    const chars = spriteLoader.config?.characters || [];
    for (const char of chars) {
      const btn = document.createElement("button");
      btn.className = "avatar-option-btn";
      if (this.currentAppearance.gender === char.gender) btn.classList.add("active");
      btn.textContent = char.name;
      btn.addEventListener("click", () => this.selectGender(char.gender));
      this.optionsContainer.appendChild(btn);
    }
  }

  startPreview() {
    this.stopPreview();
    this.previewStep = 0;
    this.drawPreview();
    // El avatar gira solo para que se vean las cuatro direcciones.
    this.previewTimer = setInterval(() => {
      this.previewStep = (this.previewStep + 1) % PREVIEW_DIRECTIONS.length;
      this.drawPreview();
    }, 900);
  }

  stopPreview() {
    if (this.previewTimer) clearInterval(this.previewTimer);
    this.previewTimer = null;
  }

  drawPreview() {
    if (!this.previewCtx || !this.previewCanvas || !this.currentAppearance) return;
    const { width, height } = this.previewCanvas;
    this.previewCtx.clearRect(0, 0, width, height);

    // Base blanca tenue, como la casilla del juego
    const cx = width / 2;
    const feetY = height - 22;
    this.previewCtx.save();
    this.previewCtx.strokeStyle = "rgba(255,255,255,0.35)";
    this.previewCtx.beginPath();
    this.previewCtx.ellipse(cx, feetY, 42, 21, 0, 0, Math.PI * 2);
    this.previewCtx.stroke();
    this.previewCtx.restore();

    const charId = spriteLoader.resolveCharacterId(this.currentAppearance);
    this.spriteDrawer.drawFrame(charId, PREVIEW_DIRECTIONS[this.previewStep], 0, cx, feetY, 1);
  }

  apply() {
    if (!this.game.network) return;
    const appearance = {
      ...this.currentAppearance,
      spriteId: spriteLoader.resolveCharacterId(this.currentAppearance)
    };
    this.game.network.send("appearance:set", { appearance });
    this.hide();
  }
}
