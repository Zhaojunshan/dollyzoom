import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const CJK = /[\u3400-\u9fff]/;

test("public pages, components, and data files have no Chinese copy", () => {
  const roots = ["src/app", "src/components", "public/data"];
  const hits = [];
  for (const root of roots) walk(root, (file) => {
    if (!/\.(tsx|ts|mjs|css|json|html)$/.test(file)) return;
    const text = readFileSync(file, "utf8");
    if (CJK.test(text)) hits.push(file);
  });
  assert.deepEqual(hits, []);
});

function walk(dir, visit) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, visit);
    else visit(path);
  }
}
