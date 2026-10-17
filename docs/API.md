# API

Swagger y OpenAPI describen los contratos en ejecución: `/swagger` y `/openapi/v1.json`. JSON usa camelCase, los campos nulos se incluyen y las fechas usan ISO 8601 con offset. Los instantes se guardan en UTC. El alcance es local y de un solo usuario, sin autenticación.

## Catálogos

Los recursos `organizations`, `condominiums`, `properties`, `meters` y `billing-periods` comparten estas rutas:

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | `/api/{recurso}` | Crea el recurso, 201 y Location |
| GET | `/api/{recurso}` | Página de datos completos |
| GET | `/api/{recurso}/{id}` | Detalle, o 404 |
| PUT | `/api/{recurso}/{id}` | Edita metadatos o fechas, según el recurso |

Las listas devuelven `{ items, pageNumber, pageSize, totalCount, hasNextPage }`. `page` comienza en 1; `pageSize` vale 50 por defecto y admite 1 a 200. El orden por ID es estable. No se recortan silenciosamente a 1000 registros. Esta estructura reemplaza los arrays anteriores.

Filtros: `search` busca por nombre o serie sin distinguir mayúsculas; condominios admite `organizationId`; propiedades admite `organizationId` y `condominiumId`; medidores admite `propertyId` y `resourceType`; períodos admite `status`.

Los DTO específicos exponen `contactEmail`, `address`, `organizationId`, `condominiumId`, `mainMeterId`, `serialNumber`, `resourceType`, `unit`, `model`, `installedAt`, `start`, `end` y `status` donde corresponde. Se elimina la ambigüedad del antiguo `parentId`.

Cuerpos de edición:

- Organización: `{ name, contactEmail }`.
- Condominio o propiedad: `{ name, address }`.
- Medidor: `{ serialNumber, model }`.
- Período: `{ start, end }`; no puede excluir lecturas existentes ni estar cerrado.

La propiedad, el recurso y la unidad de un medidor, y las relaciones de pertenencia, se conservan al editar metadatos para no reinterpretar el historial. No hay borrado físico de catálogos.

`PUT /api/condominiums/{id}/main-meter/{meterId}` asigna un medidor de una propiedad del condominio. `PUT /api/billing-periods/{id}/status/{status}` cambia entre Open, Collecting, Validating y Closed; Closed no puede reabrirse.

## Lecturas

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | `/api/readings` | Crea lectura, 201 |
| GET | `/api/readings/{id}` | Lectura, alertas, reviewStatus y version |
| GET | `/api/readings/meter/{meterId}` | Historial, incluidos registros rechazados y anulados |
| GET | `/api/readings/property/{propertyId}` | Lecturas por propiedad |
| GET | `/api/readings/billing-period/{billingPeriodId}` | Lecturas por período |
| PUT | `/api/readings/{id}` | Corrige valor, fecha y período |
| POST | `/api/readings/{id}/review` | Confirma o rechaza |
| POST | `/api/readings/{id}/void` | Anula conservando el registro |
| GET | `/api/readings/{id}/history` | Historial paginado de cambios y recálculos |

Creación: `meterId`, `value`, `unit` y `measuredAt` son obligatorios. `propertyId`, `billingPeriodId` y `previousReadingId` son opcionales. `source` admite Manual (predeterminado), Resident, Company y OCR. `value` es acumulado, no consumo ni monto: debe ser no negativo, menor a 10^16 y tener como máximo dos decimales, de acuerdo con numeric(18,2).

El backend resuelve propiedad y lectura anterior. Si se proporciona `previousReadingId`, debe ser la inmediatamente anterior activa del mismo medidor y origen. Se permiten lecturas históricas intercaladas: se reconstruyen vínculos y alertas posteriores dentro de la misma transacción. Una disminución se conserva con advertencia.

`requestId` es un UUID opcional generado por el cliente para evitar duplicados al reintentar. El mismo ID y valores devuelve la lectura existente; reutilizarlo con otros valores devuelve 409. Otro envío del mismo medidor, origen e instante devuelve 409.

Corrección:

```json
{
  "value": 1234.5,
  "measuredAt": "2026-10-15T09:00:00-03:00",
  "billingPeriodId": null,
  "expectedVersion": 1,
  "reason": "Corrección de transcripción"
}
```

Revisión: `{ "decision": "Confirmed", "expectedVersion": 2, "reason": "Verificado con fotografía" }`. También admite Rejected. Anulación: `{ "expectedVersion": 3, "reason": "Documento duplicado" }`. La versión debe coincidir con la última respuesta; si cambió, devuelve 409. El motivo es obligatorio, hasta 1000 caracteres.

`reviewStatus` es Pending, Confirmed, Rejected o Voided. `status` muestra Warning cuando hay alertas activas, independientemente de que la lectura esté confirmada. Una corrección vuelve a Pending. Rejected y Voided no aportan a reportes ni cadenas de consumo; una anulación es definitiva. La revisión permite reincorporar una lectura rechazada si no genera un duplicado.

Cada cambio guarda fecha, acción, motivo y snapshots JSON antes/después en ReadingRevisions. Los recálculos incrementan también la versión de las lecturas afectadas. No existe identidad de revisor en el modo de un usuario. Una operación que modifique un período cerrado o recalcule una lectura cerrada se rechaza por completo. Tampoco se agregan evidencias nuevas a períodos cerrados.

## Evidencia y OCR

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | `/api/evidence/upload` | Multipart `file`, 202 y Location del trabajo |
| POST | `/api/evidence/attach` | `{ readingId, evidenceId }`, asociación idempotente |
| GET | `/api/evidence/reading/{readingId}` | Metadatos asociados |
| GET | `/api/evidence/{id}/download` | Original |
| GET | `/api/extractions` | Bandeja paginada, filtro `status` |
| GET | `/api/extractions/{id}` | Estado, texto y campos propuestos |
| POST | `/api/extractions/{id}/confirm` | Confirma valores revisados, crea lectura una sola vez |
| POST | `/api/extractions/{id}/retry` | Reencola exclusivamente un trabajo Failed |

La bandeja devuelve ID, evidenceId, nombre de archivo, estado, intentos, error, confirmedReadingId y availableAt. Permite retomar trabajos sin guardar IDs en el navegador. El reintento reinicia los intentos, limpia el error y el resultado anterior y revoca el lease previo. No vuelve a subir el original.

El cuerpo de confirmación requiere `meterId`, `value`, `unit`, `measuredAt`; admite `propertyId`, `billingPeriodId` y `source` (Company por defecto; también Resident y OCR). El ID se toma exclusivamente de la ruta. Una confirmación repetida devuelve la misma lectura. JPEG, PNG y PDF requieren firma coincidente y admiten hasta 20 MiB. Más detalles en [OCR](OCR.md).

## Reportes

- `/api/reports/pending-readings`: lecturas con reviewStatus Pending; filtros billingPeriodId y propertyId.
- `/api/reports/missing-readings/{billingPeriodId}`: medidores sin lectura activa; filtro propertyId. Los rechazados/anulados no cubren un faltante. No distingue orígenes ni mantiene historial de activación de medidores.
- `/api/reports/abnormal-readings`: alertas en lecturas activas; filtro billingPeriodId.
- `/api/reports/monthly-summary/{billingPeriodId}`: consumos por origen y unidad. `uncalculableReadingCount` informa las lecturas sin predecesor válido; `totalsBySource` incluye Manual y OCR. Los totales incompletos son nulos.
- `/api/reports/condominiums/{condominiumId}/reconciliation/{billingPeriodId}?source=Resident`: origen explícito (Resident por defecto), unidad e isComplete. Suma todos los submedidores compatibles y excluye al principal. Sin baselines válidos o con unidades incompatibles, difference y differencePercentage son nulos; el subtotal puede ser parcial y se explica en explanation.

Las listas de lecturas y reportes de pendientes/anomalías/faltantes aún son arrays completos; para el volumen de este prototipo no se truncan. No se hacen conversiones de unidades ni cobros.

## Errores e integración React

Los errores usan application/problem+json: 400 para datos inválidos o campos obligatorios ausentes, 404 para referencias ausentes, 409 para conflictos de estado/versión y 500 para errores inesperados. Los errores de validación incluyen `errors`; algunos de dominio usan la clave `request`. 413 indica archivo demasiado grande.

CORS permite por defecto `http://localhost:5173` y `http://127.0.0.1:5173`, expone Location y admite GET, POST, PUT y OPTIONS. `Cors:AllowedOrigins` reemplaza esa lista (variable de entorno `Cors__AllowedOrigins__0`, etc.). No se habilitan credenciales ni orígenes arbitrarios. También se puede servir el frontend bajo el mismo origen usando un proxy.

El cliente debe convertir la entrada decimal local a número JSON, enviar fechas con offset y mostrar los estados en español. Guía de flujos y verificaciones en [Frontend](FRONTEND.md).
