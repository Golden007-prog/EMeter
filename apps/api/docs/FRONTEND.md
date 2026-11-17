# Base funcional para React

El alcance acordado es un prototipo local de un solo usuario, sin autenticación. El frontend y su harness viven en el repositorio separado `D:\coding\UtilityMeterWeb`: React + TypeScript + Vite, React Router, TanStack Query, React Hook Form + Zod y Material UI. Este repositorio, `D:\coding\UtilityMeter`, contiene el backend. La web se organiza por funcionalidades, sin replicar las capas del backend.

## Primera entrega implementada

- Layout adaptable con barra lateral y rutas para resumen del período, lecturas, documentos/OCR, reportes y configuración. Solo Configuración → Propiedades conecta recorridos funcionales; las demás secciones indican su implementación pendiente.
- Lista de propiedades con paginación de servidor, búsqueda y filtros de organización/condominio en URL. Estados de carga, error con reintento y vacío.
- Creación de propiedades independientes o asociadas: nombre, dirección, recurso y pertenencias opcionales; selectores por nombre con paginación explícita. Invalidación y consulta de la lista tras crear.
- Cliente HTTP configurable con `VITE_API_BASE_URL`, contratos JSON validados y manejo de ProblemDetails. Los formularios conservan valores ante errores, incluidos conflictos 409. La creación de propiedad no requiere versión, motivo ni requestId.
- Etiquetas y mensajes en español, foco en errores, navegación por teclado y menú móvil. `billingPeriodId`, si está en la URL, se conserva entre secciones; la selección de período no se implementa aún.

Instalación, ejecución, decisiones y recorrido de validación: [UtilityMeterWeb/README.md](../../UtilityMeterWeb/README.md). Desde `D:\coding\UtilityMeterWeb`, `npm run build` comprueba TypeScript y genera `dist/`; `npm run test:e2e` ejecuta Chromium contra una API real aislada en memoria. No requiere PostgreSQL, MinIO ni OCR.

El [harness E2E de UtilityMeterWeb](../../UtilityMeterWeb/e2e/README.md) también permite verificar el backend ya iniciado: `npm run test:e2e:live` usa solo lectura; `npm run test:e2e:live:write` habilita una propiedad sintética persistente. Guarda evidencia por corrida dentro del repositorio web y separa el build de pruebas del build normal. Se revisaron los contratos y no se requieren cambios adicionales del backend para lista y creación de propiedades.

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

La primera entrega React verifica desde Chromium la creación independiente/asociada, paginación, filtros, recarga, navegación, validación y recuperación de errores. Los recorridos de lecturas, OCR, reportes y cierre todavía requieren implementación y pruebas de navegador. La precisión OCR con boletas reales requiere evaluación aparte.
