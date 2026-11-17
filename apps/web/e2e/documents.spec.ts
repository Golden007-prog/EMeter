import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { test, expect } from './support/fixtures'
import { api, post, seed, selectOption } from './support/domain'

const exec = promisify(execFile)
async function compose(...args: string[]) {
  const project = process.env.E2E_COMPOSE_PROJECT ?? ''
  if (
    !/^utilitymeter-e2e-[a-f0-9]{8}$/.test(project) ||
    api !== 'http://127.0.0.1:18081'
  )
    throw new Error(
      'Esta operación solo admite el stack desechable del harness.',
    )
  await exec(
    'docker',
    [
      'compose',
      '-p',
      project,
      '-f',
      path.resolve('../api/docker-compose.yml'),
      '-f',
      path.resolve('e2e/compose.override.yml'),
      ...args,
    ],
    { windowsHide: true, timeout: 120_000 },
  )
}
function samplePdf() {
  const stream =
    'BT /F1 16 Tf 50 750 Td (Lectura actual: 12400.50 m3) Tj 0 -30 Td (Lectura anterior: 12345.50 m3) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let result = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(result))
    result += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = Buffer.byteLength(result)
  result += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join(
      '',
    )}trailer << /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(result)
}

test('OCR real: subir, recuperar bandeja, confirmar, adjuntar, descargar y persistir', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)
  const { name, meter, period } = await seed(request)
  await post(request, 'readings', {
    meterId: meter.id,
    value: 12345.5,
    unit: 'm3',
    source: 'Company',
    measuredAt: '2026-09-30T12:00:00-03:00',
  })
  const fileName = `boleta-${name}.pdf`
  const original = samplePdf()
  await page.goto(`/documentos?billingPeriodId=${period.id}`)
  const uploadResponse = page.waitForResponse((r) =>
    r.url().endsWith('/api/evidence/upload'),
  )
  await page.locator('input[type=file]').setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer: original,
  })
  const upload = await uploadResponse
  expect(upload.status()).toBe(202)
  const job = await upload.json()
  await expect(page).toHaveURL(new RegExp(`/documentos/${job.extractionId}`))
  expect(new URL(page.url()).searchParams.get('billingPeriodId')).toBe(
    period.id,
  )
  await expect(
    page.getByRole('heading', { name: 'Valores revisados' }),
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    page.getByText('Contrato OCR v2', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Campos propuestos' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Lecturas encontradas' }),
  ).toBeVisible()
  await page.goto('/documentos')
  await page.getByRole('link', { name: fileName }).click()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Valores revisados' }),
  ).toBeVisible()
  await selectOption(page, 'Medidor', name)
  await page.goto(
    `/documentos/${job.extractionId}?billingPeriodId=${period.id}`,
  )
  await selectOption(page, 'Medidor', name)
  await page
    .getByRole('textbox', { name: 'Lectura acumulada revisada' })
    .fill('12400,50')
  await page.getByLabel('Fecha y hora medida revisada').fill('2026-10-05T12:00')
  const confirmResponse = page.waitForResponse((r) =>
    r.url().endsWith(`/api/extractions/${job.extractionId}/confirm`),
  )
  await page
    .getByRole('button', { name: 'Confirmar valores y crear lectura' })
    .click()
  const confirmed = await (await confirmResponse).json()
  await expect(page).toHaveURL(new RegExp(`/lecturas/${confirmed.readingId}`))
  expect(new URL(page.url()).searchParams.get('billingPeriodId')).toBe(
    period.id,
  )
  await expect(
    page.getByRole('button', { name: `${fileName} · Ver y descargar` }),
  ).toBeVisible()
  const repeat = await post(
    request,
    `extractions/${job.extractionId}/confirm`,
    {
      meterId: meter.id,
      value: 12400.5,
      unit: 'm3',
      source: 'Company',
      measuredAt: '2026-10-05T12:00:00-03:00',
      billingPeriodId: period.id,
    },
  )
  expect(repeat.readingId).toBe(confirmed.readingId)
  await page.getByRole('button', { name: 'Adjuntar evidencia' }).click()
  await page.getByRole('combobox', { name: 'Original disponible' }).click()
  await page.getByRole('option').filter({ hasText: fileName }).click()
  await page
    .getByRole('button', { name: 'Adjuntar original seleccionado' })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    await (
      await request.get(`${api}/api/evidence/reading/${confirmed.readingId}`)
    ).json(),
  ).toHaveLength(1)
  await page
    .getByRole('button', { name: `${fileName} · Ver y descargar` })
    .click()
  const download = page.waitForEvent(
    'download',
    (download) => download.suggestedFilename() === fileName,
  )
  await page.getByRole('button', { name: 'Descargar original' }).click()
  expect((await download).suggestedFilename()).toBe(fileName)
  const bytes = await (
    await request.get(`${api}/api/evidence/${job.id}/download`)
  ).body()
  expect(bytes.equals(original)).toBeTruthy()
  await page.screenshot({
    path: test.info().outputPath('ocr-original.png'),
    fullPage: true,
  })
  await compose('restart', 'api', 'worker', 'postgres', 'minio', 'ocr')
  await compose('up', '-d', '--wait', '--wait-timeout', '90')
  await page.goto(`/lecturas/${confirmed.readingId}`)
  await expect(
    page.getByRole('button', { name: `${fileName} · Ver y descargar` }),
  ).toBeVisible({ timeout: 30_000 })
  expect(
    (
      await (
        await request.get(`${api}/api/extractions/${job.extractionId}`)
      ).json()
    ).confirmedReadingId,
  ).toBe(confirmed.readingId)
  expect(
    (
      await (await request.get(`${api}/api/evidence/${job.id}/download`)).body()
    ).equals(original),
  ).toBeTruthy()
})

test('OCR Failed real se reencola tras recuperar el servicio sin subir nuevamente', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)
  await compose('stop', 'ocr')
  let id = ''
  try {
    await page.goto('/documentos')
    const uploaded = page.waitForResponse((r) =>
      r.url().endsWith('/api/evidence/upload'),
    )
    await page.locator('input[type=file]').setInputFiles({
      name: 'recuperable.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdf(),
    })
    id = (await (await uploaded).json()).extractionId
    await expect
      .poll(
        async () =>
          (await (await request.get(`${api}/api/extractions/${id}`)).json())
            .status,
        { timeout: 100_000, intervals: [2000] },
      )
      .toBe('Failed')
  } finally {
    await compose('up', '-d', '--wait', 'ocr')
  }
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Reintentar extracción' }),
  ).toBeVisible()
  let uploads = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/api/evidence/upload')) uploads++
  })
  await page.getByRole('button', { name: 'Reintentar extracción' }).click()
  await expect(
    page.getByRole('heading', { name: 'Valores revisados' }),
  ).toBeVisible({ timeout: 60_000 })
  expect(uploads).toBe(0)
})

test('OCR de imágenes PNG y JPEG reales y rechazo de archivo inválido', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  for (const type of ['png', 'jpeg'] as const) {
    await page.setContent(
      '<html lang="es"><body style="background:white;color:black;font:32px Arial;padding:40px"><p>Lectura actual: 12400.50 m3</p><p>Lectura anterior: 12345.50 m3</p></body></html>',
    )
    const buffer = await page.screenshot({ type })
    await page.goto('/documentos')
    const uploadResponse = page.waitForResponse((r) =>
      r.url().endsWith('/api/evidence/upload'),
    )
    await page.locator('input[type=file]').setInputFiles({
      name: `imagen.${type}`,
      mimeType: `image/${type}`,
      buffer,
    })
    const job = await (await uploadResponse).json()
    await expect(
      page.getByRole('heading', { name: 'Valores revisados' }),
    ).toBeVisible({ timeout: 60_000 })
    const status = await (
      await request.get(`${api}/api/extractions/${job.extractionId}`)
    ).json()
    expect(status.result.text.trim().length).toBeGreaterThan(0)
  }
  await page.goto('/documentos')
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalido.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('no es un PDF'),
  })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/documentos$/)
})
