import { MOVE_SPEED } from "/shared/config/constants.js";

export class EntityManager {
  constructor() {
    this.entities = new Map();
    // Celdas por segundo: el servidor da un paso cada MOVE_SPEED ms; vamos un 25% más rápido
    // para llegar siempre a tiempo al siguiente paso y no quedarnos atrasados.
    this.cellsPerSecond = (1000 / MOVE_SPEED) * 1.25;
  }

  addEntity(entity) {
    this.entities.set(entity.id, {
      ...entity,
      displayX: entity.x,
      displayY: entity.y,
      targetX: entity.x,
      targetY: entity.y,
      isMoving: false
    });
  }

  updateEntity(id, data) {
    const entity = this.entities.get(id);
    if (entity) {
      if (data.targetX !== undefined || data.x !== undefined) {
        entity.targetX = data.targetX !== undefined ? data.targetX : data.x;
        entity.isMoving = true;
      }
      if (data.targetY !== undefined || data.y !== undefined) {
        entity.targetY = data.targetY !== undefined ? data.targetY : data.y;
        entity.isMoving = true;
      }
      if (data.dir !== undefined) {
        entity.dir = data.dir;
      }
      // Mantiene la animación de caminar activa entre pasos consecutivos de una ruta
      entity.movingUntil = performance.now() + MOVE_SPEED * 1.3;
      if (data.x !== undefined && data.targetX === undefined) entity.x = data.x;
      if (data.y !== undefined && data.targetY === undefined) entity.y = data.y;
      Object.assign(entity, data);
    } else {
      this.addEntity(data);
    }
  }

  removeEntity(id) {
    this.entities.delete(id);
  }

  clear() {
    this.entities.clear();
  }

  /**
   * @param dtMs     milisegundos desde el frame anterior
   * @param heightAt (x, y) => nivel de altura de la celda (para subir/bajar escaleras suavemente)
   */
  update(dtMs = 16, heightAt = null) {
    const dt = Math.min(dtMs, 50) / 1000; // evita saltos si la pestaña estuvo en segundo plano
    const now = performance.now();
    for (const entity of this.entities.values()) {
      const dx = entity.targetX - entity.displayX;
      const dy = entity.targetY - entity.displayY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.001) {
        const step = Math.min(this.cellsPerSecond * dt, dist);
        entity.displayX += (dx / dist) * step;
        entity.displayY += (dy / dist) * step;
      } else {
        entity.displayX = entity.targetX;
        entity.displayY = entity.targetY;
        entity.x = entity.targetX;
        entity.y = entity.targetY;
      }
      entity.isMoving = dist > 0.001 || now < (entity.movingUntil || 0);

      if (heightAt) {
        const target = heightAt(Math.round(entity.displayX), Math.round(entity.displayY));
        if (entity.displayH === undefined) entity.displayH = target;
        else entity.displayH += (target - entity.displayH) * (1 - Math.exp(-dtMs / 70));
      }
    }
  }

  getEntities() {
    return Array.from(this.entities.values());
  }

  getEntity(id) {
    return this.entities.get(id);
  }
}

