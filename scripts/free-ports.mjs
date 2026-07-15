// Frees the dev ports before `npm run dev` starts.
//
// Why this exists: on Windows, Ctrl+C in the turbo TUI does not reliably kill
// the grandchild processes (`tsx watch`, `next dev`). They survive, keep holding
// ports 3000/5000, and the next `npm run dev` dies with EADDRINUSE. This kills
// only the PIDs actually listening on the given ports — never node processes at
// large, which would take down the editor's own node-based tooling.

import { execFileSync } from "node:child_process";

const ports = process.argv.slice(2).map(Number).filter(Boolean);
if (ports.length === 0) {
  console.error("usage: node scripts/free-ports.mjs <port> [port...]");
  process.exit(1);
}

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return ""; // no matches — the tools exit non-zero when nothing is found
  }
};

/** PIDs listening on `port`, excluding this process. */
const listenersOn = (port) => {
  const pids = new Set();

  if (process.platform === "win32") {
    for (const line of run("netstat", ["-ano", "-p", "TCP"]).split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/);
      // Proto  Local            Foreign  State      PID
      if (cols.length < 5 || cols[3] !== "LISTENING") continue;
      // Match the port exactly: ":5000" must not match ":50001".
      if (!new RegExp(`:${port}$`).test(cols[1])) continue;
      pids.add(cols[4]);
    }
  } else {
    for (const pid of run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"]).split(/\s+/)) {
      if (pid) pids.add(pid);
    }
  }

  pids.delete(String(process.pid));
  return [...pids];
};

const kill = (pid) =>
  process.platform === "win32"
    ? run("taskkill", ["/PID", pid, "/F", "/T"])
    : run("kill", ["-9", pid]);

let freed = 0;
for (const port of ports) {
  for (const pid of listenersOn(port)) {
    kill(pid);
    console.log(`  freed port ${port} (killed stale PID ${pid})`);
    freed++;
  }
}

console.log(freed === 0 ? `✓ ports ${ports.join(", ")} already free` : `✓ freed ${freed} stale process(es)`);
