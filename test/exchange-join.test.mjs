// Tests for the apex /exchange/join page (static, no build). Run: node --test test/   (Node 20+, no dependencies).
// The page's one inline script is evaluated in a vm sandbox with a stub location/document, so these tests exercise the
// REAL shipped script, not a copy of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const html = readFileSync(fileURLToPath(new URL("../exchange/join/index.html", import.meta.url)), "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const TOKEN = "KK0UfV9N9f5PtHqAUvB6aGyJPWJ0-NMT4ITd6ysmlB0"; // 43 chars, inside the accepted 20-64 range

function run(hash) {
  const open = { href: "https://app.theneedle.exchange/login" };
  const valid = { hidden: true };
  const invalid = { hidden: false };
  const els = { open, valid, invalid };
  const sandbox = { location: { hash }, document: { getElementById: (id) => els[id] } };
  vm.runInNewContext(scripts[0][2], sandbox);
  return { open, valid, invalid };
}

test("one inline script, no external or third-party script, no analytics", () => {
  assert.equal(scripts.length, 1);
  assert.ok(!/\bsrc\s*=/.test(scripts[0][1]), "the script is inline");
  assert.ok(!/<link[^>]+rel=["']?(?:preload|prefetch|dns-prefetch|preconnect)/i.test(html));
  const urls = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => new URL(m[0]).hostname);
  const allowed = new Set(["theneedle.exchange", "app.theneedle.exchange", "www.last.fm"]);
  for (const host of urls) assert.ok(allowed.has(host), `unexpected host in the page: ${host}`);
});

test("default markup is the INVALID state and carries no token, no token-shaped string and no app href with a fragment", () => {
  assert.match(html, /<div id="valid" hidden>/);
  assert.match(html, /<div id="invalid">/);
  assert.ok(!/<div id="invalid" hidden/.test(html));
  assert.match(html, /<a class="btn" id="open" href="https:\/\/app\.theneedle\.exchange\/login">/);
  const body = html.slice(html.indexOf("<body>"), html.indexOf("<script>"));
  assert.ok(!/[A-Za-z0-9_-]{20}/.test(body.replace(/<path[^>]*>/g, "")), "no 20-character token-shaped string in the body markup");
  assert.ok(!/join#/.test(body));
});

test("a whole URL-safe token of 20 to 64 characters reveals the VALID state and builds the app href", () => {
  const r = run("#" + TOKEN);
  assert.equal(r.valid.hidden, false);
  assert.equal(r.invalid.hidden, true);
  assert.equal(r.open.href, "https://app.theneedle.exchange/exchange/join#" + TOKEN);
});

test("the token regex is pinned to the Exchange routes' shape: 20 to 64 characters of [A-Za-z0-9_-]", () => {
  assert.match(scripts[0][2], /var TOKEN_RE = \/\^\[A-Za-z0-9_-\]\{20,64\}\$\/;/);
});

for (const [name, hash] of [
  ["empty", ""],
  ["just a hash", "#"],
  ["19 characters", "#" + TOKEN.slice(0, 19)],
  ["65 characters", "#" + (TOKEN + TOKEN).slice(0, 65)],
  ["a plus sign", "#" + TOKEN.slice(0, 42) + "+"],
  ["a slash", "#" + TOKEN.slice(0, 42) + "/"],
  ["a dot", "#" + TOKEN.slice(0, 42) + "."],
  ["a space", "#" + TOKEN.slice(0, 42) + " "],
  ["a trailing newline", "#" + TOKEN + "\n"],
  ["a leading junk character", "#!" + TOKEN.slice(0, 42)],
  ["a percent escape", "#" + TOKEN.slice(0, 40) + "%41%42"],
  ["a query-looking suffix", "#" + TOKEN + "?x=1"],
  ["two tokens", "#" + TOKEN + "_" + TOKEN + TOKEN],
  ["a script tag", "#<script>alert(1)</script>"],
]) {
  test(`a bad fragment (${name}) shows the invalid state and never builds an href`, () => {
    const r = run(hash);
    assert.equal(r.valid.hidden, true);
    assert.equal(r.invalid.hidden, false);
    assert.equal(r.open.href, "https://app.theneedle.exchange/login");
  });
}

test("Open Graph: the invitation title, the image, no description, noindex, no-referrer", () => {
  const meta = (attr, key) => (html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`)) ?? [])[1];
  assert.equal(meta("property", "og:title"), "An invitation to an Exchange on The Needle Exchange");
  assert.match(html, /<title>An invitation to an Exchange on The Needle Exchange<\/title>/);
  assert.equal(meta("property", "og:site_name"), "The Needle Exchange");
  assert.equal(meta("property", "og:url"), "https://theneedle.exchange/exchange/join");
  assert.equal(meta("property", "og:image"), "https://theneedle.exchange/og-join.png");
  assert.equal(meta("property", "og:image:width"), "1200");
  assert.equal(meta("property", "og:image:height"), "630");
  assert.equal(meta("name", "twitter:card"), "summary_large_image");
  assert.equal(meta("name", "robots"), "noindex");
  assert.equal(meta("name", "referrer"), "no-referrer");
  assert.ok(!/og:description|twitter:description|name="description"/.test(html), "no description of any kind");
  assert.ok(!/og:url" content="[^"]*#/.test(html), "the og:url never carries a fragment");
});

test("the share preview never names an Exchange partner, a member, a count, the sender or a token", () => {
  assert.ok(!/member|sender|invited by|\b\d+ (people|members|friends)\b/i.test(html.replace(/<path[^>]*>/g, "").replace(/<style[\s\S]*?<\/style>/, "")));
});
