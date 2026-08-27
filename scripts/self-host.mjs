/* oxlint-disable eslint/no-restricted-properties -- Standalone launcher validates deployment environment values before use. */
import { spawn } from "node:child_process";
import nextEnv from "@next/env";
import { secureEnvironmentFiles } from "./local-permissions.mjs";

const { loadEnvConfig } = nextEnv;

secureEnvironmentFiles();
loadEnvConfig(process.cwd());

const options = parseOptions(process.argv.slice(2));
const tunnel = options.tunnel || process.env.TUNNEL_PROVIDER || "none";
const port = Number(process.env.PORT || "3000");
const publicUrl = requiredEnv("PUBLIC_URL");
const publicOrigin = new URL(publicUrl);
const children = new Set();
let stopping = false;

validateConfiguration();
if (options.check === "true") {
  console.log(
    `Self-host configuration is valid (${tunnel}, ${publicOrigin.origin}).`
  );
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => void shutdown(0));
}
process.on("uncaughtException", (error) => {
  console.error(error);
  void shutdown(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  void shutdown(1);
});

if (options["skip-migrate"] !== "true") {
  await runChecked(pnpmCommand(), ["db:migrate"]);
}
if (options["skip-build"] !== "true") {
  await runChecked(pnpmCommand(), ["build"]);
}

const server = spawnManaged(
  pnpmCommand(),
  ["start:app", "--", "--hostname", "127.0.0.1", "--port", String(port)],
  "OpenOpenInstinct server"
);
await waitForServer(port, server);

const tunnelProcess = startTunnel(tunnel, port);
console.log(`OpenOpenInstinct is available at ${publicOrigin.origin}.`);

const exitCode = await waitForAnyExit(
  tunnelProcess ? [server, tunnelProcess] : [server]
);
await shutdown(exitCode);

function validateConfiguration() {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer from 1 through 65535.");
  }
  if (publicOrigin.origin !== publicUrl.replace(/\/$/u, "")) {
    throw new Error("PUBLIC_URL must contain only the stable public origin.");
  }
  if (publicOrigin.hostname.endsWith(".trycloudflare.com")) {
    throw new Error(
      "Cloudflare Quick Tunnel URLs are ephemeral and unsupported for device authentication."
    );
  }

  switch (tunnel) {
    case "cloudflare":
      requiredEnv("CLOUDFLARED_TOKEN");
      break;
    case "tailscale": {
      const expectedHostname = process.env.TAILSCALE_FUNNEL_HOSTNAME?.trim();
      if (expectedHostname && expectedHostname !== publicOrigin.hostname) {
        throw new Error(
          "TAILSCALE_FUNNEL_HOSTNAME must match the hostname in PUBLIC_URL."
        );
      }
      if (!publicOrigin.hostname.endsWith(".ts.net")) {
        throw new Error(
          "Tailscale Funnel PUBLIC_URL must use its stable .ts.net name."
        );
      }
      break;
    }
    case "zrok":
      requiredEnv("ZROK_RESERVED_SHARE");
      break;
    case "none":
      break;
    default:
      throw new Error("--tunnel must be cloudflare, tailscale, zrok, or none.");
  }
}

function startTunnel(provider, localPort) {
  switch (provider) {
    case "cloudflare":
      return spawnManaged(
        process.env.CLOUDFLARED_COMMAND || "cloudflared",
        ["tunnel", "run"],
        "Cloudflare Tunnel",
        { TUNNEL_TOKEN: requiredEnv("CLOUDFLARED_TOKEN") }
      );
    case "tailscale":
      return spawnManaged(
        process.env.TAILSCALE_COMMAND || "tailscale",
        ["funnel", "--yes", String(localPort)],
        "Tailscale Funnel"
      );
    case "zrok":
      return spawnManaged(
        process.env.ZROK_COMMAND || "zrok",
        ["share", "reserved", requiredEnv("ZROK_RESERVED_SHARE")],
        "zrok reserved share"
      );
    case "none":
      return undefined;
  }
}

function spawnManaged(command, args, label, extraEnvironment = {}) {
  const child = spawn(command, args, {
    detached: process.platform !== "win32",
    env: { ...process.env, ...extraEnvironment },
    stdio: "inherit",
  });
  child.label = label;
  children.add(child);
  child.once("exit", () => children.delete(child));
  child.once("error", (error) => {
    console.error(`${label} failed to start:`, error);
  });
  return child;
}

function runChecked(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`${command} ${args.join(" ")} failed (${code ?? signal}).`)
        );
    });
  });
}

async function waitForServer(localPort, server) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("OpenOpenInstinct exited before becoming ready.");
    }
    try {
      const response = await fetch(
        `http://127.0.0.1:${localPort}/eve/v1/health`,
        {
          headers: { Host: publicOrigin.host },
        }
      );
      if (response.ok) return;
    } catch {
      // The local listener is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("OpenOpenInstinct did not become ready within 60 seconds.");
}

function waitForAnyExit(processes) {
  return Promise.race(
    processes.map(
      (child) =>
        new Promise((resolve) => {
          child.once("exit", (code) => resolve(code ?? 1));
          child.once("error", () => resolve(1));
        })
    )
  );
}

async function shutdown(exitCode) {
  if (stopping) return;
  stopping = true;
  await Promise.all([...children].map(stopChild));
  process.exitCode = exitCode;
}

function stopChild(child) {
  if (!child.pid || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    if (process.platform === "win32") {
      const killer = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/t", "/f"],
        { stdio: "ignore" }
      );
      killer.once("exit", () => undefined);
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        resolve();
      }
    }
  });
}

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseOptions(values) {
  return Object.fromEntries(
    values.flatMap((value) => {
      const match = /^--([^=]+)(?:=(.*))?$/u.exec(value);
      return match?.[1] ? [[match[1], match[2] || "true"]] : [];
    })
  );
}
