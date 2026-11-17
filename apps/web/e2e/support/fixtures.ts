import { test as base, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const contract = JSON.parse(
  readFileSync(path.resolve('docs/openapi/v1.json'), 'utf8'),
)
const operations: { method: string; path: string; pattern: RegExp }[] =
  Object.entries(contract.paths).flatMap(([route, methods]) =>
    Object.keys(methods as object).map((method) => ({
      method: method.toUpperCase(),
      path: route,
      pattern: new RegExp(`^${route.replace(/\{[^}]+\}/g, '[^/]+')}$`),
    })),
  )

// HTTP errors are recorded: some cases intentionally exercise 400/409 recovery.
export const test = base.extend<{ browserDiagnostics: void }>({
  browserDiagnostics: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = []
      const events: object[] = []
      const covered = new Set<string>()
      page.on('pageerror', (error) => {
        errors.push(error.message)
        events.push({ type: 'pageerror', message: error.message })
      })
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning')
          events.push({
            type: 'console',
            level: message.type(),
            text: message.text(),
          })
      })
      page.on('requestfailed', (request) =>
        events.push({
          type: 'requestfailed',
          method: request.method(),
          url: request.url(),
          error: request.failure()?.errorText,
        }),
      )
      page.on('response', (response) => {
        if (response.ok()) {
          const route = new URL(response.url()).pathname
          for (const operation of operations) {
            if (
              operation.method === response.request().method() &&
              operation.pattern.test(route)
            )
              covered.add(`${operation.method} ${operation.path}`)
          }
        }
        if (response.status() >= 400)
          events.push({
            type: 'http',
            status: response.status(),
            url: response.url(),
          })
      })
      await use()
      await testInfo.attach('api-operations', {
        body: JSON.stringify({
          passed: testInfo.status === 'passed',
          operations: [...covered].sort(),
        }),
        contentType: 'application/json',
      })
      await testInfo.attach('browser-diagnostics', {
        body: JSON.stringify(events, null, 2),
        contentType: 'application/json',
      })
      expect(
        errors,
        'No debe haber errores JavaScript sin manejar en el navegador.',
      ).toEqual([])
    },
    { auto: true },
  ],
})
export { expect }
