import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { chromium } from '@playwright/test'

const webPort = Number(process.env.E2E_WEB_PORT ?? 5173)
if (!Number.isInteger(webPort) || webPort < 1024 || webPort > 65535)
  throw new Error('E2E_WEB_PORT inválido')
const webOrigin = `http://127.0.0.1:${webPort}`
const root = fileURLToPath(new URL('../', import.meta.url))
const { values } = parseArgs({
  options: {
    mode: { type: 'string', default: 'isolated' },
    api: {
      type: 'string',
      default: process.env.E2E_API_URL ?? 'http://localhost:8080',
    },
    write: { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    ui: { type: 'boolean', default: false },
    grep: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (values.help) {
  console.log(`UtilityMeter E2E
  node e2e/harness.mjs --mode isolated
  node e2e/harness.mjs --mode live --api http://localhost:8080
  node e2e/harness.mjs --mode live --api http://localhost:8080 --write
Opciones: --headed (ver navegador), --ui (Playwright UI), --grep texto.
Live usa GET/OPTIONS por defecto. --write habilita una propiedad [E2E] persistente.
Cada ejecución conserva reporte HTML/JSON, trazas y capturas en e2e/artifacts/.`)
  process.exit(0)
}

if (!['isolated', 'live'].includes(values.mode))
  throw new Error('--mode debe ser isolated o live.')
if (values.write && values.mode !== 'live')
  throw new Error('--write solo aplica al modo live.')
const api = new URL(
  values.mode === 'isolated' ? 'http://127.0.0.1:18080' : values.api,
)
if (
  !['http:', 'https:'].includes(api.protocol) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname) ||
  api.username ||
  api.password ||
  api.search ||
  api.hash
) {
  throw new Error(
    'El harness admite una URL local HTTP/HTTPS sin credenciales, query ni fragmento.',
  )
}
const apiUrl = api.href.replace(/\/+$/, '')
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
const artifacts = path.join(root, 'e2e', 'artifacts', `${values.mode}-${runId}`)
await mkdir(artifacts, { recursive: true })
const metadata = {
  runId,
  mode: values.mode,
  apiUrl,
  allowWrites: values.write,
  startedAt: new Date().toISOString(),
  timeZone: 'America/Santiago',
  status: 'preflight',
  artifacts,
}
async function saveMetadata() {
  await writeFile(
    path.join(artifacts, 'run.json'),
    JSON.stringify(metadata, null, 2) + '\n',
  )
}
async function requireFreePort(port) {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', () =>
      reject(
        new Error(
          `El puerto ${port} está ocupado o reservado. Libéralo antes de ejecutar; el harness no detiene servidores ajenos.`,
        ),
      ),
    )
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}
await saveMetadata()
try {
  if (!existsSync(chromium.executablePath()))
    throw new Error('Falta Chromium. Ejecuta: npx playwright install chromium')
  await requireFreePort(webPort)
  if (values.mode === 'isolated') await requireFreePort(18080)
  else {
    const health = await fetch(`${apiUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!health.ok || (await health.json()).status !== 'ok')
      throw new Error(`La API no está saludable: ${apiUrl}/health`)
    const cors = await fetch(`${apiUrl}/api/properties`, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(5000),
      headers: {
        Origin: webOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    if (
      !cors.ok ||
      cors.headers.get('access-control-allow-origin') !== webOrigin
    )
      throw new Error(
        'CORS no permite http://127.0.0.1:5173. Revisa Cors:AllowedOrigins en la API.',
      )
  }
  console.log(
    `E2E ${values.mode} · API ${apiUrl} · ${values.write ? 'creará una propiedad [E2E]' : values.mode === 'live' ? 'solo lectura' : 'datos efímeros'}\nArtefactos: ${artifacts}`,
  )
  metadata.status = 'running'
  await saveMetadata()
  const args = [
    path.join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
    'test',
    '--config',
    values.mode === 'live'
      ? 'playwright.live.config.ts'
      : 'playwright.config.ts',
  ]
  if (values.headed) args.push('--headed')
  if (values.ui) args.push('--ui')
  if (values.grep) args.push('--grep', values.grep)
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_API_URL: apiUrl,
      E2E_ARTIFACT_DIR: artifacts,
      E2E_RUN_ID: runId,
      E2E_ALLOW_WRITES: values.write ? '1' : '0',
    },
  })
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
  metadata.status = code === 0 ? 'passed' : 'failed'
  metadata.exitCode = code
  const resultsPath = path.join(artifacts, 'results.json')
  if (existsSync(resultsPath))
    metadata.stats = JSON.parse(await readFile(resultsPath, 'utf8')).stats
  const recordsPath = path.join(artifacts, 'created-records.json')
  if (existsSync(recordsPath))
    metadata.createdRecords = JSON.parse(await readFile(recordsPath, 'utf8'))
  process.exitCode = code
} catch (error) {
  metadata.status = 'failed'
  metadata.error = error instanceof Error ? error.message : String(error)
  console.error(`E2E: ${metadata.error}`)
  process.exitCode = 1
} finally {
  metadata.finishedAt = new Date().toISOString()
  await saveMetadata()
  if (metadata.stats)
    console.log(
      `Pruebas: ${metadata.stats.expected} aprobadas, ${metadata.stats.unexpected} fallidas, ${metadata.stats.skipped} omitidas.`,
    )
  if (existsSync(path.join(artifacts, 'report', 'index.html')))
    console.log(`Reporte HTML: ${path.join(artifacts, 'report', 'index.html')}`)
  console.log(
    `Resultado: ${metadata.status}\nArtefactos: ${artifacts}\nManifiesto: ${path.join(artifacts, 'run.json')}`,
  )
}
