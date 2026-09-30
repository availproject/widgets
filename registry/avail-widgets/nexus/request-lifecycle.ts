/** One live SDK per provider. Read-only setup and wallet attachment share initialization. */
export function createSdkOwner<T extends { destroy(): void }>() {
  let current: T | null = null;
  let pending: Promise<T> | null = null;
  return {
    get current() { return current; },
    get(create: () => T, initialize: (sdk: T) => Promise<unknown>): Promise<T> {
      if (pending) return pending;
      if (current) return Promise.resolve(current);
      const sdk = create();
      current = sdk;
      const request = Promise.resolve().then(() => {
        if (current !== sdk) throw new Error("Nexus initialization superseded");
        return initialize(sdk);
      }).then(() => {
        if (current !== sdk) {
          sdk.destroy();
          throw new Error("Nexus initialization superseded");
        }
        return sdk;
      }).catch(error => {
        if (current === sdk) { current = null; sdk.destroy(); }
        throw error;
      }).finally(() => { if (pending === request) pending = null; });
      pending = request;
      return request;
    },
    reset() {
      const sdk = current;
      current = null;
      pending = null;
      sdk?.destroy();
    },
  };
}

/** Coalesce concurrent work only. Settled results are never cached across refreshes. */
export function createInFlightRequests() {
  const scopes = new WeakMap<object, Map<string, Promise<unknown>>>();
  return {
    run<T>(scope: object, key: string, call: () => Promise<T>): Promise<T> {
      let requests = scopes.get(scope);
      if (!requests) { requests = new Map(); scopes.set(scope, requests); }
      const existing = requests.get(key);
      if (existing) return existing as Promise<T>;
      const request = Promise.resolve().then(call).finally(() => {
        if (requests.get(key) === request) requests.delete(key);
      });
      requests.set(key, request);
      return request;
    },
  };
}
