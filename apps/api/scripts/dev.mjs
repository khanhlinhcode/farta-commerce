import { spawn } from "node:child_process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const runtimeEntry = process.argv[2] ?? "dist/main.js";

if (!/^dist\/[a-zA-Z0-9./-]+\.js$/.test(runtimeEntry)) {
  throw new Error(
    "Development runtime entry must be a compiled dist/*.js file.",
  );
}

const compiler = spawn(
  pnpmCommand,
  [
    "exec",
    "tsc",
    "-p",
    "tsconfig.build.json",
    "--watch",
    "--preserveWatchOutput",
  ],
  { stdio: ["inherit", "pipe", "pipe"] },
);

let runtime;
let compilerOutput = "";
let restartAfterExit = false;
let shuttingDown = false;

function startRuntime() {
  runtime = spawn(process.execPath, [runtimeEntry], {
    stdio: "inherit",
    env: process.env,
  });
  runtime.on("exit", (code) => {
    runtime = undefined;

    if (restartAfterExit && !shuttingDown) {
      restartAfterExit = false;
      startRuntime();
      return;
    }

    if (!shuttingDown) {
      process.exitCode = code ?? 1;
      compiler.kill("SIGTERM");
    }
  });
}

function startRuntimeAfterSuccessfulCompile(chunk) {
  compilerOutput = `${compilerOutput}${chunk}`.slice(-4_096);
  if (!/Found 0 errors?\. Watching for file changes\./.test(compilerOutput)) {
    return;
  }
  compilerOutput = "";

  if (!runtime) {
    startRuntime();
    return;
  }

  restartAfterExit = true;
  runtime.kill("SIGTERM");
}

compiler.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  startRuntimeAfterSuccessfulCompile(chunk.toString());
});
compiler.stderr.on("data", (chunk) => process.stderr.write(chunk));

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  runtime?.kill(signal);
  compiler.kill(signal);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

compiler.on("exit", (code, signal) => {
  if (!shuttingDown) {
    runtime?.kill(signal ?? "SIGTERM");
    process.exitCode = code ?? 1;
  }
});
