import { PlayerManager } from "./PlayerManager.js";
import { ZoneManager } from "./ZoneManager.js";
import { RoomManager } from "./RoomManager.js";
import { AppearanceManager } from "./AppearanceManager.js";
import { HomeManager } from "./HomeManager.js";

export class WorldManager {
  constructor() {
    this.playerManager = new PlayerManager();
    this.zoneManager = new ZoneManager();
    this.roomManager = new RoomManager();
    this.appearanceManager = new AppearanceManager();
    this.homeManager = new HomeManager(this);
    // economy / needsSystem / activitySystem los crea GameServer.start() (necesitan el almacén y los sockets)
  }

  init() {
    this.zoneManager.loadZones();
    console.log("[WorldManager] Initialized");
  }
}
