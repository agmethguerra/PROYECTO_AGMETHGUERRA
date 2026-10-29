export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.clients = new Map();
  }

  check(socketId) {
    const now = Date.now();
    if (!this.clients.has(socketId)) {
      this.clients.set(socketId, []);
    }
    
    const requests = this.clients.get(socketId);
    // Limpiar requests antiguas
    const recent = requests.filter(time => now - time < this.windowMs);
    this.clients.set(socketId, recent);
    
    if (recent.length >= this.maxRequests) {
      return false; // Rate limitado
    }
    
    recent.push(now);
    return true;
  }

  remove(socketId) {
    this.clients.delete(socketId);
  }
}
