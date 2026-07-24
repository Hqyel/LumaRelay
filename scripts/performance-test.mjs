import { spawn } from "node:child_process";

const packageManagerPath = process.env.npm_execpath;

function invocation(args) {
  if (packageManagerPath?.toLowerCase().includes("pnpm"))
    return { args: [packageManagerPath, ...args], command: process.execPath };
  return {
    args,
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  };
}

function run(args, env = process.env) {
  const command = invocation(args);
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            signal === null
              ? `Command exited with code ${code ?? 1}`
              : `Command exited with signal ${signal}`,
          ),
        );
    });
  });
}

await run(["--filter", "@lumarelay/web", "build"]);
await run(
  [
    "exec",
    "playwright",
    "test",
    "-c",
    "apps/web/playwright.config.ts",
    "performance.e2e.ts",
    "--project",
    "chromium",
  ],
  { ...process.env, LUMARELAY_E2E_PRODUCTION: "true" },
);
