import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
export function e2eConfig(mode: 'isolated' | 'live' | 'full-stack') {
  const webPort = Number(process.env.E2E_WEB_PORT ?? 5173)
  const webUrl = `http://127.0.0.1:${webPort}`
  const apiUrl =
    mode === 'isolated'
      ? 'http://127.0.0.1:18080'
      : (process.env.E2E_API_URL ?? 'http://localhost:8080')
  const artifacts =
    process.env.E2E_ARTIFACT_DIR ??
    path.join(root, 'e2e', 'artifacts', `manual-${mode}`)
  const frontend = {
    command: `npm run build:e2e && node node_modules/vite/bin/vite.js preview --outDir .e2e-dist --host 127.0.0.1 --port ${webPort} --strictPort`,
    url: webUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_BASE_URL: apiUrl },
    cwd: root,
  }
  return defineConfig({
    testDir: path.join(root, 'e2e'),
    testIgnore: '**/artifacts/**',
    testMatch:
      mode === 'live'
        ? 'live.spec.ts'
        : mode === 'full-stack'
          ? ['workflows.spec.ts', 'documents.spec.ts']
          : ['properties.spec.ts', 'workflows.spec.ts'],
    outputDir: path.join(artifacts, 'tests'),
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [
      ['list'],
      ['html', { outputFolder: path.join(artifacts, 'report'), open: 'never' }],
      ['json', { outputFile: path.join(artifacts, 'results.json') }],
    ],
    use: {
      baseURL: webUrl,
      actionTimeout: 15_000,
      trace: mode === 'live' ? 'on' : 'retain-on-failure',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer:
      mode !== 'isolated'
        ? [frontend]
        : [
            {
              command:
                'dotnet run --project ../api/src/Presentation --no-launch-profile -- --urls http://127.0.0.1:18080 --environment local --ConnectionStrings:UtilityMeter= --Storage:Endpoint= --Cors:AllowedOrigins:2=' +
                webUrl,
              url: `${apiUrl}/health`,
              reuseExistingServer: false,
              timeout: 120_000,
              cwd: root,
              env: {
                ConnectionStrings__UtilityMeter: '',
                Storage__Endpoint: '',
              },
            },
            frontend,
          ],
  })
}
