// Every apex page links the NX Block icons, and the three files exist (issue 633). Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const PAGES = ["index.html", "join/index.html", "exchange/join/index.html"];

test("the three icon files exist and are the right kinds", () => {
  assert.match(readFileSync(root("icon.svg"), "utf8"), /^<svg[^>]*viewBox="0 0 64 64"/);
  const ico = readFileSync(root("favicon.ico"));
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]); // an ICO header
  const png = readFileSync(root("apple-touch-icon.png"));
  assert.equal(png.subarray(1, 4).toString("latin1"), "PNG");
  assert.equal(png.readUInt32BE(16), 180); // 180 px wide, the iOS home-screen size
  assert.equal(png.readUInt32BE(20), 180);
});

for (const page of PAGES) {
  test(`${page} links the .ico (first, 48x48), then the SVG tab icon (sizes any), then the apple-touch icon, in its head`, () => {
    const html = readFileSync(root(page), "utf8");
    const head = html.slice(0, html.indexOf("</head>"));
    assert.match(head, /<link rel="icon" href="\/icon\.svg" sizes="any" type="image\/svg\+xml">/);
    assert.match(head, /<link rel="icon" href="\/favicon\.ico" sizes="48x48">/);
    // The .ico comes BEFORE the SVG: a sizes="any" .ico placed after it can win over the SVG in Chrome (Designer, 633).
    assert.ok(head.indexOf("/favicon.ico") < head.indexOf("/icon.svg"));
    assert.match(head, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
    for (const href of ["icon.svg", "favicon.ico", "apple-touch-icon.png"]) assert.ok(existsSync(root(href)), href);
  });
}
