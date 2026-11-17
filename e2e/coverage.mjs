import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export async function reportCoverage(artifacts) {
  const contract = JSON.parse(
    await readFile(new URL('../docs/openapi/v1.json', import.meta.url), 'utf8'),
  )
  const expected = Object.entries(contract.paths)
    .flatMap(([route, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${route}`),
    )
    .sort()
  const covered = new Set()
  const testsByOperation = {}
  const results = JSON.parse(
    await readFile(path.join(artifacts, 'results.json'), 'utf8'),
  )
  async function walk(suites) {
    for (const suite of suites) {
      await walk(suite.suites ?? [])
      for (const spec of suite.specs ?? [])
        for (const test of spec.tests)
          for (const result of test.results) {
            if (result.status !== 'passed') continue
            for (const attachment of result.attachments ?? []) {
              if (attachment.name !== 'api-operations') continue
              const data = JSON.parse(
                attachment.body
                  ? Buffer.from(attachment.body, 'base64').toString('utf8')
                  : await readFile(attachment.path, 'utf8'),
              )
              for (const operation of data.operations) {
                covered.add(operation)
                testsByOperation[operation] ??= []
                testsByOperation[operation].push(
                  `${spec.file}:${spec.line} — ${spec.title}`,
                )
              }
            }
          }
    }
  }
  await walk(results.suites)
  const result = {
    total: expected.length,
    covered: expected.filter((operation) => covered.has(operation)),
    missing: expected.filter((operation) => !covered.has(operation)),
    testsByOperation,
  }
  await writeFile(
    path.join(artifacts, 'api-coverage.json'),
    JSON.stringify(result, null, 2),
  )
  console.log(
    `Operaciones con respuesta exitosa desde navegador: ${result.covered.length}/${result.total}`,
  )
  return result
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  await reportCoverage(path.resolve(process.argv[2]))
