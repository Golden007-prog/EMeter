# Boletas y procesamiento local

El prototipo ejecuta API y Worker .NET, PostgreSQL, MinIO, Seq y un servicio OCR local en Python. No requiere Azure ni Google. El original permanece en MinIO; PostgreSQL guarda lecturas, referencias, SHA-256, trabajos y resultados de extracción. Los volúmenes de Compose conservan los datos al recrear contenedores.

## Ejecutar

```powershell
docker compose up -d --build
```

Swagger: http://localhost:8080/swagger. MinIO: http://localhost:9001. Seq: http://localhost:5341. Las credenciales locales y sus variables están en `.env.example`; copia a `.env` para cambiarlas antes del primer arranque. Cambiar la contraseña de PostgreSQL después de inicializar su volumen requiere cambiarla también dentro del servidor.

El primer build descarga dependencias y construye MinIO desde código comunitario fijado (la imagen histórica ya no está disponible). PaddleOCR descarga modelos al primer uso de imágenes y los conserva en `ocr-models`. Necesita conexión para esa primera descarga. El resto del procesamiento se ejecuta localmente. Para usar Tesseract en CPU, sin descargar modelos Paddle, establece `OCR_ENGINE=tesseract` en `.env` y recrea `ocr`.

## Flujo HTTP

1. Crea organización y condominio opcionales, propiedad y medidor mediante los POST de catálogos en Swagger. Crea un período si lo necesitas. Sus GET devuelven páginas con items, pageNumber, pageSize, totalCount y hasNextPage; hay filtros y consultas de detalle. PUT permite asignar medidor principal y cambiar estado de período; un período cerrado no admite nuevas lecturas.
2. `POST /api/evidence/upload` con multipart `file` (JPEG, PNG o PDF, máximo 20 MiB). Responde **202** con `id`, `extractionId`, `status`, `fileName`, `storageKey`, `hash` y `Location: /api/extractions/{extractionId}`. La carga del archivo termina dentro de la petición; el OCR corre después.
3. `GET /api/extractions/{id}` devuelve `Queued`, `Processing`, `NeedsReview`, `Failed` o `Confirmed`. `result` conserva `text`, `fields`, `confidence` y `engine`, y agrega un contrato versionado con `document`, `proposals`, `metadata`, `readings`, `charges`, `artifacts` y `warnings`. `fields` sigue siendo el mapa plano compatible y omite valores contradictorios; los candidatos no se pierden y quedan en `proposals` con origen y página. El valor de confianza es del reconocimiento de texto, no una probabilidad de corrección de los campos; puede ser nulo.
4. Revisa y corrige los valores. `POST /api/extractions/{id}/confirm` crea la lectura y la asocia al original. Confirmaciones repetidas o concurrentes devuelven el mismo `readingId`. La lectura queda `Confirmed`, o `Warning` si las reglas detectaron anomalías.
5. `GET /api/evidence/{evidenceId}/download` descarga el original. También puedes asociar evidencia a una lectura manual con `/api/evidence/attach`.

Ejemplo de confirmación; reemplaza los GUID y los valores por los revisados:

```json
{
  "meterId": "11111111-1111-1111-1111-111111111111",
  "propertyId": null,
  "billingPeriodId": null,
  "value": 12400.5,
  "unit": "kWh",
  "measuredAt": "2026-10-01T09:00:00-03:00",
  "source": "Company"
}
```

`value` es la lectura acumulada actual, nunca el total a pagar ni el consumo. El consumo se deriva de otra lectura previa del mismo medidor, unidad y origen. Se admiten `Company`, `Resident` u `OCR` al confirmar. La fecha no se deduce automáticamente del vencimiento.

## Extracción

La interfaz `IMeterReadingExtractor` permite cambiar motor. El adaptador .NET llama al endpoint interno `/extract`. Un PDF con texto utilizable se lee directamente; páginas sin texto suficiente se renderizan para OCR. Todas las páginas se renderizan de manera acotada para detectar QR, PDF417 y códigos de barras con ZXing; el fallo de esa detección se informa como advertencia y no descarta el texto utilizable. Se limita a 10 páginas por PDF y 25 megapíxeles por imagen. El servicio no está publicado hacia el host en Compose.

La selección de proveedor reconoce nombres de empresas chilenas. `CommonBillParser` propone el esquema compartido y cada implementación de `ProviderParser` vive en su propio módulo bajo `bill_providers/`; el registro solo selecciona implementaciones. `bill_providers/cge.py` extrae además dirección de suministro, sector y tarifa, potencia, ruta, medidor, propiedad, constante, próxima lectura, último pago, comparaciones, detalle de cargos y artefactos reconocibles. Los providers sin implementación propia usan por ahora las reglas comunes de español y separadores chilenos: lectura anterior/actual, consumo, unidad, cliente, folio, total, deuda previa, emisión, vencimiento y período. Las coincidencias contradictorias se omiten únicamente de `fields`, pero se conservan en `proposals` y producen una advertencia.

Los artefactos separan detección de interpretación. Un QR, PDF417 o código de barras decodificado incluye formato, contenido y página. Un gráfico puede quedar con estado `detected` sin serie numérica cuando el PDF no expone los puntos con evidencia suficiente; el servicio no inventa valores desde la apariencia del gráfico. No hay modelos entrenados ni precisión afirmada para boletas chilenas. Las reglas requieren evaluación con documentos reales; fotografías torcidas, tablas complejas y diseños distintos pueden necesitar corrección manual o nuevos extractores.

Nunca se crean lecturas automáticamente a partir del OCR. Los resultados originales permanecen en el trabajo aunque el usuario confirme valores corregidos. Importes y deuda son información extraída; no se generan cobros ni prorrateos.

## Durabilidad y fallos

Evidencia y trabajo se insertan en una misma operación `SaveChanges` transaccional de PostgreSQL. Si falla el registro después de subir el objeto, se intenta eliminarlo. Una interrupción del proceso entre ambas operaciones aún puede dejar un objeto huérfano: no existe transacción distribuida.

La adquisición usa `UPDATE ... FOR UPDATE SKIP LOCKED`. Cada intento recibe token y lease de 10 minutos; los resultados de tokens anteriores no pueden sobrescribir el actual. Hay hasta 3 intentos con espera incremental; los trabajos abandonados se recuperan al vencer su lease. Tras el límite quedan `Failed`, con error consultable. GET /api/extractions recupera la bandeja por estado. POST /api/extractions/{id}/retry reencola exclusivamente un trabajo Failed, reinicia sus intentos y revoca el lease anterior sin subir nuevamente el original.

La confirmación bloquea el trabajo, crea lectura, asocia evidencia y marca `Confirmed` en una transacción. No se deben ejecutar procesos API con proveedores de almacenamiento o bases diferentes de los del Worker.

## Comprobar

```powershell
dotnet test CleanMinimalApi.sln
python -m unittest discover -s services/ocr -v
python scripts/smoke.py --base http://localhost:8080
```

Los tests de integración de cola usan Docker y un PostgreSQL aislado con Testcontainers. El smoke crea datos de prueba nuevos, sube un PDF sintético con texto, consulta estado, confirma dos veces, compara descarga y comprueba consumo. `--image ruta.jpg` prueba además OCR de una imagen. No envía documentos a servicios cloud.

Fuentes: [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), [Tesseract](https://github.com/tesseract-ocr/tesseract), [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp), [MinIO comunitario](https://github.com/minio/minio). Revisa las licencias de las dependencias al distribuir el conjunto; MinIO comunitario usa AGPLv3.
