import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

describe("locale middleware", () => {
  it("sends no Link header: hreflang comes only from the page metadata and the sitemap", () => {
    const middleware = createMiddleware(routing);
    const response = middleware(new NextRequest("https://example.com/en"));
    expect(response.headers.get("link")).toBeNull();
  });
});
