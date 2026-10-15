# Referencia de API

[Índice](README.md) · [Ejecución](RUN.md) · [Reglas de negocio](DOMAIN.md)

Base local: `https://localhost:7032`. JSON usa nombres `camelCase`, enums como cadenas `camelCase` y omite propiedades nulas. Las fechas son `DateTimeOffset`; envía ISO 8601 con zona u offset. Las rutas no requieren autenticación. Swagger y OpenAPI están habilitados en todos los entornos; su título todavía muestra el nombre del template.

## Rutas

| Método | Ruta | Entrada / resultado |
| --- | --- | --- |
| GET | `/api/version/` | `fileVersion`, `informationalVersion` |
| POST | `/api/readings/` | JSON de lectura; `201` con `id`, `value`, `status` y cabecera `Location` |
| GET | `/api/readings/{id}` | Una lectura; `404` si no existe |
| GET | `/api/readings/meter/{meterId}` | Lista por medidor |
| GET | `/api/readings/property/{propertyId}` | Lista por propiedad |
| GET | `/api/readings/billing-period/{billingPeriodId}` | Lista por período |
| POST | `/api/evidence/upload` | `multipart/form-data`, campo `file`; `201` con metadatos de carga |
| POST | `/api/evidence/attach` | JSON con `readingId`, `evidenceId`; `200` al asociar |
| GET | `/api/evidence/reading/{readingId}` | Lista de metadatos de evidencias asociadas |
| GET | `/api/reports/pending-readings` | Filtros opcionales `billingPeriodId`, `propertyId` |
| GET | `/api/reports/abnormal-readings` | Filtro opcional `billingPeriodId` |
| GET | `/api/reports/monthly-summary/{billingPeriodId}` | Resumen del período |
| GET | `/api/reports/condominiums/{condominiumId}/reconciliation/{billingPeriodId}` | Conciliación del condominio |

Los identificadores son GUID. Las listas de lecturas se ordenan por `measuredAt` descendente; no tienen paginación. No hay rutas HTTP de actualización o eliminación de lecturas, descarga de archivos ni CRUD de catálogos.

## Crear una lectura

| Campo | Tipo | Uso |
| --- | --- | --- |
| `meterId` | GUID | Identificador del medidor |
| `propertyId` | GUID o null | Asociación opcional a propiedad |
| `billingPeriodId` | GUID o null | Asociación opcional a período |
| `previousReadingId` | GUID o null | Si se omite, busca la lectura más reciente del medidor por fecha |
| `value` | decimal | Valor acumulado del medidor |
| `unit` | string | Unidad, por ejemplo `m3` o `kWh` |
| `measuredAt` | fecha con offset | Momento de medición |
| `source` | string | Predeterminado `Manual`; los reportes reconocen `Resident` y `Company` sin distinguir mayúsculas |

Ejemplo reproducible en PowerShell, con la API local encendida:

```powershell
$baseUrl = 'https://localhost:7032'
$meterId = [guid]::NewGuid().ToString()
$propertyId = [guid]::NewGuid().ToString()
$periodId = [guid]::NewGuid().ToString()
$body = @{
    meterId = $meterId
    propertyId = $propertyId
    billingPeriodId = $periodId
    value = 100
    unit = 'm3'
    measuredAt = '2026-10-01T09:00:00-03:00'
    source = 'Manual'
} | ConvertTo-Json

$reading = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/readings/" -ContentType 'application/json' -Body $body
Invoke-RestMethod "$baseUrl/api/readings/$($reading.id)"
Invoke-RestMethod "$baseUrl/api/readings/meter/$meterId"
Invoke-RestMethod "$baseUrl/api/reports/monthly-summary/$periodId"
```

Los GUID de este ejemplo sirven para agrupar lecturas: no crean entidades de catálogo. El handler no comprueba la existencia de medidor, propiedad o período.

Respuesta de creación, con un identificador ilustrativo:

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "value": 100,
  "status": "Pending"
}
```

Una lectura consultada contiene `id`, `meterId`, `propertyId`, `billingPeriodId`, `previousReadingId`, `value`, `unit`, `measuredAt`, `source`, `status`, `evidenceIds` y `alerts` (los campos nulos se omiten). No incluye un consumo calculado. Una anomalía conserva la lectura y cambia su estado a `Warning`.

## Evidencias

La carga calcula SHA-256 hexadecimal, almacena el archivo bajo `evidence/{guid}/{fileName}` y devuelve `id`, `fileName`, `storageKey`, `hash`. Los bytes quedan en memoria y los metadatos en EF Core InMemory. El hash no implica deduplicación.

Ejemplo con `curl.exe` en Windows; reemplaza la ruta del archivo:

```powershell
curl.exe -F "file=@D:/evidencias/medidor.jpg" https://localhost:7032/api/evidence/upload
```

Asocia el `id` recibido a la lectura creada:

```powershell
$evidenceId = '22222222-2222-2222-2222-222222222222' # Reemplazar por el id de la carga
$attachment = @{ readingId = $reading.id; evidenceId = $evidenceId } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/evidence/attach" -ContentType 'application/json' -Body $attachment
Invoke-RestMethod "$baseUrl/api/evidence/reading/$($reading.id)"
```

La asociación verifica ambos registros y devuelve `readingId`, `evidenceId`, `message`. Repetirla devuelve `Evidence already attached` sin duplicar el vínculo. La consulta devuelve `id`, `fileName`, `storageKey`, `contentType`, `hash`, `metadata`.

**Límite actual de la carga:** el endpoint recibe `IFormFile`, pero la aplicación no registra middleware antiforgery ni deshabilita ese requisito para esta ruta. La carga devuelve `500` antes de entrar al handler por falta de middleware antiforgery (confirmado en ejecución local). El ejemplo describe el contrato; este flujo necesita corregir esa configuración para quedar operativo. No hay validación efectiva de extensiones o tipos MIME, ni límite de tamaño propio del servicio; aplican los límites del servidor/formulario.

El `Location` de carga apunta a `/api/evidence/{id}`, pero esa ruta de consulta no está implementada. Usa la consulta por lectura después de asociar.

## Contratos de reportes

| Reporte | Campos |
| --- | --- |
| Pendientes | `readingId`, `propertyId`, `meterId`, `billingPeriodId`, `measuredAt` |
| Anómalas | `readingId`, `propertyId`, `meterId`, `billingPeriodId`, `alerts` |
| Resumen mensual | `billingPeriodId`, `readingCount`, `pendingReadingCount`, `abnormalReadingCount`, `mismatchCount`, `residentTotal`, `companyTotal`, `mismatchPercentage` |
| Conciliación | `condominiumId`, `billingPeriodId`, `mainConsumption`, `subMeterConsumption`, `difference`, `differencePercentage`, `suspects`, `explanation` |

Cada sospecha contiene `propertyId`, `propertyName`, `consumption` y `reasons`. Las fórmulas y criterios están en [Dominio](DOMAIN.md). La conciliación requiere entidades cargadas desde código; el flujo HTTP anterior no las crea.

## Validación y errores actuales

- Los errores de binding, como GUID o JSON mal formados, pueden producir `400` antes del handler.
- El filtro `[Validate]` solo ejecuta un `IValidator<T>` registrado para el tipo exacto. `GenericIdentityValidator` valida GUID no vacíos en parámetros marcados.
- Existe `CreateReadingValidator` para el comando, pero HTTP recibe `CreateReadingRequest` y no hay validator de ese request ni pipeline de validación MediatR. Sus reglas de valor no negativo, unidad y fecha obligatorias no se ejecutan automáticamente por HTTP.
- Los validators de comandos de evidencias están en Application, mientras que el escaneo de validators se hace en Presentation. Sus reglas tampoco quedan activadas por ese registro.
- Consultar una lectura inexistente o asociar una lectura/evidencia inexistente devuelve `404` con un mensaje de texto. Las listas sin coincidencias devuelven `[]`.
- Crear una lectura con `previousReadingId` inexistente termina en `500`: la creación captura la excepción sin mapearla a `404`.
- Los endpoints de lecturas, evidencias y versión capturan errores y construyen `ProblemDetails`, incluyendo mensaje y stack trace. Los reportes no tienen esa traducción local; un condominio inexistente lanza `KeyNotFoundException` y no se transforma explícitamente en `404`.

La especificación OpenAPI anuncia algunos códigos de error deseados; no todos están garantizados por la implementación actual. Para diagnóstico consulta [Operación](OPERATIONS.md).
