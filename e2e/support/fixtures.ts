import { test as base, expect } from '@playwright/test'

// HTTP errors are recorded: some cases intentionally exercise 400/409 recovery.
export const test = base.extend<{ browserDiagnostics: void }>({
  browserDiagnostics: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = []
      const events: object[] = []
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
        if (response.status() >= 400)
          events.push({
            type: 'http',
            status: response.status(),
            url: response.url(),
          })
      })
      await use()
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
