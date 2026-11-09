// Lokální napojení na Clauda přes Claude Code CLI (`claude -p`).
// Používá přihlášení z Claude Code na tomhle počítači, tedy předplatné Claude,
// takže lokálně není potřeba API klíč. Jen pro osobní lokální demo, ne pro nasazení.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const CLI_MODEL = process.env.CLAUDE_CLI_MODEL || "opus";

type Msg = { role: "user" | "assistant"; content: unknown };

const textOf = (c: unknown): string =>
  typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: string }).text) : "")).join("") : "";

/** Rozhovor převede na jeden prompt (CLI bere jednu zprávu). */
function toPrompt(messages: Msg[]) {
  if (messages.length === 1) return textOf(messages[0].content);
  const history = messages.slice(0, -1).map((m) => `${m.role === "user" ? "Klient" : "Ty (parťák)"}: ${textOf(m.content)}`).join("\n\n");
  return `<dosavadni_rozhovor>\n${history}\n</dosavadni_rozhovor>\n\nNová zpráva klienta (odpověz jen na ni, bez opakování historie):\n${textOf(messages[messages.length - 1].content)}`;
}

const quoteWin = (a: string) => (a === "" || /[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/**
 * Spustí `claude -p` a volá onText s každým kouskem textu. Vrací celý text.
 * Bez nástrojů, bez MCP a bez ukládání relace, pracovní složka je dočasná.
 */
export function cliComplete(opts: { system?: string; messages: Msg[]; onText?: (t: string) => void; signal?: AbortSignal }): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "inbetween-"));
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
    "--model", CLI_MODEL, "--tools", "", "--strict-mcp-config", "--no-session-persistence"];
  if (opts.system) {
    const f = join(dir, "system.txt");
    writeFileSync(f, opts.system, "utf8");
    args.push("--system-prompt-file", f);
  }
  const win = process.platform === "win32";
  const bin = process.env.CLAUDE_CLI_PATH || "claude";
  const child = spawn(win ? quoteWin(bin) : bin, win ? args.map(quoteWin) : args, {
    cwd: dir, shell: win, windowsHide: true, env: { ...process.env, ANTHROPIC_API_KEY: "" },
  });
  opts.signal?.addEventListener("abort", () => child.kill());

  return new Promise((resolve, reject) => {
    let buf = "", full = "", result = "", err = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.type === "stream_event" && ev.event?.type === "content_block_delta" && ev.event.delta?.type === "text_delta") {
            full += ev.event.delta.text;
            opts.onText?.(ev.event.delta.text);
          } else if (ev.type === "result") {
            if (ev.is_error) err += String(ev.result ?? "chyba");
            else result = String(ev.result ?? "");
          }
        } catch { /* nejde o JSON řádek */ }
      }
    });
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => reject(new Error(`Nepodařilo se spustit Claude Code (${bin}): ${e.message}`)));
    child.on("close", (code) => {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
      const text = full || result;
      if (text.trim()) {
        // Když stream nedodal části, pošli aspoň celý výsledek najednou.
        if (!full && result) opts.onText?.(result);
        resolve(text);
      } else reject(new Error(`Claude Code skončil s kódem ${code}: ${err.slice(0, 500)}`));
    });
    child.stdin.end(toPrompt(opts.messages), "utf8");
  });
}
