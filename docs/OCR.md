# Boletas y procesamiento local

El prototipo ejecuta API y Worker .NET, PostgreSQL, MinIO, Seq y un servicio OCR local en Python. No requiere Azure ni Google. El original permanece en MinIO; PostgreSQL guarda lecturas, referencias, SHA-256, trabajos y resultados de extracción. Los volúmenes de Compose conservan los datos al recrear contenedores.

## Ejecutar

```powershell
docker compose up -d --build
```

Swagger: http://localhost:8080/swagger. MinIO: http://localhost:9001. Seq: http://localhost:5341. Las credenciales locales y sus variables están en `.env.example`; copia a `.env` para cambiarlas antes del primer arranque. Cambiar la contraseña de PostgreSQL después de inicializar su volumen requiere cambiarla también dentro del servidor.

El primer build descarga dependencias y construye MinIO desde código comunitario fijado (la imagen histórica ya no está disponible). PaddleOCR descarga modelos al primer uso de imágenes y los conserva en `ocr-models`. Necesita conexión para esa primera descarga. El resto del procesamiento se ejecuta localmente. Para usar Tesseract en CPU, sin descargar modelos Paddle, establece `OCR_ENGINE=tesseract` en `.env` y recrea `ocr`.

## Flujo HTTP

1. Crea organización y condominio opcionales, propiedad y medidor mediante los POST de catálogos en Swagger. Crea un período si lo necesitas. Sus GET devuelven hasta 1000 registros. PUT permite asignar medidor principal y cambiar estado de período; un período cerrado no admite nuevas lecturas.
2. `POST /api/evidence/upload` con multipart `file` (JPEG, PNG o PDF, máximo 20 MiB). Responde **202** con `id`, `extractionId`, `status`, `fileName`, `storageKey`, `hash` y `Location: /api/extractions/{extractionId}`. La carga del archivo termina dentro de la petición; el OCR corre después.
3. `GET /api/extractions/{id}` devuelve `Queued`, `Processing`, `NeedsReview`, `Failed` o `Confirmed`. `result` contiene `text`, `fields`, `confidence` y `engine`. El valor de confianza es del reconocimiento de texto, no una probabilidad de corrección de los campos; puede ser nulo.
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

La interfaz `IMeterReadingExtractor` permite cambiar motor. El adaptador .NET llama al endpoint interno `/extract`. Un PDF con texto utilizable se lee directamente; páginas sin texto suficiente se renderizan para OCR. Se limita a 10 páginas por PDF y 25 megapíxeles por imagen. El servicio no está publicado hacia el host en Compose.

La selección de proveedor reconoce nombres de empresas chilenas. Las propuestas usan etiquetas explícitas comunes en español y separadores chilenos: lectura anterior/actual, consumo, unidad, cliente, folio, total, deuda previa, emisión, vencimiento y período. Coincidencias contradictorias se omiten. No hay plantillas entrenadas o calibradas por proveedor: son reglas iniciales y requieren evaluación con documentos reales. No se afirma una precisión para boletas chilenas. Fotografías torcidas, tablas complejas y diseños distintos pueden necesitar corrección manual o nuevos extractores.

Nunca se crean lecturas automáticamente a partir del OCR. Los resultados originales permanecen en el trabajo aunque el usuario confirme valores corregidos. Importes y deuda son información extraída; no se generan cobros ni prorrateos.

## Durabilidad y fallos

Evidencia y trabajo se insertan en una misma operación `SaveChanges` transaccional de PostgreSQL. Si falla el registro después de subir el objeto, se intenta eliminarlo. Una interrupción del proceso entre ambas operaciones aún puede dejar un objeto huérfano: no existe transacción distribuida.

La adquisición usa `UPDATE ... FOR UPDATE SKIP LOCKED`. Cada intento recibe token y lease de 10 minutos; los resultados de tokens anteriores no pueden sobrescribir el actual. Hay hasta 3 intentos con espera incremental; los trabajos abandonados se recuperan al vencer su lease. Tras el límite quedan `Failed`, con error consultable. No hay endpoint de reintento manual todavía.

La confirmación bloquea el trabajo, crea lectura, asocia evidencia y marca `Confirmed` en una transacción. No se deben ejecutar procesos API con proveedores de almacenamiento o bases diferentes de los del Worker.

## Comprobar

```powershell
dotnet test CleanMinimalApi.sln
python -m unittest discover -s services/ocr -v
python scripts/smoke.py --base http://localhost:8080
```

Los tests de integración de cola usan Docker y un PostgreSQL aislado con Testcontainers. El smoke crea datos de prueba nuevos, sube un PDF sintético con texto, consulta estado, confirma dos veces, compara descarga y comprueba consumo. `--image ruta.jpg` prueba además OCR de una imagen. No envía documentos a servicios cloud.

Fuentes: [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), [Tesseract](https://github.com/tesseract-ocr/tesseract), [MinIO comunitario](https://github.com/minio/minio). Revisa las licencias de las dependencias al distribuir el conjunto; MinIO comunitario usa AGPLv3.
