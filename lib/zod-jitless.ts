/** Global object that zod/v4/core `config()` reads and writes (shared by every Zod copy). */
const ZOD_CONFIG_KEY = "__zod_globalConfig";

/**
 * Turns off Zod's JIT without importing Zod. The CSP forbids eval, so Zod must not probe
 * `new Function`: the probe is caught, but the browser still reports a policy violation.
 * Without JIT, Zod parses the same way. Zod keeps a reference to this object once loaded, so the
 * setting is merged into it rather than replacing it.
 */
export function disableZodJit(): void {
  const existing: unknown = Reflect.get(globalThis, ZOD_CONFIG_KEY);
  if (typeof existing === "object" && existing !== null) {
    Reflect.set(existing, "jitless", true);
    return;
  }
  Reflect.set(globalThis, ZOD_CONFIG_KEY, { jitless: true });
}
