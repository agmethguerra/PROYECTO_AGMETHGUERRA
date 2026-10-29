export class HUD {
  constructor() {
    this.zoneNameEl = document.getElementById("zone-name");
    this.playerNameEl = document.getElementById("player-name");
    this.coordsEl = document.getElementById("coords");
  }
  
  updateZone(zone) {
    if (zone) {
      this.zoneNameEl.textContent = zone.name || zone.id;
    }
  }
  
  updatePlayer(player) {
    if (player) {
      this.playerNameEl.textContent = player.name;
    }
  }
  
  updateCoords(x, y) {
    if (x !== undefined && y !== undefined) {
      this.coordsEl.textContent = `X: ${Math.floor(x)}, Y: ${Math.floor(y)}`;
    }
  }
}
