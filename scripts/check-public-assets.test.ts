import { describe, expect, it } from "vitest";
import { unreferencedPublicFiles } from "./check-public-assets";

const page = (text: string) => ({ file: "app/page.tsx", text });

describe("unreferencedPublicFiles", () => {
  it("accepts a file referenced by its path or by its name", () => {
    const referrers = [page(`<img src="/icons/a.svg" />`), page(`icon: "b.png"`)];
    expect(unreferencedPublicFiles(["icons/a.svg", "b.png"], referrers)).toEqual([]);
  });

  it("reports a file nothing references, also when only the file itself names it", () => {
    const referrers = [page("nothing here"), { file: "public/c.svg", text: "c.svg" }];
    expect(unreferencedPublicFiles(["c.svg"], referrers)).toEqual(["c.svg"]);
  });

  it("does not count a longer name that merely ends with the file name", () => {
    expect(unreferencedPublicFiles(["logo.png"], [page(`"placeholder-logo.png"`)])).toEqual(["logo.png"]);
  });
});
