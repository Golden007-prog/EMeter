import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const api = process.env.E2E_API_URL ?? 'http://127.0.0.1:18080'
export async function post(
  request: APIRequestContext,
  path: string,
  data: object,
) {
  const response = await request.post(`${api}/api/${path}`, { data })
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}
export async function seed(request: APIRequestContext) {
  const name = `E2E ${crypto.randomUUID().slice(0, 8)}`
  const property = await post(request, 'properties', {
    name,
    address: 'Santiago',
    resourceType: 'water',
  })
  const meter = await post(request, 'meters', {
    propertyId: property.id,
    serialNumber: name,
    resourceType: 'water',
    unit: 'm3',
  })
  const period = await post(request, 'billing-periods', {
    start: '2026-10-01T00:00:00-03:00',
    end: '2026-10-31T23:59:59-03:00',
  })
  return { name, property, meter, period }
}
export async function selectOption(page: Page, label: string, text: string) {
  const input = page.getByRole('combobox', { name: label, exact: true })
  await input.fill(text)
  await page.getByRole('option').filter({ hasText: text }).first().click()
}
export async function capture(
  page: Page,
  meterId: string,
  periodId: string,
  value: string,
  date: string,
) {
  await page.goto(
    `/lecturas?by=meter&meterId=${meterId}&billingPeriodId=${periodId}`,
  )
  await page.getByRole('button', { name: 'Nueva lectura', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Lectura acumulada', exact: true })
    .fill(value)
  await page.getByLabel('Fecha y hora de medición').fill(date)
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/readings') && r.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Guardar lectura', exact: true })
    .click()
  const result = await response
  expect(result.status(), await result.text()).toBe(201)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  return result.json()
}
