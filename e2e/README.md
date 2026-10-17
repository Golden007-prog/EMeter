# Harness E2E de UtilityMeter

Ejecutar desde `D:\coding\UtilityMeterWeb`. Requiere `npm ci`, Chromium (`npx playwright install chromium`) y el puerto 5173 libre. Los comandos no reutilizan ni detienen servidores ajenos. El harness y sus artefactos viven en este repositorio web; la API se mantiene en el repositorio separado `D:\coding\UtilityMeter`.

## Modos

```powershell
# Suite completa: inicia una API efímera en memoria en 18080.
# Requiere .NET 10; no requiere Docker ni modifica la API de 8080.
npm run test:e2e

# API que ya está corriendo en http://localhost:8080.
# Solo consulta: no crea ni cambia registros.
npm run test:e2e:live

# Mismo backend, incluyendo creación real de UNA propiedad [E2E].
# Es intencionalmente persistente: no existe DELETE de catálogos.
npm run test:e2e:live:write
```

Para otra URL local o selección de pruebas:

```powershell
node e2e/harness.mjs --mode live --api http://localhost:5032
node e2e/harness.mjs --mode live --api http://localhost:8080 --write
node e2e/harness.mjs --mode isolated --grep "conserva campos"
node e2e/harness.mjs --mode live --headed
node e2e/harness.mjs --mode isolated --ui
node e2e/harness.mjs --help
```

`--headed` abre un navegador visible; `--ui` abre la interfaz interactiva de Playwright. Sin esas opciones se usa Chromium sin ventana. `E2E_API_URL` también admite configurar el backend de live. El modo aislado siempre usa su API temporal, independientemente de esa variable. El modo live solo admite direcciones localhost HTTP/HTTPS y verifica salud y CORS para `http://127.0.0.1:5173` antes de iniciar las pruebas.

Cada modo comprueba TypeScript del frontend y las pruebas, y compila con su URL de API en `.e2e-dist/`. El build normal de `dist/` conserva su configuración. El harness inicia y detiene únicamente su frontend y, en modo aislado, su API.

El modo aislado espera el proyecto `../UtilityMeter/src/Presentation`, relativo a la raíz de UtilityMeterWeb. Live solo requiere una API iniciada y no depende del código fuente del backend.

## Cobertura

| Suite              | Verifica                                                                                                                                                                                        | Datos                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Aislada            | Creación independiente y asociada, contrato JSON, recarga, paginación y filtros, catálogos con más de 50 opciones, carga/error/vacío, errores de campo, 409, doble envío y navegación móvil     | Datos efímeros; 400/409 simulados para verificar recuperación de UI                   |
| Live               | Salud, OpenAPI, páginas reales de propiedades/organizaciones/condominios, errores reales 400 y 404, preflight CORS, directorio, búsqueda, recarga, navegación y validación del formulario móvil | Solo GET/OPTIONS; el formulario inválido no envía POST                                |
| Live con `--write` | Lo anterior y POST desde el navegador, 201 + Location, actualización de lista, recarga y consulta de detalle                                                                                    | Una propiedad independiente `[E2E] Propiedad <runId>`; no cambia registros existentes |

Sin `--write`, la prueba de creación live se muestra omitida explícitamente. No se ejecuta la siembra masiva de la suite aislada contra el backend activo. No hay endpoints de reset ni acceso directo a la base de datos.

## Evidencia y diagnóstico

Cada corrida crea `e2e/artifacts/<modo>-<fecha UTC>-<id>/` y muestra su ruta al terminar:

- `run.json`: modo, URL, fechas, resultado, conteos y registros creados cuando corresponde.
- `results.json`: detalle procesable de las pruebas.
- `report/index.html`: reporte HTML con capturas y adjuntos.
- `tests/`: capturas, trazas, videos de fallos y `created-record.json` si hubo creación.
- `created-records.json`: ID, nombre y URL de la propiedad creada en live. Se escribe inmediatamente después del POST, antes de las verificaciones posteriores.

Las trazas live se conservan también cuando pasa la prueba; en la suite aislada, las trazas y videos se conservan ante fallos. Cada prueba adjunta diagnósticos de consola, peticiones fallidas y respuestas HTTP de error. Un error JavaScript sin manejar hace fallar la prueba. Las respuestas 400/409 esperadas se registran sin hacer fallar los recorridos de recuperación.

Para abrir los artefactos, sustituir `<corrida>` por la carpeta impresa:

```powershell
npx playwright show-report "e2e/artifacts/<corrida>/report"
npx playwright show-trace "e2e/artifacts/<corrida>/tests/<prueba>/trace.zip"
```

El proceso devuelve código 0 si pasa y 1 si falla, incluidos los fallos de preparación. Las carpetas generadas se ignoran en Git. Conservan datos del backend que aparecieron en las pruebas y sirven para revisar el recorrido localmente.

## Revisión de integración

El backend `ae11f33` ya expone los contratos necesarios para lista y creación de propiedades. Se contrastaron código, OpenAPI en ejecución, CORS y respuestas reales. No hace falta agregar endpoints, autenticación, reset ni borrado para esta entrega. La inexistencia de DELETE es una limitación explícita de las pruebas con escritura: el registro sintético queda persistido y documentado.

La suite cubre el frontend funcional de propiedades. Las secciones de lecturas, OCR, reportes y selección de período siguen siendo rutas iniciales. Una prueba live exitosa valida el flujo contra el backend activo; no equivale a ejecutar la suite transaccional completa de PostgreSQL, MinIO o Worker/OCR.

Verificado el 17 de octubre de 2026: 7/7 pruebas aisladas, 4/4 contra `http://localhost:8080` con escritura habilitada y 2/2 pruebas de integración .NET de catálogos/CORS/errores. El modo live sin escritura también pasó sus tres pruebas y omitió explícitamente la creación. TypeScript de aplicación y harness compilaron correctamente; no hubo errores JavaScript sin manejar en el navegador. La corrida con escritura creó únicamente la propiedad `bc0b6ee3-d3f0-4450-a17a-479a9a8d8d9e`, identificada con `[E2E]` y documentada en su manifiesto. No se cambiaron endpoints ni datos preexistentes del backend.
