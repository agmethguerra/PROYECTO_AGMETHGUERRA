export class SpriteLoader {
  constructor() {
    this.config = null;
    this.images = new Map(); // characterId -> Image
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;

    try {
      const res = await fetch("/data/avatars/sprites.json");
      this.config = await res.json();

      await Promise.all(
        this.config.characters.map(
          (char) =>
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                this.images.set(char.id, img);
                resolve();
              };
              img.onerror = () => reject(new Error(`No se pudo cargar ${char.sheet}`));
              img.src = char.sheet;
            })
        )
      );

      this.loaded = true;
      console.log("[SpriteLoader] Sprites cargados:", [...this.images.keys()]);
    } catch (error) {
      console.error("[SpriteLoader] Error:", error);
    }
  }

  /** Devuelve el id de personaje válido para una apariencia. */
  resolveCharacterId(appearance) {
    const chars = this.config?.characters || [];
    if (appearance?.spriteId && chars.some((c) => c.id === appearance.spriteId)) {
      return appearance.spriteId;
    }
    const byGender = chars.find((c) => c.gender === (appearance?.gender || "male"));
    return (byGender || chars[0])?.id;
  }

  getImage(characterId) {
    return this.images.get(characterId) || null;
  }
}

export const spriteLoader = new SpriteLoader();
