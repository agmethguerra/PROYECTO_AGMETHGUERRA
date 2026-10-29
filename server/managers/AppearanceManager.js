import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { DEFAULT_GENDER, isValidGender } from "../../shared/config/appearance.js";

const SPRITE_IDS = {
  male: "char_male_01",
  female: "char_female_01"
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AppearanceManager {
  constructor() {
    this.parts = new Map();
    this.defaults = {};
    this.slots = [];
    this.loadData();
  }

  loadData() {
    try {
      const partsData = JSON.parse(readFileSync(join(__dirname, "../../data/avatars/parts.json"), "utf-8"));
      for (const part of partsData.parts) {
        this.parts.set(part.id, part);
      }
      
      const defaultsData = JSON.parse(readFileSync(join(__dirname, "../../data/avatars/defaults.json"), "utf-8"));
      this.defaults = defaultsData.defaults;
      
      const slotsData = JSON.parse(readFileSync(join(__dirname, "../../data/avatars/slots.json"), "utf-8"));
      this.slots = slotsData.slots;
      
      console.log(`[AppearanceManager] Loaded ${this.parts.size} parts`);
    } catch (error) {
      console.error("[AppearanceManager] Error loading:", error);
    }
  }

  getDefaultAppearance(gender = DEFAULT_GENDER) {
    if (this.defaults[gender]) {
      const app = JSON.parse(JSON.stringify(this.defaults[gender]));
      app.spriteId = SPRITE_IDS[gender];
      return app;
    }
    const app = JSON.parse(JSON.stringify(this.defaults[DEFAULT_GENDER]));
    app.spriteId = SPRITE_IDS[DEFAULT_GENDER];
    return app;
  }

  validateAppearance(appearance) {
    if (!appearance || !isValidGender(appearance.gender)) {
      return this.getDefaultAppearance(DEFAULT_GENDER);
    }
    
    const result = {
      gender: appearance.gender,
      spriteId: SPRITE_IDS[appearance.gender],
      parts: {}
    };
    
    const defaultApp = this.getDefaultAppearance(appearance.gender);
    
    // Validar cada parte
    for (const slot of ["body", "hair", "top", "bottom", "shoes", "accessory"]) {
      const partId = appearance.parts?.[slot];
      if (partId === null || partId === undefined) {
        result.parts[slot] = null;
        continue;
      }
      
      const part = this.parts.get(partId);
      if (!part) {
        result.parts[slot] = defaultApp.parts[slot];
        continue;
      }
      
      // Verificar que el slot coincida
      if (part.slot !== slot) {
        result.parts[slot] = defaultApp.parts[slot];
        continue;
      }
      
      // Verificar que el género sea compatible
      if (!part.gender.includes(appearance.gender)) {
        result.parts[slot] = defaultApp.parts[slot];
        continue;
      }
      
      // Por ahora solo permitir parts con unlock "default"
      if (part.unlock === "default") {
        result.parts[slot] = partId;
      } else {
        result.parts[slot] = defaultApp.parts[slot];
      }
    }
    
    return result;
  }

  getPartsForGender(gender) {
    const result = {};
    for (const [id, part] of this.parts.entries()) {
      if (part.gender.includes(gender) && part.unlock === "default") {
        if (!result[part.slot]) result[part.slot] = [];
        result[part.slot].push(part);
      }
    }
    return result;
  }

  getAllData() {
    return {
      parts: Array.from(this.parts.values()),
      defaults: this.defaults,
      slots: this.slots
    };
  }
}
