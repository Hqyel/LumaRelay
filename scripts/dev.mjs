import { spawn } from "node:child_process";

const packageManagerPath = process.env.npm_execpath;
const children = [];
let stopping = false;

function commandFor(script) {
  if (packageManagerPath?.toLowerCase().includes("pnpm"))
    return {
      args: [packageManagerPath, `dev:${script}`],
      command: process.execPath,
    };

  return {
    args: [`dev:${script}`],
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  };
}

function stop(exitCode) {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }

  setTimeout(() => process.exit(exitCode), 200).unref();
}

for (const script of ["gateway", "web"]) {
  const invocation = commandFor(script);
  const child = spawn(invocation.command, invocation.args, {
    env: process.env,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`[${script}] failed to start: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping) {
      const reason = signal === null ? `code ${code ?? 1}` : `signal ${signal}`;
      console.error(`[${script}] exited with ${reason}`);
      stop(code ?? 1);
    }
  });
  children.push(child);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
