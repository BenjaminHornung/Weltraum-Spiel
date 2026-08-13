import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function walk(relative) {
  const directory = new URL(relative, root);
  const names = await readdir(directory);
  const files = [];
  for (const name of names.sort()) {
    const item = new URL(name, directory.href.endsWith("/") ? directory : `${directory.href}/`);
    const itemStat = await stat(item);
    if (itemStat.isDirectory()) {
      files.push(...(await walk(`${relative}${name}/`)));
    } else {
      files.push(item);
    }
  }
  return files;
}

test("source keeps the mock and non-authority boundaries visible", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /MOCK FIXTURE/);
  assert.match(source, /KEINE EXTERNE KI/);
  assert.match(source, /KEIN PRODUKT-WRITE/);
  assert.match(source, /Commit verändert ausschließlich React-State/);
  assert.match(source, /deterministic/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bWebSocket\s*\(/);
  assert.doesNotMatch(source, /\blocalStorage\b/);
});

test("production output is client-only and contains no source maps", async () => {
  const files = await walk("dist/");
  const relative = files.map((file) => path.relative(new URL("../dist/", import.meta.url).pathname, file.pathname));
  assert(relative.includes("index.html"));
  assert(relative.some((file) => file.endsWith(".js")));
  assert(relative.some((file) => file.endsWith(".css")));
  assert(!relative.some((file) => file.endsWith(".map")));
  assert(!relative.some((file) => /(^|\/)server(\/|$)/.test(file)));
  assert(!relative.some((file) => /vinext|wrangler|hosting\.json/i.test(file)));
});

test("built UI retains explicit mock labels", async () => {
  const files = await walk("dist/");
  const text = (
    await Promise.all(
      files
        .filter((file) => /\.(?:html|js|css)$/.test(file.pathname))
        .map((file) => readFile(file, "utf8")),
    )
  ).join("\n");
  assert.match(text, /MOCK FIXTURE/);
  assert.match(text, /KEINE EXTERNE KI/);
  assert.match(text, /KEIN PRODUKT-WRITE/);
});
