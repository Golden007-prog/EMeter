import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { reportCoverage } from './coverage.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const project = `utilitymeter-e2e-${randomUUID().slice(0, 8)}`
const artifacts = path.join(root, 'e2e', 'artifacts', project)
await mkdir(artifacts, { recursive: true })
const composeArgs = [
  'compose',
  '-p',
  project,
  '-f',
  path.resolve(root, '../api/docker-compose.yml'),
  '-f',
  path.join(root, 'e2e/compose.override.yml'),
]
function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, ...env },
    })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} terminó con código ${code}`)),
    )
  })
}
async function freePort(port) {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}
const result = {
  project,
  mode: 'full-stack',
  artifacts,
  startedAt: new Date().toISOString(),
  status: 'preflight',
}
let started = false
try {
  await freePort(18081)
  await freePort(15173)
  started = true
  await run('docker', [
    ...composeArgs,
    'up',
    '-d',
    '--build',
    '--wait',
    '--wait-timeout',
    '240',
  ])
  result.status = 'running'
  await run(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'playwright.full-stack.config.ts',
      ...process.argv.slice(2),
    ],
    {
      E2E_WEB_PORT: '15173',
      E2E_API_URL: 'http://127.0.0.1:18081',
      E2E_ARTIFACT_DIR: artifacts,
      E2E_RUN_ID: project,
      E2E_COMPOSE_PROJECT: project,
    },
  )
  result.status = 'passed'
  const coverage = await reportCoverage(artifacts)
  result.coveredOperations = coverage.covered.length
  if (coverage.missing.length && !process.argv.slice(2).length)
    throw new Error(
      `Falta cobertura de ${coverage.missing.length} operaciones: ${coverage.missing.join(', ')}`,
    )
} catch (error) {
  result.status = 'failed'
  result.error = String(error)
  process.exitCode = 1
  console.error(error)
} finally {
  // Only the randomly generated project owned by this invocation can be removed.
  if (started && /^utilitymeter-e2e-[a-f0-9]{8}$/.test(project)) {
    try {
      await run('docker', [
        ...composeArgs,
        'down',
        '--volumes',
        '--remove-orphans',
      ])
    } catch (error) {
      result.cleanupError = String(error)
      result.status = 'failed'
      process.exitCode = 1
    }
  }
  result.finishedAt = new Date().toISOString()
  await writeFile(
    path.join(artifacts, 'run.json'),
    JSON.stringify(result, null, 2),
  )
  console.log(`Full stack: ${result.status}. Artefactos: ${artifacts}`)
}
