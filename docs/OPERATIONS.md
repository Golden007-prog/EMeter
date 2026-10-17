# Operación y límites

```powershell
docker compose ps
docker compose logs --tail 100 api worker ocr
```

Consulta `/api/extractions/{id}` para distinguir trabajos pendientes, fallos y resultados que necesitan revisión. El Worker reintenta hasta 3 veces y recupera trabajos interrumpidos al vencer su lease. Una llamada OCR tiene timeout de 5 minutos; el lease dura 10 minutos. Un trabajo Failed permanece disponible para diagnóstico y no se reintenta automáticamente de nuevo.

API y Worker publican logs en Seq y consola dentro de Compose. El endpoint `/health` de OCR comprueba que el servicio responde; no precarga ni garantiza descarga de modelos. API solo empieza a escuchar después de aplicar migraciones y preparar bucket.

Las contraseñas predeterminadas son para uso local. No hay autenticación, autorización, separación de usuarios o tenants ni auditoría de identidad del revisor. Compose publica servicios solo en localhost. El prototipo no está preparado para exposición pública directa.

La extracción usa reglas iniciales, requiere revisión y no garantiza precisión por proveedor. No hay integraciones con empresas de servicios, cálculo de tarifas, pagos o prorrateo monetario. Los originales y el resultado OCR se conservan; la confirmación crea una lectura separada.

El reporte pending-readings sigue enumerando lecturas existentes con estado Pending; no enumera medidores que no enviaron lectura. La conciliación conserva los criterios descritos en DOMAIN y no debe interpretarse como contabilidad certificada. Los catálogos no tienen edición/borrado general; sus listados llegan hasta 1000 registros.

Sin connection string se usa base en memoria, y sin Storage:Endpoint los archivos quedan en memoria. Ese modo sirve para desarrollo manual y no para el Worker durable. API y Worker necesitan la misma configuración de PostgreSQL, MinIO y bucket.

Respalda PostgreSQL y objetos de MinIO conjuntamente. No existe transacción distribuida: una interrupción justo después de almacenar el objeto puede dejarlo huérfano. El hash se calcula para trazabilidad, sin deduplicación ni política automática de retención. No elimines los volúmenes si necesitas conservar los datos.
