// Lokální spuštění: npm run local
// Vestavěná databáze (PGlite ve složce .data) + živý Claude přes Claude Code na tomhle počítači.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const win = process.platform === "win32";
const run = (cmd, args, env = process.env) => spawnSync(cmd, args, { stdio: "inherit", shell: win, env });

const env = { ...process.env, PORT: process.env.PORT || "3000" };
delete env.DATABASE_URL; // lokálně vždy vestavěná databáze

// Nativní instalace Claude Code na Windows dává claude.exe do %USERPROFILE%\.local\bin, která nemusí být v PATH.
const localBin = join(homedir(), ".local", "bin");
if (existsSync(join(localBin, win ? "claude.exe" : "claude"))) env.PATH = `${localBin}${delimiter}${env.PATH ?? env.Path ?? ""}`;
if (win && env.Path) env.Path = env.PATH;

if (env.ANTHROPIC_API_KEY) {
  console.log("AI: Claude API (ANTHROPIC_API_KEY)");
} else {
  const v = spawnSync("claude", ["--version"], { shell: win, encoding: "utf8", env });
  if (v.status === 0) {
    env.CLAUDE_CLI = "1";
    console.log("AI: Claude Code", v.stdout.trim(), "(tvoje předplatné, bez API klíče)");
  } else {
    console.log("AI: Claude Code nenalezen, běží ukázkové odpovědi. Nainstaluj Claude Code (npm install -g @anthropic-ai/claude-code), přihlas se příkazem claude a spusť znovu.");
  }
}

if (!existsSync(".next/BUILD_ID") || process.argv.includes("--build")) {
  console.log("Sestavuji aplikaci (poprvé to trvá asi minutu)…");
  if (run("npx", ["next", "build"], env).status !== 0) process.exit(1);
}

const url = `http://localhost:${env.PORT}`;
console.log(`\nInbetween běží na ${url}\n  klient:      ${url}/klient\n  bez psychologa: ${url}/klient?id=nikola\n  psycholog:   ${url}/psycholog\nUkončíš Ctrl+C.\n`);
const srv = spawn("npx", ["next", "start", "-p", env.PORT], { stdio: "inherit", shell: win, env });
setTimeout(() => {
  const open = win ? ["cmd", ["/c", "start", "", url + "/klient"]] : process.platform === "darwin" ? ["open", [url + "/klient"]] : null;
  if (open) spawn(open[0], open[1], { stdio: "ignore", detached: true }).unref();
}, 3000);
srv.on("close", (c) => process.exit(c ?? 0));
