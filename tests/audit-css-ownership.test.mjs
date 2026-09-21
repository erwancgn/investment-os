import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { appCssFiles } from "../scripts/css-file-manifest.mjs";

const execFileAsync = promisify(execFile);
const auditScript = fileURLToPath(new URL("../scripts/audit-css-ownership.mjs", import.meta.url));

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "investment-os-css-ownership-"));
  await Promise.all(appCssFiles.map(async file => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, overrides[file] ?? "", "utf8");
  }));
  return root;
}

test("CSS ownership audit exits successfully when contract metrics stay at zero", async () => {
  const root = await createFixture({
    "app/globals.css": ".global-only { color: red; }\n",
    "app/styles/ux/portfolio.css": ".ux-only { color: blue; }\n",
  });

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [auditScript], { cwd: root });
    assert.match(stdout, /"status": "PASS"/);
    assert.match(stdout, /"globalUxDeclarationChains": 0/);
    assert.equal(stderr, "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CSS ownership audit exits nonzero when a globals-to-UX collision is injected", async () => {
  const root = await createFixture({
    "app/globals.css": ".collision { color: red; }\n",
    "app/styles/ux/portfolio.css": ".collision { color: blue; }\n",
  });

  try {
    await assert.rejects(
      execFileAsync(process.execPath, [auditScript], { cwd: root }),
      error => {
        assert.equal(error.code, 1);
        assert.match(error.stdout, /"status": "FAIL"/);
        assert.match(error.stdout, /"globalUxDeclarationChains": 1/);
        assert.match(error.stderr, /CSS ownership contract failed: globalUxDeclarationChains=1/);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
