// Doble de prueba de un socket.io-client Socket: implementa solo el
// subconjunto que usa useBoardSocket (on/off/emit/connect/disconnect, y el
// Manager en `.io` para los eventos de reconexión). Los tests disparan
// eventos "del servidor" con trigger()/triggerIo() y leen lo que la app
// mandaría con emit() a través de `sent`.
type Listener = (...args: unknown[]) => void;

class FakeSocket {
  connected = false;
  sent: { event: string; args: unknown[] }[] = [];
  private listeners = new Map<string, Set<Listener>>();
  private ioListeners = new Map<string, Set<Listener>>();

  io = {
    on: (event: string, cb: Listener) => {
      if (!this.ioListeners.has(event)) this.ioListeners.set(event, new Set());
      this.ioListeners.get(event)!.add(cb);
    },
    off: (event: string, cb?: Listener) => {
      if (cb) this.ioListeners.get(event)?.delete(cb);
      else this.ioListeners.delete(event);
    },
  };

  on(event: string, cb: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return this;
  }

  off(event: string, cb?: Listener): this {
    if (cb) this.listeners.get(event)?.delete(cb);
    else this.listeners.delete(event);
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    this.sent.push({ event, args });
    // board:join simula éxito inmediato (ack) salvo que el test reconfigure.
    if (event === 'board:join') {
      const ack = args[1] as ((response: { ok: true }) => void) | undefined;
      ack?.({ ok: true });
    }
    return this;
  }

  connect(): this {
    this.connected = true;
    this.trigger('connect');
    return this;
  }

  disconnect(): this {
    this.connected = false;
    this.trigger('disconnect');
    return this;
  }

  // --- Helpers de test ---
  trigger(event: string, payload?: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }

  triggerIo(event: string, payload?: unknown): void {
    this.ioListeners.get(event)?.forEach((cb) => cb(payload));
  }

  reset(): void {
    this.connected = false;
    this.sent = [];
    this.listeners.clear();
    this.ioListeners.clear();
  }
}

export const fakeSocket = new FakeSocket();
