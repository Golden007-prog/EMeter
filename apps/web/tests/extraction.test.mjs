import test from 'node:test'
import assert from 'node:assert/strict'
import { extractedBillSchema } from '../src/features/documents/extractionContracts.ts'

test('OCR anterior conserva fields y obtiene defaults del contrato v1', () => {
  const result = extractedBillSchema.parse({
    text: 'Lectura actual: 10 m3',
    fields: { currentReading: '10' },
    confidence: null,
    engine: 'pdf-text',
  })

  assert.equal(result.schemaVersion, 1)
  assert.equal(result.fields.currentReading, '10')
  assert.deepEqual(result.metadata, {})
  assert.deepEqual(result.artifacts, [])
})

test('OCR v2 conserva metadata, candidatos, cargos y artefactos', () => {
  const result = extractedBillSchema.parse({
    text: 'CGE',
    fields: { currentReading: '3746' },
    confidence: null,
    engine: 'pdf-text',
    schemaVersion: 2,
    document: {
      type: 'utilityBill',
      provider: 'CGE',
      pageCount: 3,
      documentNumber: '497629545',
    },
    proposals: {
      currentReading: [
        {
          value: '3746',
          rawValue: '3.746',
          dataType: 'decimal',
          source: 'provider:CGE',
          page: 2,
          unit: 'kWh',
          confidence: null,
        },
      ],
    },
    metadata: { meterNumber: '220220253' },
    readings: [],
    charges: [
      {
        description: 'Electricidad consumida',
        amount: '71874',
        currency: 'CLP',
        category: 'consumedElectricity',
        page: 2,
      },
    ],
    artifacts: [
      {
        type: 'qr',
        format: 'QR Code',
        value: 'https://example.test',
        title: 'Código detectado',
        page: 1,
        status: 'decoded',
      },
    ],
    warnings: [],
  })

  assert.equal(result.document.provider, 'CGE')
  assert.equal(result.proposals.currentReading[0].page, 2)
  assert.equal(result.metadata.meterNumber, '220220253')
  assert.equal(result.charges[0].amount, '71874')
  assert.equal(result.artifacts[0].type, 'qr')
})
