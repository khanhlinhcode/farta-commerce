import { spawn } from "node:child_process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
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

let api;
let compilerOutput = "";

function startApiAfterSuccessfulCompile(chunk) {
  compilerOutput = `${compilerOutput}${chunk}`.slice(-4_096);
  if (
    api ||
    !/Found 0 errors?\. Watching for file changes\./.test(compilerOutput)
  ) {
    return;
  }

  api = spawn(process.execPath, ["--watch", "dist/main.js"], {
    stdio: "inherit",
    env: process.env,
  });
  api.on("exit", (code, signal) => {
    if (!signal && code && compiler.exitCode === null) process.exitCode = code;
  });
}

compiler.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  startApiAfterSuccessfulCompile(chunk.toString());
});
compiler.stderr.on("data", (chunk) => process.stderr.write(chunk));

function shutdown(signal) {
  api?.kill(signal);
  compiler.kill(signal);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

compiler.on("exit", (code, signal) => {
  api?.kill(signal ?? "SIGTERM");
  if (!signal) process.exit(code ?? 1);
});
