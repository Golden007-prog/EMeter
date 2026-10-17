import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
export function e2eConfig(mode: 'isolated' | 'live') {
  const apiUrl =
    mode === 'isolated'
      ? 'http://127.0.0.1:18080'
      : (process.env.E2E_API_URL ?? 'http://localhost:8080')
  const artifacts =
    process.env.E2E_ARTIFACT_DIR ??
    path.join(root, 'e2e', 'artifacts', `manual-${mode}`)
  const frontend = {
    command: 'npm run build:e2e && npm run preview:e2e',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_BASE_URL: apiUrl },
    cwd: root,
  }
  return defineConfig({
    testDir: path.join(root, 'e2e'),
    testIgnore: '**/artifacts/**',
    testMatch: mode === 'isolated' ? 'properties.spec.ts' : 'live.spec.ts',
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
      baseURL: 'http://127.0.0.1:5173',
      trace: mode === 'live' ? 'on' : 'retain-on-failure',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer:
      mode === 'live'
        ? [frontend]
        : [
            {
              command:
                'dotnet run --project ../UtilityMeter/src/Presentation --no-launch-profile -- --urls http://127.0.0.1:18080 --environment local --ConnectionStrings:UtilityMeter= --Storage:Endpoint=',
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
