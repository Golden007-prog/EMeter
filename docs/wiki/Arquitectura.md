# Arquitectura

## Monorepo

```text
apps/api   .NET 10: Application, Infrastructure, Presentation, Worker y services/ocr (Python)
apps/web   React 19 + TypeScript + Vite + MUI + TanStack Query y harness Playwright
docs/      producto, brechas, roadmap, arquitectura, ADR y backlog versionado
```

El historial de ambos proyectos se conservó al importarlos con `git subtree`.
Decisión: [ADR 0001](https://github.com/cbinput/EMeter/blob/main/docs/decisions/0001-monorepo.md).

## Flujo actual

1. El cliente sube la boleta a la API (JPEG/PNG/PDF, hasta 20 MiB).
2. La API guarda el original en MinIO y encola un trabajo durable en PostgreSQL, en la misma
   transacción.
3. El Worker toma el trabajo con lease, extrae texto con PaddleOCR/Tesseract y lo pasa a un
   parser de proveedor.
4. El resultado queda en JSONB como **propuestas**, con página, origen y candidatos en conflicto.
5. Una persona revisa y confirma; recién entonces se crea una lectura.

## Flujo objetivo

```text
Boleta confirmada ─┐
Tarifas vigentes ──┼─► Motor de auditoría ─► Hallazgos con monto ─► Expediente ─► Reclamo
Lecturas ──────────┘
```

## Capa de dinero

Tres componentes separados dentro de `Application`, que no se escriben entre sí:

| Componente | Sabe | No sabe |
| --- | --- | --- |
| `Billing` | Boleta, cargos, moneda, totales | Qué es un consumo válido |
| `Tariffs` | Pliego vigente por proveedor, comuna y fecha | Si una boleta está mal cobrada |
| `Auditing` | Reglas que comparan facturado contra esperado | Cómo corregir la boleta |

`Auditing` lee de los otros dos y del dominio de lecturas; nunca escribe en ellos. Un hallazgo
es un hecho con fecha y versión de reglas, no un estado de la boleta.
Decisión: [ADR 0002](https://github.com/cbinput/EMeter/blob/main/docs/decisions/0002-capa-de-auditoria.md).

## Invariantes

- Consumo entre lecturas activas consecutivas del mismo medidor y origen.
- Período cerrado inmutable.
- Originales inmutables en object storage, nunca en la base.
- `requestId` para idempotencia, `expectedVersion` para concurrencia.
- Un monto sin moneda no existe; un valor desconocido no se muestra como cero.
