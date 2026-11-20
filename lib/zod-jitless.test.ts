import { config } from "zod/v4/core";
import { afterEach, describe, expect, it } from "vitest";

import { disableZodJit } from "./zod-jitless";

describe("disableZodJit", () => {
  afterEach(() => {
    config({ jitless: false });
  });

  it("turns off JIT in the config Zod reads after it has loaded", () => {
    config({ jitless: false });

    disableZodJit();

    expect(config().jitless).toBe(true);
  });

  it("creates the config with JIT off when Zod has not loaded yet", () => {
    const zodConfig: unknown = Reflect.get(globalThis, "__zod_globalConfig");
    Reflect.deleteProperty(globalThis, "__zod_globalConfig");
    try {
      disableZodJit();

      expect(Reflect.get(globalThis, "__zod_globalConfig")).toEqual({
        jitless: true,
      });
    } finally {
      Reflect.set(globalThis, "__zod_globalConfig", zodConfig);
    }
  });
});
