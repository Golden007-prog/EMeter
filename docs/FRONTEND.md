# Base funcional para React

El alcance acordado es un prototipo local de un solo usuario. Los cambios de esta entrega corresponden al backend; el frontend React todavía no está implementado.

## Flujos de interfaz

1. Configuración guiada: organización → condominio o propiedad independiente → medidor → período. Usar nombres, dirección y serie en los selectores; nunca pedir UUID. Recuperar detalles al recargar y filtrar las listas por pertenencia.
2. Trabajo del período: separar medidores sin lectura de lecturas existentes pendientes de revisión. Mostrar confirmadas y advertencias con acciones para abrir su detalle.
3. Captura manual: seleccionar origen explícitamente (Resident para el residente, Company para la empresa), medidor y período; completar unidad/propiedad, mostrar lectura previa y consumo estimado. El backend vuelve a validar y calcula el vínculo definitivo. Permitir cargar históricos.
4. Revisión de documento: original junto a campos editables; texto y propuestas OCR nunca se confirman automáticamente. Consultar la bandeja del servidor al volver a abrir la aplicación. Polling solo mientras Queued/Processing, detenerlo al salir, mostrar errores y ofrecer reintento para Failed.
5. Correcciones: cargar version, solicitar motivo y enviar expectedVersion. Ante 409, recargar y permitir revisar diferencias. Una corrección exige nueva revisión. Anular conserva el historial y las evidencias.
6. Reportes: elegir período y origen de conciliación. Mostrar unidad y estado incompleto; un null nunca debe presentarse como cero. Desde una anomalía, abrir lectura e historial.
7. Cierre: avisar que no se puede reabrir el período; bloquear controles de captura/edición y explicar los 409 que protegen sus datos.

## Integración

- Consumir el OpenAPI actualizado; los catálogos ahora son páginas con items, no arrays.
- Utilizar paginación hasta hasNextPage false y mantener filtros al navegar.
- requestId debe generarse una vez por intento de captura y conservarse al reintentar una petición fallida; generar uno nuevo para otra captura.
- Mostrar decimales con formato local, convertirlos antes de enviarlos y respetar dos decimales. Separar lectura acumulada de consumo calculado y montos de boletas.
- Manejar fechas en America/Santiago y enviar ISO 8601 con el offset correspondiente a la fecha; no asumir -03:00 durante todo el año. El API guarda UTC.
- Cargar JPEG/PNG/PDF de hasta 20 MiB; conservar los valores del formulario si falla una petición.
- Usar etiquetas de campos, navegación con teclado, foco en el primer error y estados visibles de carga/guardado. Evitar doble clic y explicar los estados vacíos.
- Mantener reviewStatus separado de status: una lectura Confirmed puede tener Warning.

## Validación

Las pruebas HTTP cubren captura tardía, edición, revisión, anulación, recuperación de la bandeja, paginación, CORS y contratos de error. PostgreSQL verifica transacciones, auditoría, recálculo de alertas, idempotencia concurrente, migración de datos y reintento OCR. El smoke prueba el stack real con PDF sintético, procesamiento OCR, confirmación repetida, descarga y consumo.

```powershell
dotnet test CleanMinimalApi.sln
python -m unittest discover -s services/ocr -v
python scripts/smoke.py --base http://localhost:8080
```

La implementación React deberá añadir la verificación de estos recorridos desde el navegador, incluida recarga, navegación y recuperación de errores. La precisión OCR con boletas reales requiere evaluación aparte.
