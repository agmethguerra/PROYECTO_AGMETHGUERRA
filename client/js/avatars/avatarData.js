export class AvatarData {
  constructor() {
    this.parts = new Map();
    this.defaults = {};
    this.slots = [];
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    try {
      const [partsRes, defaultsRes, slotsRes] = await Promise.all([
        fetch("/data/avatars/parts.json"),
        fetch("/data/avatars/defaults.json"),
        fetch("/data/avatars/slots.json")
      ]);
      
      const partsData = await partsRes.json();
      const defaultsData = await defaultsRes.json();
      const slotsData = await slotsRes.json();
      
      for (const part of partsData.parts) {
        this.parts.set(part.id, part);
      }
      this.defaults = defaultsData.defaults;
      this.slots = slotsData.slots;
      this.loaded = true;
      console.log("[AvatarData] Loaded");
    } catch (error) {
      console.error("[AvatarData] Error loading:", error);
    }
  }

  getPartsForGender(gender) {
    const result = {};
    for (const [id, part] of this.parts.entries()) {
      if (part.gender.includes(gender) && part.unlock === "default") {
        if (!result[part.slot]) result[part.slot] = [];
        result[part.slot].push(part);
      }
    }
    // Ordenar por nombre
    for (const slot in result) {
      result[slot].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }

  getPart(id) {
    return this.parts.get(id);
  }

  getDefault(gender) {
    return this.defaults[gender] || this.defaults.male;
  }
}

export const avatarData = new AvatarData();
