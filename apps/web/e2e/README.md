# Harness E2E de UtilityMeter

Ejecutar desde `D:\coding\UtilityMeterWeb`. Requiere `npm ci` y Chromium (`npx playwright install chromium`). Frontend, harness y artefactos pertenecen a este repositorio; el backend permanece en `D:\coding\UtilityMeter`.

## Modos y requisitos

| Modo           | Backend                                            | Requisitos                                                     | Escritura                                                |
| -------------- | -------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| Aislado        | API efímera en memoria, puerto 18080               | .NET 10 y `../UtilityMeter/src/Presentation`                   | Datos temporales; sin OCR durable                        |
| Full-stack     | API 18081; PostgreSQL, MinIO, Worker y OCR propios | Docker con Compose que admita `!override`, repositorio backend | Proyecto `utilitymeter-e2e-<id>` y volúmenes desechables |
| Live           | API local existente, por defecto 8080              | API iniciada, salud y CORS válidos                             | Solo lectura                                             |
| Live `--write` | Misma API existente                                | Lo anterior                                                    | Una propiedad independiente `[E2E]`, persistente         |

```powershell
npm run test:e2e
npm run test:e2e:full-stack
npm run test:e2e:live
npm run test:e2e:live:write
```

Aislado y live usan frontend en 5173. Si está ocupado por el servidor de desarrollo, usar otro puerto libre:

```powershell
$env:E2E_WEB_PORT='15173'
npm run test:e2e
```

Full-stack usa siempre 15173/18081. Los modos no reutilizan ni detienen servidores ajenos y fallan si sus puertos están ocupados. Ejecutar las suites secuencialmente: comparten `.e2e-dist/`. El modo aislado añade su origen a CORS en la API temporal. En live, el origen elegido debe estar permitido por la API; el preflight lo verifica antes de ejecutar.

Para seleccionar pruebas o una API live diferente:

```powershell
node e2e/harness.mjs --mode live --api http://localhost:5032
node e2e/harness.mjs --mode isolated --grep "conserva campos"
node e2e/harness.mjs --mode live --headed
node e2e/harness.mjs --mode isolated --ui
node e2e/harness.mjs --help
npm run test:e2e:full-stack -- --grep "OCR real"
```

Live solo admite URLs locales HTTP/HTTPS. `E2E_API_URL` también configura live. Aislado siempre utiliza su propia API en 18080. `--headed` y `--ui` abren ventanas de navegador; sin esas opciones se ejecuta Chromium sin ventana.

## Qué se comprueba

- `properties.spec.ts`: creación independiente/asociada, persistencia tras recarga, filtros/paginación, selectores con más de 50 opciones, validación, doble envío, errores recuperables, navegación móvil y teclado.
- `workflows.spec.ts`: contrato de 45 operaciones, altas/edición/detalles de los cinco catálogos, principal, período, lectura inicial e histórica, revisión, conflicto concurrente real, corrección, rechazo/reincorporación, anulación, historial paginado, cierre y reportes. Captura con respuesta perdida conserva cuerpo/requestId y el máximo decimal; cuerpo alterado produce conflicto. Incluye cierre externo que impide un recálculo histórico indirecto y errores controlados 413/500 de upload.
- `documents.spec.ts` (solo full-stack): OCR real de PDF/PNG/JPEG; bandeja y recarga; confirmación/attach idempotentes; descarga con nombre y bytes; persistencia tras reiniciar los servicios propios; Failed real y retry después de recuperar OCR; archivo de firma inválida.
- `live.spec.ts`: salud, OpenAPI, consultas de catálogos, errores reales 400/404, CORS y navegación. Solo con `--write` agrega una propiedad y registra inmediatamente su ID.
- `tests/domain.test.mjs`: precisión decimal de extremo a extremo en JSON, validaciones de rango y horas de verano/invierno/ambiguas/inexistentes de Santiago (`npm run test:unit`).

Las suites aislada y full-stack utilizan API real. Algunas respuestas de error se interceptan explícitamente para probar recuperación de UI; no certifican fallos de infraestructura. Full-stack deriva de `../UtilityMeter/docker-compose.yml` mediante `e2e/compose.override.yml`, usa credenciales desechables y OCR Tesseract sin descarga de modelos. La extracción de PDF y el reconocimiento de imágenes son reales; la calidad sobre documentos arbitrarios depende del motor y del original.

La prueba de persistencia reinicia API, Worker, PostgreSQL, MinIO y OCR **solo de su proyecto de pruebas**. La prueba de Failed detiene y recupera su OCR. El harness elimina contenedores y volúmenes de ese proyecto al terminar, incluso si una prueba falla. No modifica el stack de trabajo en 8080 ni su almacenamiento. Si el proceso se termina externamente de forma forzada, revisar el nombre del proyecto en los artefactos antes de limpiar manualmente; no ejecutar una limpieza global de Docker.

Live conserva su alcance reducido. Sin `--write`, la creación se omite explícitamente. No se siembran medidores/lecturas ni se cierran períodos contra la API de trabajo. No existe DELETE de catálogos: la única propiedad sintética de live con escritura queda persistida y documentada.

## Evidencia y cobertura

Cada ejecución crea `e2e/artifacts/<modo-fecha-id>/` o `e2e/artifacts/utilitymeter-e2e-<id>/` y muestra su ubicación:

- `run.json`: entorno, resultado, fechas y ubicación; live incluye registros creados.
- `results.json`: detalle procesable de los tests y adjuntos.
- `report/index.html`: reporte HTML.
- `tests/`: capturas y trazas/videos de fallos; screenshots explícitos de recorridos aprobados cuando corresponde.
- `api-coverage.json` (full-stack): operaciones observadas desde el navegador y pruebas aprobadas que las ejercitaron.
- `created-records.json` y adjuntos `created-record.json` en live con escritura.

Cada test adjunta `api-operations` y diagnósticos de consola, errores JavaScript, peticiones fallidas y errores HTTP. Un error JavaScript sin manejar hace fallar la prueba. Las trazas live se conservan también cuando la prueba pasa.

Full-stack exige **45/45 operaciones con respuesta exitosa desde navegador** en la ejecución completa. No cuenta las llamadas de siembra hechas por `request`. Con argumentos de selección se permite cobertura parcial y el reporte muestra las operaciones faltantes. La comprobación del OpenAPI compara métodos y rutas; Zod valida los DTO consumidos. Esta métrica no implica cobertura de cada rama, regla o variante de contrato.

```powershell
npx playwright show-report "e2e/artifacts/<corrida>/report"
npx playwright show-trace "e2e/artifacts/<corrida>/tests/<prueba>/trace.zip"
node e2e/coverage.mjs "e2e/artifacts/<corrida>"
```

Los procesos retornan 0 al pasar y 1 al fallar, incluyendo preparación o limpieza. Los artefactos están ignorados por Git; contienen datos vistos durante las pruebas. Compilan TypeScript de aplicación/tests y usan `.e2e-dist/` para no alterar `dist/` ni su URL de API.

Los resultados de la entrega y la matriz código/interfaz/prueba están en [IMPLEMENTACION_API.md](../docs/IMPLEMENTACION_API.md). Las verificaciones live anteriores pertenecen al alcance histórico de propiedades; esta entrega se valida con los entornos desechables y no amplía silenciosamente las escrituras live.
