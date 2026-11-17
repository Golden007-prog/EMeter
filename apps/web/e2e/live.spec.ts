import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from './support/fixtures'

const api = (process.env.E2E_API_URL ?? 'http://localhost:8080').replace(
  /\/+$/,
  '',
)
const runId = process.env.E2E_RUN_ID ?? randomUUID()
const search = `[E2E] sin resultados ${runId}`

test('API activa: OpenAPI, catálogos, ProblemDetails y CORS reales', async ({
  request,
}) => {
  const health = await request.get(`${api}/health`)
  expect(health.ok()).toBe(true)
  expect(await health.json()).toEqual({ status: 'ok' })
  const openapi = await request.get(`${api}/openapi/v1.json`)
  expect(openapi.ok()).toBe(true)
  const spec = await openapi.json()
  const schema =
    spec.paths['/api/properties'].post.requestBody.content['application/json']
      .schema
  const create = schema.$ref
    ? spec.components.schemas[schema.$ref.split('/').at(-1)]
    : schema
  expect(create.required).toEqual(
    expect.arrayContaining(['name', 'address', 'resourceType']),
  )
  expect(create.required).not.toContain('organizationId')
  expect(create.required).not.toContain('condominiumId')
  for (const kind of ['properties', 'organizations', 'condominiums']) {
    const response = await request.get(`${api}/api/${kind}?page=1&pageSize=1`)
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toMatchObject({
      pageNumber: 1,
      pageSize: 1,
      totalCount: expect.any(Number),
      hasNextPage: expect.any(Boolean),
    })
    expect(Array.isArray(data.items)).toBe(true)
    expect(data.items.length).toBeLessThanOrEqual(1)
    expect(data.hasNextPage).toBe(data.totalCount > 1)
  }
  const invalid = await request.get(`${api}/api/properties?page=0`)
  expect(invalid.status()).toBe(400)
  expect(invalid.headers()['content-type']).toContain(
    'application/problem+json',
  )
  expect(await invalid.json()).toMatchObject({
    status: 400,
    errors: expect.any(Object),
  })
  const missing = await request.get(`${api}/api/properties/${randomUUID()}`)
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type']).toContain(
    'application/problem+json',
  )
  const preflight = await request.fetch(`${api}/api/properties`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  expect(preflight.ok()).toBe(true)
  expect(preflight.headers()['access-control-allow-origin']).toBe(
    'http://127.0.0.1:5173',
  )
  expect(preflight.headers()['access-control-allow-methods']).toContain('POST')
})

test('directorio del backend activo: datos, búsqueda, recarga y navegación', async ({
  page,
}) => {
  const response = page.waitForResponse(
    (response) =>
      response.url().startsWith(`${api}/api/properties?`) &&
      response.status() === 200,
  )
  await page.goto('/configuracion/propiedades')
  const data = await (await response).json()
  await expect(
    page.getByRole('heading', { name: 'Propiedades', exact: true }),
  ).toBeVisible()
  if (data.items.length) {
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(
      data.items.length + 1,
    )
    for (const item of data.items)
      await expect(page.getByRole('table')).toContainText(item.name)
  } else
    await expect(
      page.getByText('Tu primera propiedad empieza aquí'),
    ).toBeVisible()
  await page.getByRole('textbox', { name: 'Buscar por nombre' }).fill(search)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByText('No encontramos propiedades')).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('textbox', { name: 'Buscar por nombre' }),
  ).toHaveValue(search)
  await page.getByRole('link', { name: 'Reportes', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Reportes', exact: true }),
  ).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole('textbox', { name: 'Buscar por nombre' }),
  ).toHaveValue(search)
  await page.screenshot({
    path: test.info().outputPath('live-directory.png'),
    fullPage: true,
  })
})

test('formulario y móvil sin escribir en el backend activo', async ({
  page,
}) => {
  const writes: string[] = []
  page.on('request', (request) => {
    if (
      request.url().startsWith(api) &&
      !['GET', 'OPTIONS', 'HEAD'].includes(request.method())
    )
      writes.push(`${request.method()} ${request.url()}`)
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(
    `/configuracion/propiedades?search=${encodeURIComponent(search)}`,
  )
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await page.getByRole('link', { name: 'Configuración', exact: true }).click()
  await page
    .getByRole('button', { name: 'Nueva propiedad', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Crear propiedad', exact: true })
    .click()
  await expect(
    page.getByText('Escribe el nombre de la propiedad.'),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Nombre de la propiedad' }),
  ).toBeFocused()
  await page.screenshot({
    path: test.info().outputPath('live-form-mobile.png'),
    fullPage: true,
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Nueva propiedad', exact: true }),
  ).toBeFocused()
  expect(writes).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('crea una única propiedad [E2E] en el backend activo y verifica persistencia', async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    process.env.E2E_ALLOW_WRITES !== '1',
    'Habilitar con --write. El catálogo no ofrece borrado: la propiedad permanece.',
  )
  const name = `[E2E] Propiedad ${runId}`
  await page.goto(
    `/configuracion/propiedades?search=${encodeURIComponent(name)}`,
  )
  await expect(page.getByText('No encontramos propiedades')).toBeVisible()
  await page
    .getByRole('button', { name: 'Nueva propiedad', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Nombre de la propiedad' }).fill(name)
  await page
    .getByRole('textbox', { name: 'Dirección', exact: true })
    .fill('Propiedad sintética de prueba E2E, Santiago')
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url() === `${api}/api/properties`,
  )
  await page
    .getByRole('button', { name: 'Crear propiedad', exact: true })
    .click()
  const response = await saved
  expect(response.status()).toBe(201)
  const created = await response.json()
  // Save immediately after POST, even if a subsequent UI assertion fails.
  const record = {
    apiUrl: api,
    runId,
    resource: 'properties',
    id: created.id,
    name,
    cleanup:
      'El backend no ofrece DELETE de catálogos; no se modifica ningún registro existente.',
  }
  await writeFile(
    testInfo.outputPath('created-record.json'),
    JSON.stringify(record, null, 2),
  )
  if (process.env.E2E_ARTIFACT_DIR)
    await writeFile(
      path.join(process.env.E2E_ARTIFACT_DIR, 'created-records.json'),
      JSON.stringify([record], null, 2),
    )
  await testInfo.attach('created-record', {
    body: JSON.stringify(record, null, 2),
    contentType: 'application/json',
  })
  expect(created).toMatchObject({
    name,
    resourceType: 'water',
    organizationId: null,
    condominiumId: null,
  })
  expect(response.headers().location).toBe(`/api/properties/${created.id}`)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('table')).toContainText(name)
  await page.reload()
  await expect(page.getByRole('table')).toContainText(name)
  const detail = await request.get(`${api}/api/properties/${created.id}`)
  expect(detail.status()).toBe(200)
  expect(await detail.json()).toEqual(created)
  await page.screenshot({
    path: testInfo.outputPath('live-created-property.png'),
    fullPage: true,
  })
})
