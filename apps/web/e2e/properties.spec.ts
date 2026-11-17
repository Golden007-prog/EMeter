import { expect, test } from './support/fixtures'
import type { Page } from '@playwright/test'

const api = 'http://127.0.0.1:18080'
const unique = () => crypto.randomUUID().slice(0, 8)
const property = {
  id: 'f3c503ad-cf57-4a57-9cb1-7a1ad19d58b1',
  name: 'Casa de prueba',
  address: 'Los Aromos 123, Santiago',
  resourceType: 'water',
  organizationId: null,
  condominiumId: null,
}

async function fillProperty(page: Page, name: string) {
  await page
    .getByRole('button', { name: 'Nueva propiedad', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Nombre de la propiedad' }).fill(name)
  await page
    .getByRole('textbox', { name: 'Dirección', exact: true })
    .fill('Los Aromos 123, Santiago')
}

test('crea una propiedad independiente, actualiza la lista y persiste tras recargar', async ({
  page,
}) => {
  const name = `Casa independiente ${unique()}`
  await page.goto(
    `/configuracion/propiedades?search=${encodeURIComponent(name)}`,
  )
  await expect(page.getByText('No encontramos propiedades')).toBeVisible()
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
  await page.getByRole('textbox', { name: 'Nombre de la propiedad' }).fill(name)
  await page
    .getByRole('textbox', { name: 'Dirección', exact: true })
    .fill(property.address)
  const request = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/api/properties'),
  )
  await page
    .getByRole('button', { name: 'Crear propiedad', exact: true })
    .click()
  expect((await request).postDataJSON()).toEqual({
    name,
    address: property.address,
    resourceType: 'water',
    organizationId: null,
    condominiumId: null,
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('table')).toContainText(name)
  await expect(page.getByRole('table')).toContainText('Independiente')
  await expect(page.getByRole('table')).toContainText('Agua')
  await page.reload()
  await expect(page.getByRole('table')).toContainText(name)
  await page.screenshot({
    path: test.info().outputPath('properties-desktop.png'),
    fullPage: true,
  })
})

test('pagina y conserva búsqueda, tamaño, pertenencia y período al recargar y volver', async ({
  page,
  request,
}) => {
  const prefix = `Paginadas ${unique()}`
  for (let i = 0; i < 12; i++) {
    const response = await request.post(`${api}/api/properties`, {
      data: {
        name: `${prefix} ${i}`,
        address: property.address,
        resourceType: 'electricity',
      },
    })
    expect(response.status()).toBe(201)
  }
  const period = crypto.randomUUID()
  await page.goto(
    `/configuracion/propiedades?search=${encodeURIComponent(prefix)}&pageSize=10&billingPeriodId=${period}`,
  )
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(11)
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3)
  await page.getByRole('link', { name: 'Lecturas', exact: true }).click()
  await expect(page).toHaveURL(
    new RegExp(`lecturas\\?billingPeriodId=${period}`),
  )
  await page.goBack()
  await expect(
    page.getByRole('textbox', { name: 'Buscar por nombre' }),
  ).toHaveValue(prefix)
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3)
  await page.getByRole('combobox', { name: 'Por página' }).click()
  await page.getByRole('option', { name: '25', exact: true }).click()
  await expect(page).toHaveURL(/pageSize=25/)
  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(13)
})

test('selecciona pertenencia con nombres e infiere la organización del condominio', async ({
  page,
  request,
}) => {
  const suffix = unique()
  const organization = await (
    await request.post(`${api}/api/organizations`, {
      data: { name: `Organización ${suffix}` },
    })
  ).json()
  const condominium = await (
    await request.post(`${api}/api/condominiums`, {
      data: {
        name: `Condominio ${suffix}`,
        address: property.address,
        organizationId: organization.id,
      },
    })
  ).json()
  const name = `Departamento ${suffix}`
  await page.goto(
    `/configuracion/propiedades?search=${encodeURIComponent(name)}`,
  )
  await fillProperty(page, name)
  await page
    .getByRole('combobox', { name: 'Condominio (opcional)' })
    .fill(`Condominio ${suffix}`)
  await page
    .getByRole('option', { name: new RegExp(`Condominio ${suffix}`) })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Organización (opcional)' }),
  ).toHaveValue(`Organización ${suffix}`)
  await page.getByRole('combobox', { name: 'Recurso', exact: true }).click()
  await page.getByRole('option', { name: 'Gas', exact: true }).click()
  const response = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' &&
      res.url().endsWith('/api/properties'),
  )
  await page
    .getByRole('button', { name: 'Crear propiedad', exact: true })
    .click()
  const saved = await response
  expect(saved.status()).toBe(201)
  expect(await saved.json()).toMatchObject({
    organizationId: organization.id,
    condominiumId: condominium.id,
  })
  await expect(page.getByRole('table')).toContainText(`Condominio ${suffix}`)
  await expect(page.getByRole('table')).toContainText(`Organización ${suffix}`)
  await expect(page.getByRole('table')).toContainText('Gas')
  await page
    .getByRole('combobox', { name: 'Organización', exact: true })
    .fill(`Organización ${suffix}`)
  await page
    .getByRole('option', { name: `Organización ${suffix}`, exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp(`organizationId=${organization.id}`))
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'Organización', exact: true }),
  ).toHaveValue(`Organización ${suffix}`)
  await expect(page.getByRole('table')).toContainText(name)
})

test('muestra carga, error recuperable y estado vacío', async ({ page }) => {
  let finish: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route('**/api/properties?*', async (route) => {
    await pending
    await route.fulfill({
      status: 400,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        title: 'Filtro inválido',
        detail: 'Comprueba los filtros de búsqueda.',
      }),
    })
  })
  await page.goto('/configuracion/propiedades')
  await expect(
    page.getByRole('status', { name: 'Cargando propiedades' }),
  ).toBeVisible()
  finish()
  await expect(page.getByRole('alert')).toContainText(
    'Comprueba los filtros de búsqueda.',
  )
  await page.unroute('**/api/properties?*')
  await page.route('**/api/properties?*', (route) =>
    route.fulfill({
      json: {
        items: [],
        pageNumber: 1,
        pageSize: 10,
        totalCount: 0,
        hasNextPage: false,
      },
    }),
  )
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(
    page.getByText('Tu primera propiedad empieza aquí'),
  ).toBeVisible()
})

test('conserva campos ante validación del servidor y 409 y evita doble envío', async ({
  page,
}) => {
  let submissions = 0
  await page.route('**/api/properties', async (route) => {
    submissions++
    await new Promise((resolve) => setTimeout(resolve, 200))
    if (submissions === 1)
      await route.fulfill({
        status: 400,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'Validation failed',
          errors: {
            Name: ['Nombre observado por el servidor.'],
            request: ['Revisa los datos.'],
          },
        }),
      })
    else
      await route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'Conflict',
          detail: 'Los datos cambiaron en el servidor.',
        }),
      })
  })
  await page.goto('/configuracion/propiedades')
  await fillProperty(page, property.name)
  await page
    .getByRole('button', { name: 'Crear propiedad', exact: true })
    .click({ clickCount: 2 })
  await expect(
    page.getByRole('textbox', { name: 'Nombre de la propiedad' }),
  ).toBeFocused()
  await expect(
    page.getByRole('textbox', { name: 'Nombre de la propiedad' }),
  ).toHaveValue(property.name)
  await expect(page.getByRole('dialog')).toContainText(
    'Nombre observado por el servidor.',
  )
  expect(submissions).toBe(1)
  await page
    .getByRole('button', { name: 'Crear propiedad', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'Los datos cambiaron en el servidor.',
  )
  await expect(
    page.getByRole('textbox', { name: 'Dirección', exact: true }),
  ).toHaveValue(property.address)
  await page.getByRole('button', { name: 'Actualizar lista' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(submissions).toBe(2)
})

test('navegación móvil y teclado, sin desbordamiento de la página', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/configuracion/propiedades')
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await page.getByRole('link', { name: 'Documentos / OCR' }).click()
  await expect(
    page.getByRole('heading', { name: 'Documentos y OCR' }),
  ).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await page.getByRole('link', { name: 'Configuración', exact: true }).click()
  await page
    .getByRole('button', { name: 'Nueva propiedad', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: 'Nombre de la propiedad' }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('properties-mobile.png'),
    fullPage: true,
  })
})

test('recupera opciones posteriores a la primera página del catálogo', async ({
  page,
  request,
}) => {
  const prefix = `Opciones ${unique()}`
  for (let i = 0; i < 51; i++) {
    const response = await request.post(`${api}/api/organizations`, {
      data: { name: `${prefix} ${i}` },
    })
    expect(response.status()).toBe(201)
  }
  await page.goto('/configuracion/propiedades')
  await page
    .getByRole('combobox', { name: 'Organización', exact: true })
    .fill(prefix)
  await expect(page.getByRole('option')).toHaveCount(50)
  const nextPage = page.waitForResponse(
    (response) =>
      response.url().includes('/api/organizations?') &&
      new URL(response.url()).searchParams.get('page') === '2',
  )
  await page.getByRole('listbox').evaluate((list) => {
    list.scrollTop = list.scrollHeight
  })
  const result = await (await nextPage).json()
  await expect(page.getByRole('option')).toHaveCount(51)
  await page
    .getByRole('option', { name: result.items[0].name, exact: true })
    .click()
  await expect(page).toHaveURL(
    new RegExp(`organizationId=${result.items[0].id}`),
  )
})
