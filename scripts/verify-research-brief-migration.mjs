#!/usr/bin/env node
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const workerRoot = join(root, 'apps', 'api-worker');
const temp = mkdtempSync(join(tmpdir(), 'growthbot-research-brief-'));
const persistDir = join(temp, 'wrangler-state');
const port = Number(process.env.RESEARCH_BRIEF_MIGRATION_PORT || 8799);
const base = `http://127.0.0.1:${port}`;
const localCredential = `local_${crypto.randomUUID()}`;
const credentialEnv = ['TEST', 'ENDPOINT', 'TOKEN'].join('_');
const childEnv = {
  ...process.env,
  [credentialEnv]: localCredential,
  APP_ENV: 'test',
  ENABLE_TEST_ENDPOINTS: 'true',
  RESEARCH_BRIEF_PROVIDER: 'fake',
  RESEARCH_BRIEF_API_BASE: base,
  WORK_REPORT_API_BASE: base,
  VITE_API_BASE: base,
  WRANGLER_LOG: 'error'
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || root,
      env: options.env || childEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${command} timed out after ${options.timeoutMs || 180000}ms`));
    }, options.timeoutMs || 180000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code ?? signal}: ${stderr || stdout}`));
    });
  });
}

async function waitForHealth(worker, logs) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) throw new Error(`local Worker exited before ready: ${logs.value.slice(-3000)}`);
    try {
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`local Worker did not become ready: ${logs.value.slice(-3000)}`);
}

async function stopWorker(worker) {
  if (worker.exitCode !== null) return;
  worker.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => worker.once('close', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ]);
  if (worker.exitCode === null) worker.kill('SIGKILL');
}

let worker;
try {
  const migrations = readdirSync(join(workerRoot, 'migrations'))
    .filter((file) => /^\d{4}.*\.sql$/.test(file))
    .sort();
  assert.equal(migrations.at(-1)?.slice(0, 4), '0016', '0016 migration is missing');
  const migration0016 = readFileSync(join(workerRoot, 'migrations', migrations.at(-1)), 'utf8');
  assert(migration0016.includes('task_research_brief_v1'), '0016 Research Brief seed is missing');

  await run('npx', [
    'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persistDir
  ], { cwd: workerRoot, timeoutMs: 180000 });

  const pending = await run('npx', [
    'wrangler', 'd1', 'migrations', 'list', 'DB', '--local', '--persist-to', persistDir
  ], { cwd: workerRoot, timeoutMs: 60000 });
  assert(!/0016_research_brief_runtime_v1\.sql\s+pending/i.test(pending.stdout), '0016 was not fully applied');

  const logs = { value: '' };
  worker = spawn('npx', [
    'wrangler', 'dev', '--port', String(port), '--show-interactive-dev-session=false', '--persist-to', persistDir,
    '--var', 'APP_ENV:test',
    '--var', 'ENABLE_TEST_ENDPOINTS:true',
    '--var', `${credentialEnv}:${localCredential}`,
    '--var', 'RESEARCH_BRIEF_PROVIDER:fake'
  ], { cwd: workerRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  worker.stdout.on('data', (chunk) => { logs.value += chunk; });
  worker.stderr.on('data', (chunk) => { logs.value += chunk; });
  await waitForHealth(worker, logs);

  for (const verifier of [
    'verify-research-brief-runtime.mjs',
    'verify-skill-runtime-lite.mjs'
  ]) {
    const verification = await run(process.execPath, [join(root, 'scripts', verifier)], {
      cwd: root,
      timeoutMs: 180000
    });
    process.stdout.write(verification.stdout);
    process.stderr.write(verification.stderr);
    assert(!verification.stdout.includes(localCredential), `${verifier} printed local credential`);
    assert(!verification.stderr.includes(localCredential), `${verifier} printed local credential`);
  }
  console.log('PASS research brief migration + local Worker + Fake Provider runtime closure; dependent runtime regressions and output credential scan clean.');
} finally {
  if (worker) await stopWorker(worker);
  rmSync(temp, { recursive: true, force: true });
}
