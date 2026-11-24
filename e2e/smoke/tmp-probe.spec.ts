import { expect, test } from "@playwright/test";

test("probe not-found html", async ({ request }) => {
  test.setTimeout(120_000);
  const results: string[] = [];
  for (let index = 0; index < 60; index++) {
    const response = await request.get("/en/no-such-page");
    const html = await response.text();
    const head = html.slice(0, html.indexOf("</head>"));
    const inline = (head.match(/<script(?![^>]*src=)[^>]*>/g) ?? []).length;
    results.push(
      `${index}:${response.status()}:${inline}:${html.length}:${response.headers()["x-nextjs-cache"] ?? "-"}:${response.headers()["x-nextjs-prerender"] ?? "-"}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await test.info().attach("probe", {
    body: results.join("\n"),
    contentType: "text/plain",
  });
  console.log(`PROBE ${results.join(" | ")}`);
  expect(results).toHaveLength(60);
});
