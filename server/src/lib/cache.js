/**
 * Cache em memória com TTL. Suficiente pra dois usuários e evita
 * martelar o InnerTube a cada seek do player.
 */
export class TtlCache {
  constructor({ ttlMs = 60_000, maxEntries = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Reinsere pra manter a ordem de uso (Map preserva ordem de inserção).
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  delete(key) {
    this.store.delete(key);
  }

  /** Executa `producer` só se não houver valor válido em cache. */
  async remember(key, producer, ttlMs = this.ttlMs) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await producer();
    this.set(key, value, ttlMs);
    return value;
  }
}
