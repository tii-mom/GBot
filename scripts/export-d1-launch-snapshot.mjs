import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const env = process.env.CF_ENV || "staging";
const database = process.env.D1_DATABASE || (env === "staging" ? "growthbot-staging" : "growthbot-dev");
const config = "apps/api-worker/wrangler.jsonc";
const outputDir = process.env.EXPORT_DIR || `ops-exports/${new Date().toISOString().replace(/[:.]/g, "-")}`;
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const tables = [
  "users",
  "agents",
  "inventory_items",
  "point_ledger_events",
  "bounty_tasks",
  "bounty_task_verifications",
  "admin_config_audit_logs",
  "analytics_events"
];

async function exportTable(table) {
  const command = `SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 10000;`;
  const args = [
    "wrangler",
    "d1",
    "execute",
    database,
    "--remote",
    "--env",
    env,
    "--config",
    config,
    "--command",
    command
  ];
  const { stdout } = await execFileAsync("npx", args, {
    cwd: repoRoot,
    maxBuffer: 20 * 1024 * 1024
  });
  await writeFile(`${outputDir}/${table}.txt`, stdout, "utf8");
  console.log(`exported ${table}`);
}

await mkdir(outputDir, { recursive: true });
await writeFile(`${outputDir}/manifest.json`, JSON.stringify({
  exportedAt: new Date().toISOString(),
  env,
  database,
  tables
}, null, 2), "utf8");

for (const table of tables) {
  await exportTable(table);
}

console.log(`Launch snapshot exported to ${outputDir}`);
