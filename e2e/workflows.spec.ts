import { test, expect } from './support/fixtures'
import { api, capture, post, seed, selectOption } from './support/domain'
import { readFileSync } from 'node:fs'

test('contrato vigente conserva las 45 operaciones planificadas', async ({
  request,
}) => {
  const baseline = JSON.parse(readFileSync('docs/openapi/v1.json', 'utf8'))
  const active = await (await request.get(`${api}/openapi/v1.json`)).json()
  const operations = (paths: Record<string, object>) =>
    Object.entries(paths)
      .flatMap(([route, methods]) =>
        Object.keys(methods).map((method) => `${method} ${route}`),
      )
      .sort()
  expect(operations(active.paths)).toEqual(operations(baseline.paths))
  expect(operations(active.paths)).toHaveLength(45)
})

test('catálogos completos, principal, períodos y versión desde la interfaz', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const name = `Flujo ${crypto.randomUUID().slice(0, 8)}`
  await page.goto(
    `/configuracion/organizaciones?search=${encodeURIComponent(name)}`,
  )
  await page
    .getByRole('button', { name: 'Nueva organización', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(name)
  await page
    .getByRole('textbox', { name: 'Correo de contacto (opcional)' })
    .fill('e2e@example.com')
  await page
    .getByRole('button', { name: 'Crear organización', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const orgRow = page.getByRole('row').filter({ hasText: name })
  await orgRow.getByRole('button', { name: 'Editar', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Correo de contacto (opcional)' })
    .fill('editado@example.com')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(orgRow).toContainText('editado@example.com')
  await page.getByRole('link', { name, exact: true }).click()
  await expect(page.getByText('editado@example.com')).toBeVisible()
  await page.goto(
    `/configuracion/condominios?search=${encodeURIComponent(name)}`,
  )
  await page
    .getByRole('button', { name: 'Nuevo condominio', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(name)
  await page
    .getByRole('textbox', { name: 'Dirección', exact: true })
    .fill('Santiago 1')
  await selectOption(page, 'Organización (opcional)', name)
  const condoResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/condominiums') && r.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Crear condominio', exact: true })
    .click()
  const condo = await (await condoResponse).json()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Editar', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Dirección', exact: true })
    .fill('Santiago 2')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto(
    `/configuracion/propiedades?search=${encodeURIComponent(name)}`,
  )
  await page
    .getByRole('button', { name: 'Nueva propiedad', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Nombre de la propiedad' }).fill(name)
  await page
    .getByRole('textbox', { name: 'Dirección', exact: true })
    .fill('Santiago 3')
  await selectOption(page, 'Condominio (opcional)', name)
  const propertyResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/properties') && r.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Crear propiedad', exact: true })
    .click()
  const property = await (await propertyResponse).json()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto(`/configuracion/propiedades/${property.id}`)
  await page.getByRole('button', { name: 'Editar nombre y dirección' }).click()
  await page
    .getByRole('textbox', { name: 'Dirección', exact: true })
    .fill('Santiago 4')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Santiago 4')).toBeVisible()
  await page.goto(`/configuracion/medidores?search=${encodeURIComponent(name)}`)
  await page.getByRole('button', { name: 'Nuevo medidor', exact: true }).click()
  await selectOption(page, 'Propiedad', name)
  await page.getByRole('textbox', { name: 'Número de serie' }).fill(name)
  await page.getByRole('textbox', { name: 'Unidad', exact: true }).fill('m3')
  const meterResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/meters') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Crear medidor', exact: true }).click()
  const meter = await (await meterResponse).json()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Buscar por serie' }).fill(name)
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Editar', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Modelo (opcional)' })
    .fill('Modelo revisado')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: 'Detalle', exact: true }).click()
  await expect(page.getByText(/Modelo revisado/)).toBeVisible()
  await page.goto(`/configuracion/condominios/${condo.id}`)
  await page
    .getByRole('combobox', { name: 'Medidor de una propiedad del condominio' })
    .click()
  await page.getByRole('option').filter({ hasText: name }).click()
  const assigned = page.waitForResponse(
    (response) =>
      response.url().includes(`/main-meter/${meter.id}`) &&
      response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Asignar como principal' }).click()
  expect((await assigned).status()).toBe(204)
  await expect(
    page.getByText(`${name} · ${name} · m3`, { exact: true }).first(),
  ).toBeVisible()
  await page.goto('/configuracion/periodos')
  await page.getByRole('button', { name: 'Nuevo período', exact: true }).click()
  await page.getByLabel('Inicio').fill('2027-01-01T00:00')
  await page.getByLabel('Fin').fill('2027-01-31T23:59')
  const periodResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/billing-periods') &&
      r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Crear período' }).click()
  const period = await (await periodResponse).json()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const row = page.getByRole('row').filter({
    has: page.locator(`a[href="/periodo?billingPeriodId=${period.id}"]`),
  })
  await row.getByRole('button', { name: 'Editar fechas' }).click()
  await page.getByLabel('Fin').fill('2027-02-01T00:00')
  await page.getByRole('button', { name: 'Guardar fechas' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await row.getByRole('button', { name: 'Aplicar' }).click()
  await expect(
    row.getByRole('cell', { name: 'En recopilación', exact: true }),
  ).toBeVisible()
  await row.getByRole('link', { name: 'Abrir período' }).click()
  await expect(page.getByText(/Collecting/)).toBeVisible()
  await page.goto(
    `/reportes?billingPeriodId=${period.id}&condominiumId=${condo.id}`,
  )
  await expect(page.getByText(/Conciliación incompleta/)).toBeVisible()
  await page.goto(`/lecturas?by=property&propertyId=${property.id}`)
  await expect(
    page.getByText('No hay lecturas para este contexto.'),
  ).toBeVisible()
  await page.goto(`/lecturas?by=meter&meterId=${meter.id}`)
  await expect(
    page.getByText('No hay lecturas para este contexto.'),
  ).toBeVisible()
  await page.goto('/configuracion/sistema')
  await expect(page.getByText(/^Versión:/)).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath('system.png'),
    fullPage: true,
  })
})

test('captura, histórico, revisión, corrección, conflicto, anulación y cierre', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const { meter, period, property } = await seed(request)
  const first = await capture(
    page,
    meter.id,
    period.id,
    '100',
    '2026-10-02T12:00',
  )
  const last = await capture(
    page,
    meter.id,
    period.id,
    '130,25',
    '2026-10-10T12:00',
  )
  await capture(page, meter.id, period.id, '110', '2026-10-05T12:00')
  const latest = await (
    await request.get(`${api}/api/readings/${last.id}`)
  ).json()
  expect(latest.previousReadingId).not.toBe(first.id)
  await page.goto(`/lecturas/${last.id}`)
  await expect(page.getByText(/20,25 m3/)).toBeVisible()
  await page
    .getByRole('button', { name: 'Confirmar lectura', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Motivo', exact: true })
    .fill('Verificación humana')
  await page.getByRole('button', { name: 'Confirmar decisión' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Corregir lectura' }).click()
  await page
    .getByRole('textbox', { name: 'Lectura acumulada', exact: true })
    .fill('131,50')
  await page
    .getByRole('textbox', { name: 'Motivo de la corrección' })
    .fill('Corregir transcripción')
  const current = await (
    await request.get(`${api}/api/readings/${last.id}`)
  ).json()
  await post(request, `readings/${last.id}/review`, {
    decision: 'Rejected',
    expectedVersion: current.version,
    reason: 'Cambio concurrente de prueba',
  })
  await page.getByRole('button', { name: /Guardar corrección/ }).click()
  await expect(page.getByText(/El servidor rechazó la operación/)).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Lectura acumulada', exact: true }),
  ).toHaveValue('131,50')
  await expect(
    page.getByRole('button', { name: /Guardar corrección/ }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'He revisado el estado actual' })
    .click()
  await page.getByRole('button', { name: /Guardar corrección/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Rechazar lectura', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Motivo', exact: true })
    .fill('Revisar original')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Rechazar lectura', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Reincorporar lectura', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Motivo', exact: true })
    .fill('Verificado nuevamente')
  await page.getByRole('button', { name: 'Confirmar decisión' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Anular lectura', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Motivo de anulación' })
    .fill('Anulación de prueba')
  await page.getByRole('button', { name: /Anular lectura · v/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Corregir lectura' }),
  ).toBeDisabled()
  await expect(
    page.getByText('Anulación de prueba', { exact: true }),
  ).toBeVisible()
  await page.goto(
    `/reportes?billingPeriodId=${period.id}&propertyId=${property.id}`,
  )
  await expect(
    page.getByRole('table', { name: 'Consumos por origen y unidad' }),
  ).toContainText('No calculable')
  await page.goto(`/periodo?billingPeriodId=${period.id}`)
  await page
    .getByRole('button', { name: 'Cerrar período', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Confirmar cierre irreversible' })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText(/Período cerrado/)).toBeVisible()
  await page.goto(`/lecturas/${first.id}`)
  await expect(
    page.getByRole('button', { name: 'Corregir lectura' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Adjuntar evidencia' }),
  ).toBeDisabled()
  expect(
    (
      await request.put(`${api}/api/billing-periods/${period.id}/status/Open`)
    ).status(),
  ).toBe(409)
})

test('captura conserva requestId ante respuesta perdida y permite quitar período', async ({
  page,
  request,
}) => {
  const { meter, period } = await seed(request)
  const bodies: string[] = []
  let first = true
  await page.route('**/api/readings', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    bodies.push(route.request().postData()!)
    if (first) {
      first = false
      await route.fetch()
      await route.abort('failed')
    } else await route.continue()
  })
  await page.goto(
    `/lecturas?by=meter&meterId=${meter.id}&billingPeriodId=${period.id}`,
  )
  await page.getByRole('button', { name: 'Nueva lectura' }).click()
  await page
    .getByRole('textbox', { name: 'Lectura acumulada', exact: true })
    .fill('9999999999999999,99')
  const periodBox = page.getByRole('combobox', { name: 'Período (opcional)' })
  await periodBox.hover()
  await periodBox
    .locator('..')
    .getByRole('button', { name: 'Quitar selección' })
    .click()
  await page.getByRole('button', { name: 'Guardar lectura' }).click()
  await expect(
    page.getByRole('button', { name: 'Reintentar la misma captura' }),
  ).toBeEnabled()
  await page
    .getByRole('button', { name: 'Reintentar la misma captura' })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(bodies).toHaveLength(2)
  expect(bodies[0]).toBe(bodies[1])
  expect(bodies[0]).toContain('9999999999999999.99')
  expect(JSON.parse(bodies[0]).billingPeriodId).toBeNull()
  const alteredRetry = await request.post(`${api}/api/readings`, {
    data: bodies[0].replace('9999999999999999.99', '1.00'),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(alteredRetry.status()).toBe(409)
  const rows = await (
    await request.get(`${api}/api/readings/meter/${meter.id}`)
  ).json()
  expect(rows).toHaveLength(1)
  await expect(page.getByRole('table')).toContainText('9999999999999999.99')
})

test('cierre externo bloquea recálculo histórico indirecto y conserva el borrador', async ({
  page,
  request,
}) => {
  const { meter, period } = await seed(request)
  const reading = await capture(
    page,
    meter.id,
    period.id,
    '100',
    '2026-10-10T12:00',
  )
  await page.goto(`/lecturas?by=meter&meterId=${meter.id}`)
  await page.getByRole('button', { name: 'Nueva lectura' }).click()
  await page
    .getByRole('textbox', { name: 'Lectura acumulada', exact: true })
    .fill('90')
  await page.getByLabel('Fecha y hora de medición').fill('2026-09-30T12:00')
  expect(
    (
      await request.put(`${api}/api/billing-periods/${period.id}/status/Closed`)
    ).status(),
  ).toBe(204)
  const conflict = page.waitForResponse(
    (r) => r.url().endsWith('/api/readings') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Guardar lectura' }).click()
  expect((await conflict).status()).toBe(409)
  await expect(
    page.getByRole('textbox', { name: 'Lectura acumulada', exact: true }),
  ).toHaveValue('90')
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  expect(
    await (await request.get(`${api}/api/readings/meter/${meter.id}`)).json(),
  ).toHaveLength(1)
  const unchanged = await (
    await request.get(`${api}/api/readings/${reading.id}`)
  ).json()
  expect(unchanged.previousReadingId).toBeNull()
  expect(unchanged.version).toBe(1)
  for (const action of ['review', 'void']) {
    const response = await request.post(
      `${api}/api/readings/${reading.id}/${action}`,
      {
        data: {
          decision: 'Confirmed',
          expectedVersion: unchanged.version,
          reason: 'Verificar cierre',
        },
      },
    )
    expect(response.status()).toBe(409)
  }
  expect(
    (
      await request.put(`${api}/api/readings/${reading.id}`, {
        data: {
          value: 101,
          measuredAt: unchanged.measuredAt,
          billingPeriodId: period.id,
          expectedVersion: unchanged.version,
          reason: 'Verificar cierre',
        },
      })
    ).status(),
  ).toBe(409)
})

test('documentos muestra 413 y 500 recuperables y valida tamaño antes del upload', async ({
  page,
}) => {
  await page.goto('/documentos')
  let attempts = 0
  await page.route('**/api/evidence/upload', async (route) => {
    attempts++
    const status = attempts === 1 ? 413 : 500
    await route.fulfill({
      status,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        status,
        title: 'Error de prueba',
        detail: `Respuesta controlada ${status}`,
      }),
    })
  })
  const input = page.locator('input[type=file]')
  await input.setInputFiles({
    name: 'grande.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
  })
  await expect(
    page.getByText('El archivo debe tener contenido y no superar 20 MiB.'),
  ).toBeVisible()
  expect(attempts).toBe(0)
  for (const status of [413, 500]) {
    await input.setInputFiles({
      name: 'prueba.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n'),
    })
    await expect(page.getByText(`Respuesta controlada ${status}`)).toBeVisible()
    await expect(
      page.getByText('Subir documento', { exact: true }),
    ).toBeVisible()
  }
  expect(attempts).toBe(2)
})

test('paginación real de medidores y auditoría conserva enlaces y recarga', async ({
  page,
  request,
}) => {
  const { name, property, meter } = await seed(request)
  for (let i = 0; i < 26; i++)
    await post(request, 'meters', {
      propertyId: property.id,
      serialNumber: `${name} ${i}`,
      resourceType: 'water',
      unit: 'm3',
    })
  await page.goto(`/configuracion/medidores?propertyId=${property.id}`)
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(26)
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await page.reload()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3)
  const reading = await post(request, 'readings', {
    meterId: meter.id,
    value: 10,
    unit: 'm3',
    measuredAt: '2026-10-05T12:00:00-03:00',
  })
  for (let i = 0; i < 21; i++) {
    const current = await (
      await request.get(`${api}/api/readings/${reading.id}`)
    ).json()
    const response = await request.put(`${api}/api/readings/${reading.id}`, {
      data: {
        value: 11 + i,
        measuredAt: '2026-10-05T12:00:00-03:00',
        expectedVersion: current.version,
        reason: `Revisión ${i}`,
        billingPeriodId: null,
      },
    })
    expect(response.ok()).toBeTruthy()
  }
  await page.goto(`/lecturas/${reading.id}`)
  await page.getByRole('link', { name: 'Cambios posteriores' }).click()
  await expect(page).toHaveURL(/historyPage=2/)
  await page.reload()
  await expect(page.getByText(/Página 2/)).toBeVisible()
})

test('conciliación completa e incompleta conserva unidades y origen', async ({
  page,
  request,
}) => {
  const { period } = await seed(request)
  const condo = await post(request, 'condominiums', {
    name: `Conciliación ${crypto.randomUUID()}`,
    address: 'Santiago',
  })
  const meters: { id: string }[] = []
  for (const name of ['Principal', 'Secundario']) {
    const property = await post(request, 'properties', {
      name,
      address: 'Santiago',
      resourceType: 'water',
      condominiumId: condo.id,
    })
    const meter = await post(request, 'meters', {
      propertyId: property.id,
      serialNumber: name,
      resourceType: 'water',
      unit: 'm3',
    })
    meters.push(meter)
    await post(request, 'readings', {
      meterId: meter.id,
      value: 100,
      unit: 'm3',
      source: 'Resident',
      measuredAt: '2026-09-30T12:00:00-03:00',
    })
    await post(request, 'readings', {
      meterId: meter.id,
      value: name === 'Principal' ? 120 : 115,
      unit: 'm3',
      source: 'Resident',
      measuredAt: '2026-10-10T12:00:00-03:00',
      billingPeriodId: period.id,
    })
  }
  expect(
    (
      await request.put(
        `${api}/api/condominiums/${condo.id}/main-meter/${meters[0].id}`,
      )
    ).ok(),
  ).toBeTruthy()
  await page.goto(
    `/reportes?billingPeriodId=${period.id}&condominiumId=${condo.id}&source=Resident`,
  )
  await expect(page.getByText(/Conciliación completa/)).toBeVisible()
  await expect(page.getByText(/Diferencia: 5/)).toBeVisible()
  await page.getByRole('combobox', { name: 'Origen de conciliación' }).click()
  await page.getByRole('option', { name: 'Company', exact: true }).click()
  await expect(page.getByText(/Conciliación incompleta/)).toBeVisible()
  await expect(page.getByText(/Diferencia: No calculable/)).toBeVisible()
  const property = await post(request, 'properties', {
    name: 'Unidad distinta',
    address: 'Santiago',
    resourceType: 'water',
    condominiumId: condo.id,
  })
  await post(request, 'meters', {
    propertyId: property.id,
    serialNumber: 'Litros',
    resourceType: 'water',
    unit: 'L',
  })
  await page.goto(
    `/reportes?billingPeriodId=${period.id}&condominiumId=${condo.id}&source=Resident`,
  )
  await expect(page.getByText(/Conciliación incompleta/)).toBeVisible()
  await expect(
    page.getByText(/Unidad distinta:.*Incompatible unit/),
  ).toBeVisible()
})
