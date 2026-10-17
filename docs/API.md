# API

Swagger y OpenAPI describen los contratos en ejecución: `/swagger` y `/openapi/v1.json`. JSON usa camelCase; fechas ISO 8601 con offset. Los instantes se guardan en UTC. No hay autenticación en este prototipo local.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/version/` | Versión |
| POST | `/api/readings/` | Crea lectura manual, 201 |
| GET | `/api/readings/{id}` | Lectura y alertas |
| GET | `/api/readings/meter/{meterId}` | Historial |
| GET | `/api/readings/property/{propertyId}` | Lecturas por propiedad |
| GET | `/api/readings/billing-period/{billingPeriodId}` | Lecturas por período |
| POST | `/api/evidence/upload` | Multipart file, 202 y Location del trabajo |
| POST | `/api/evidence/attach` | readingId y evidenceId |
| GET | `/api/evidence/reading/{readingId}` | Metadatos asociados |
| GET | `/api/evidence/{id}/download` | Original |
| GET | `/api/extractions/{id}` | Estado, texto y campos propuestos |
| POST | `/api/extractions/{id}/confirm` | Confirma valores revisados, crea lectura una sola vez |
| POST / GET | `/api/organizations` | Crear / listar |
| POST / GET | `/api/condominiums` | Crear / listar |
| POST / GET | `/api/properties` | Crear / listar |
| POST / GET | `/api/meters` | Crear / listar |
| POST / GET | `/api/billing-periods` | Crear / listar |
| PUT | `/api/condominiums/{id}/main-meter/{meterId}` | Asigna principal |
| PUT | `/api/billing-periods/{id}/status/{status}` | Cambia estado; Closed es inmutable |
| GET | `/api/reports/pending-readings` | Lecturas existentes pendientes |
| GET | `/api/reports/missing-readings/{billingPeriodId}` | Medidores conocidos sin lectura |
| GET | `/api/reports/abnormal-readings` | Lecturas con alertas |
| GET | `/api/reports/monthly-summary/{billingPeriodId}` | Consumos derivados por origen |
| GET | `/api/reports/condominiums/{condominiumId}/reconciliation/{billingPeriodId}` | Conciliación |

Lectura manual: `meterId`, `propertyId?`, `billingPeriodId?`, `previousReadingId?`, `value`, `unit`, `measuredAt`, `source` (Manual por defecto). Valida medidor existente, unidad y propiedad; si hay período debe existir, estar abierto y contener la fecha. Las lecturas de un mismo origen se ingresan cronológicamente y enlazan solo al mismo origen. Valor negativo, fecha vacía o unidad vacía devuelven 400. Una disminución de lectura genera advertencia, conservando la medición.

Las listas de catálogos tienen un máximo de 1000; no hay paginación ni borrado/edición general. Las listas de lecturas no están paginadas. Las referencias inexistentes devuelven 404 y los conflictos de estado 409. La extracción solo acepta JPEG/PNG/PDF con firma coincidente y máximo 20 MiB; no implica deduplicación.

Ejemplos detallados, campos de OCR, estados y confirmación en [OCR](OCR.md). El script `scripts/smoke.py` contiene una secuencia HTTP reproducible.
