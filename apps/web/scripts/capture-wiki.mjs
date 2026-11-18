/**
 * Captura la interfaz para la wiki del proyecto.
 *
 * Uso (desde apps/web, con el cliente y la API en ejecución):
 *   node scripts/capture-wiki.mjs --base http://127.0.0.1:5173 \
 *     --period <billingPeriodId> --condominium <id> --reading <id>
 *
 * Escribe PNG en ../../docs/wiki/images y no modifica datos: sólo navega y fotografía.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = resolve(here, '../../../docs/wiki/images')

const args = process.argv.slice(2)
function arg(name, fallback = '') {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const base = arg('base', 'http://127.0.0.1:5173').replace(/\/$/, '')
const period = arg('period')
const condominium = arg('condominium')
const condominiumName = arg('condominium-name')
const reading = arg('reading')
const query = period ? `?billingPeriodId=${period}` : ''

const shots = [
  {
    file: 'periodo.png',
    url: `${base}/periodo${query}`,
    heading: /per[ií]odo/i,
  },
  {
    file: 'lecturas.png',
    url: `${base}/lecturas${query}`,
    heading: /lectura/i,
  },
  ...(reading
    ? [
        {
          file: 'lectura-detalle.png',
          url: `${base}/lecturas/${reading}${query}`,
          heading: /lectura/i,
        },
      ]
    : []),
  {
    file: 'reportes.png',
    url: `${base}/reportes${query}`,
    heading: /reporte/i,
    // La conciliación sólo aparece al elegir un condominio con medidor principal.
    selectCondominium: condominiumName || undefined,
  },
  {
    file: 'configuracion-propiedades.png',
    url: `${base}/configuracion/propiedades`,
    heading: /propiedad/i,
  },
  ...(condominium
    ? [
        {
          file: 'configuracion-condominio.png',
          url: `${base}/configuracion/condominios/${condominium}`,
          heading: /condominio/i,
        },
      ]
    : []),
  {
    file: 'documentos.png',
    url: `${base}/documentos${query}`,
    heading: /documento/i,
  },
]

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'es-CL',
  timezoneId: 'America/Santiago',
  colorScheme: 'light',
})
const page = await context.newPage()

for (const shot of shots) {
  try {
    await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 45_000 })
    await page.getByRole('heading', { name: shot.heading }).first().waitFor({ timeout: 20_000 })
    if (shot.selectCondominium) {
      const combo = page.getByRole('combobox', { name: /condominio/i }).first()
      await combo.click()
      await page.getByRole('option', { name: new RegExp(shot.selectCondominium, 'i') }).first().click()
      await page.getByText(/Diferencia/i).first().waitFor({ timeout: 20_000 })
    }
    // Sin foco ni scroll residual, y con la altura del contenido como viewport, la barra
    // lateral fija no queda flotando a mitad de la captura.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      window.scrollTo(0, 0)
    })
    // Con la página arriba y sin foco, la barra lateral fija se compone bien en fullPage.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${outputDir}/${shot.file}`, fullPage: true })
    console.log(`ok   ${shot.file}  ${await page.title()}`)
  } catch (error) {
    console.error(`fallo ${shot.file}: ${String(error).split('\n')[0]}`)
  }
}

await browser.close()
