import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const LUMARELAY_PORT = 3310;
const WEB_PORT = 5180;
const PNPM_PATH = process.env.npm_execpath;

if (PNPM_PATH === undefined)
  throw new Error("Run the smoke test through pnpm smoke:local");

const temporaryDirectory = await mkdtemp(join(tmpdir(), "lumarelay-smoke-"));
const children = [];

function runPnpm(arguments_, environment = {}) {
  const child = spawn(process.execPath, [PNPM_PATH, ...arguments_], {
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.push(child);
  return child;
}

function waitForExit(child, label) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

async function waitForUrl(url, validate) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok && (await validate(response))) return;
    } catch {
      // The service may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;

  if (process.platform === "win32") {
    const terminator = spawn(
      "taskkill",
      ["/pid", String(child.pid), "/t", "/f"],
      { stdio: "ignore" },
    );
    await waitForExit(terminator, "taskkill").catch(() => undefined);
    return;
  }

  child.kill("SIGTERM");
}

try {
  const environment = {
    LUMARELAY_COOKIE_SECURE: "false",
    LUMARELAY_DATABASE_PATH: join(temporaryDirectory, "lumarelay.db"),
    LUMARELAY_HOST: "127.0.0.1",
    LUMARELAY_PORT: String(LUMARELAY_PORT),
    LUMARELAY_PUBLIC_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
    NODE_ENV: "test",
  };

  const migration = runPnpm(
    ["--filter", "@lumarelay/gateway", "db:migrate"],
    environment,
  );
  await waitForExit(migration, "database migration");

  runPnpm(
    ["--filter", "@lumarelay/gateway", "exec", "tsx", "src/index.ts"],
    environment,
  );
  runPnpm([
    "--filter",
    "@lumarelay/web",
    "exec",
    "vite",
    "--host",
    "127.0.0.1",
    "--port",
    String(WEB_PORT),
    "--strictPort",
  ]);

  await waitForUrl(
    `http://127.0.0.1:${LUMARELAY_PORT}/api/v1/health`,
    async (response) => (await response.json()).status === "ok",
  );
  await waitForUrl(`http://127.0.0.1:${WEB_PORT}`, async (response) =>
    (await response.text()).includes('id="root"'),
  );

  process.stdout.write("Local Web and Gateway smoke test passed.\n");
} finally {
  await Promise.all(children.map((child) => stopChild(child)));
  await rm(temporaryDirectory, { force: true, recursive: true });
}
