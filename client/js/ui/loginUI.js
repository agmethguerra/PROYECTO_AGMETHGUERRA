// =============================================================================
// Pantalla de login. Solo maneja el formulario; la lógica de cuenta vive en
// authService y la de conexión en game.js (que le pasa callbacks).
// =============================================================================
import { authService, friendlyError } from "../auth/authService.js";

const NAME_REGEX = /^[\p{L}\p{N}_ ]{3,16}$/u; // misma regla que el servidor

export class LoginUI {
  /**
   * @param onEnter ({kind:"account"|"guest", name?}) => void  se llama cuando el jugador quiere entrar
   */
  constructor(onEnter) {
    this.onEnter = onEnter;
    this.el = document.getElementById("login-screen");
    this.form = document.getElementById("login-form");
    this.msg = document.getElementById("login-message");
    this.emailRow = document.getElementById("login-email-row");
    this.passRow = document.getElementById("login-pass-row");
    this.nameRow = document.getElementById("login-name-row");
    this.nameInput = document.getElementById("login-name");
    this.emailInput = document.getElementById("login-email");
    this.passInput = document.getElementById("login-pass");
    this.submitBtn = document.getElementById("login-submit");
    this.toggleBtn = document.getElementById("login-toggle");
    this.googleBtn = document.getElementById("login-google");
    this.guestBtn = document.getElementById("login-guest");
    this.modeNote = document.getElementById("login-mode-note");

    this.registering = false;
    this.busy = false;

    this.form.addEventListener("submit", (e) => { e.preventDefault(); this.submit(); });
    this.toggleBtn.addEventListener("click", () => this.setRegistering(!this.registering));
    this.googleBtn.addEventListener("click", () => this.google());
    this.guestBtn.addEventListener("click", () => this.onEnter({ kind: "guest" }));
    // applyMode() se llama desde game.js cuando authService ya cargó la configuración
  }

  /** Ajusta el formulario según haya Supabase real o modo desarrollo. */
  applyMode() {
    const dev = authService.mode === "dev";
    const none = authService.mode === "none";
    this.form.hidden = none;
    this.emailRow.hidden = this.passRow.hidden = dev;
    this.googleBtn.hidden = dev;
    this.toggleBtn.hidden = dev;
    this.nameRow.hidden = !(dev || this.registering);
    this.modeNote.hidden = !dev;
    this.submitBtn.textContent = dev ? "Entrar" : this.registering ? "Crear cuenta" : "Iniciar sesión";
    this.nameInput.placeholder = dev ? "Tu nombre (3-16 letras o números)" : "Nombre de jugador (3-16)";
    this.passInput.autocomplete = this.registering ? "new-password" : "current-password";
    this.toggleBtn.textContent = this.registering ? "Ya tengo cuenta" : "Crear una cuenta";
    if (none) {
      this.googleBtn.hidden = true;
      this.toggleBtn.hidden = true;
      this.showMessage("El inicio de sesión no está disponible ahora. Puedes entrar como invitado.");
    }
  }

  setRegistering(value) {
    this.registering = value;
    this.showMessage("");
    this.applyMode();
  }

  show(message = "") {
    this.el.hidden = false;
    this.setBusy(false);
    this.showMessage(message);
  }

  hide() {
    this.el.hidden = true;
  }

  showMessage(text, isError = true) {
    this.msg.textContent = text;
    this.msg.classList.toggle("ok", !isError);
  }

  setBusy(busy) {
    this.busy = busy;
    for (const b of [this.submitBtn, this.googleBtn, this.guestBtn, this.toggleBtn]) b.disabled = busy;
  }

  async submit() {
    if (this.busy) return;
    const name = this.nameInput.value.replace(/\s+/g, " ").trim();
    try {
      if (authService.mode === "dev") {
        if (!NAME_REGEX.test(name)) return this.showMessage("El nombre debe tener entre 3 y 16 letras, números, _ o espacios.");
        authService.signInDev(name);
        this.setBusy(true);
        return this.onEnter({ kind: "account", name });
      }

      const email = this.emailInput.value.trim();
      const pass = this.passInput.value;
      if (!email || !pass) return this.showMessage("Escribe tu correo y contraseña.");
      if (this.registering && !NAME_REGEX.test(name)) {
        return this.showMessage("El nombre debe tener entre 3 y 16 letras, números, _ o espacios.");
      }
      this.setBusy(true);
      this.showMessage("Verificando...", false);
      if (this.registering) {
        const { needsConfirm } = await authService.registerEmail(email, pass, name);
        if (needsConfirm) {
          // El proyecto exige confirmar el correo: no hay sesión hasta que lo haga
          this.setBusy(false);
          this.setRegistering(false);
          return this.showMessage("Cuenta creada. Te enviamos un correo: confírmalo y luego inicia sesión.", false);
        }
      } else {
        await authService.signInEmail(email, pass);
      }
      this.onEnter({ kind: "account", name: this.registering ? name : undefined });
    } catch (e) {
      this.setBusy(false);
      this.showMessage(friendlyError(e));
    }
  }

  async google() {
    if (this.busy) return;
    try {
      this.setBusy(true);
      this.showMessage("Abriendo Google...", false);
      await authService.signInGoogle();
      this.onEnter({ kind: "account" });
    } catch (e) {
      this.setBusy(false);
      this.showMessage(friendlyError(e));
    }
  }
}
