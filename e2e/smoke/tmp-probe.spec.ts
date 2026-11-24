import { expect, test } from "@playwright/test";

function summarize(text: string): string {
  return JSON.stringify({
    headEnd: text.indexOf("</head>"),
    layoutScripts: (text.match(/scrollRestoration/g) ?? []).length,
    length: text.length,
    scripts: (text.match(/<script/g) ?? []).length,
  });
}

test("probe not-found html", async ({ request }) => {
  const first = await request.get("/en/no-such-page");
  const html = await (await request.get("/en/no-such-page")).text();
  const home = await (await request.get("/en")).text();
  console.log(`PROBE404 ${summarize(html)}`);
  console.log(`PROBEHOME ${summarize(home)}`);
  console.log(`PROBEHEAD ${JSON.stringify(html.slice(0, 1800))}`);
  console.log(`PROBEHDR ${JSON.stringify(first.headers())}`);
  expect(html.length).toBeGreaterThan(0);
});
