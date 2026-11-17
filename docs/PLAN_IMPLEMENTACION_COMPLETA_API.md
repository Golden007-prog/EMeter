# Plan de implementación completa de la API

Fecha de revisión: 17 de octubre de 2026. Estado: implementación integrada. Las 45 operaciones cuentan con recorrido de interfaz y evidencia de navegador. Véase el [informe de implementación](IMPLEMENTACION_API.md) para resultados y límites de validación.

## 1. Objetivo y definición de completo

Convertir UtilityMeterWeb en un cliente funcional de todas las capacidades públicas de UtilityMeter. La primera meta es completar los recorridos de negocio y su integración real; los cambios posteriores de diseño o alcance se harán sobre esa base.

**Completitud significa 45/45 operaciones OpenAPI accesibles desde recorridos de interfaz, con contratos, estados de error y pruebas correspondientes.** Tener funciones HTTP sin una acción o pantalla que las utilice no cuenta como implementación completa. La cobertura de operaciones tampoco sustituye la validación de los recorridos completos.

Al terminar, un usuario debe poder configurar sus entidades, registrar e importar lecturas, adjuntar documentos, revisar y corregir datos, consultar auditoría y reportes y cerrar un período desde el navegador, sin Swagger, SQL ni ingreso manual de UUID.

Se mantiene React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod y Material UI; organización por funcionalidades y alcance local de un usuario sin autenticación. Frontend, harness y artefactos permanecen en este repositorio. El backend sigue siendo autoridad de negocio.

## 2. Base revisada y situación inicial

Fuentes contrastadas:

- [OpenAPI en ejecución](http://localhost:8080/openapi/v1.json): 45 operaciones, agrupadas abajo. La cifra cuenta pares método/ruta, no solo rutas.
- Frontend en revisión `3166e9b`: [README](../README.md), [cliente HTTP](../src/shared/api/client.ts), [catálogos](../src/features/catalogs/api.ts), [router](../src/app/App.tsx) y [harness](../e2e/README.md).
- Backend local en revisión `ae11f33`: [API](../../UtilityMeter/docs/API.md), [dominio](../../UtilityMeter/docs/DOMAIN.md), [guía frontend](../../UtilityMeter/docs/FRONTEND.md), [OCR](../../UtilityMeter/docs/OCR.md) y [ejecución](../../UtilityMeter/docs/RUN.md).
- Código backend: `src/Presentation/Endpoints/`, `src/Application/Catalog/`, `src/Application/Extraction/`, `src/Application/BillingPeriods/Entities/BillingPeriod.cs` y `src/Application/Reports/`.

Las revisiones identifican el código local consultado; no prueban por sí solas qué commit ejecuta Docker. El contrato activo se vuelve a contrastar automáticamente en la suite de integración.

Al elaborar el plan había lista y creación funcionales de propiedades. Los GET de lista y detalle de organizaciones/condominios se usan como soporte de selectores; falta su administración. Lecturas, documentos, reportes y resumen del período son pantallas pendientes. El cliente HTTP está orientado a JSON y debe ampliarse para archivos y respuestas vacías. Hay seis operaciones consumidas desde la aplicación; eso no equivale a seis funcionalidades administrativas completas.

## 3. Matriz exhaustiva de operaciones

Estado inicial: **existente** = recorrido funcional; **parcial** = utilizado por selectores; **pendiente** = falta integración de interfaz. Todas las filas requieren evidencia final, incluidas las existentes. Los códigos de entrega se definen en la sección 5.

| ID     | Método | Ruta                                                                         | Uso en interfaz / aceptación específica                      | Estado inicial | Entrega |
| ------ | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------- | ------- |
| API-01 | GET    | `/api/organizations`                                                         | Directorio, búsqueda y selector paginado                     | Parcial        | E1      |
| API-02 | POST   | `/api/organizations`                                                         | Crear organización con contacto opcional                     | Pendiente      | E1      |
| API-03 | GET    | `/api/organizations/{id}`                                                    | Detalle y recuperación al abrir enlace directo               | Parcial        | E1      |
| API-04 | PUT    | `/api/organizations/{id}`                                                    | Editar nombre y correo de contacto                           | Pendiente      | E1      |
| API-05 | GET    | `/api/condominiums`                                                          | Directorio y selector por organización/nombre                | Parcial        | E1      |
| API-06 | POST   | `/api/condominiums`                                                          | Crear condominio independiente o asociado                    | Pendiente      | E1      |
| API-07 | GET    | `/api/condominiums/{id}`                                                     | Detalle con pertenencia y medidor principal                  | Parcial        | E1      |
| API-08 | PUT    | `/api/condominiums/{id}`                                                     | Editar nombre y dirección                                    | Pendiente      | E1      |
| API-09 | PUT    | `/api/condominiums/{id}/main-meter/{meterId}`                                | Asignar o sustituir principal con un medidor del condominio  | Pendiente      | E1      |
| API-10 | GET    | `/api/properties`                                                            | Directorio con búsqueda, pertenencias y páginas              | Existente      | E1      |
| API-11 | POST   | `/api/properties`                                                            | Crear propiedad independiente o asociada                     | Existente      | E1      |
| API-12 | GET    | `/api/properties/{id}`                                                       | Detalle y acceso a medidores y lecturas                      | Pendiente      | E1      |
| API-13 | PUT    | `/api/properties/{id}`                                                       | Editar nombre y dirección                                    | Pendiente      | E1      |
| API-14 | GET    | `/api/meters`                                                                | Directorio/selector por propiedad, recurso y serie           | Pendiente      | E1      |
| API-15 | POST   | `/api/meters`                                                                | Crear medidor con propiedad, serie, recurso, unidad y modelo | Pendiente      | E1      |
| API-16 | GET    | `/api/meters/{id}`                                                           | Detalle, instalación e historial de lecturas                 | Pendiente      | E1/E3   |
| API-17 | PUT    | `/api/meters/{id}`                                                           | Editar serie y modelo                                        | Pendiente      | E1      |
| API-18 | GET    | `/api/billing-periods`                                                       | Directorio y selector paginado, filtro de estado             | Pendiente      | E2      |
| API-19 | POST   | `/api/billing-periods`                                                       | Crear período con inicio y fin                               | Pendiente      | E2      |
| API-20 | GET    | `/api/billing-periods/{id}`                                                  | Recuperar fechas/estado del contexto de trabajo              | Pendiente      | E2      |
| API-21 | PUT    | `/api/billing-periods/{id}`                                                  | Editar fechas respetando lecturas y cierre                   | Pendiente      | E2      |
| API-22 | PUT    | `/api/billing-periods/{id}/status/{status}`                                  | Cambiar estado y cerrar irreversiblemente                    | Pendiente      | E2/E6   |
| API-23 | POST   | `/api/readings`                                                              | Captura e históricos, con idempotencia                       | Pendiente      | E3      |
| API-24 | GET    | `/api/readings/{id}`                                                         | Detalle con versión, revisión, alertas y relaciones          | Pendiente      | E3      |
| API-25 | GET    | `/api/readings/meter/{meterId}`                                              | Historial completo del medidor                               | Pendiente      | E3      |
| API-26 | GET    | `/api/readings/property/{propertyId}`                                        | Consulta por propiedad                                       | Pendiente      | E3      |
| API-27 | GET    | `/api/readings/billing-period/{billingPeriodId}`                             | Consulta por período                                         | Pendiente      | E3      |
| API-28 | PUT    | `/api/readings/{id}`                                                         | Corregir valor, fecha y asignación de período                | Pendiente      | E3      |
| API-29 | POST   | `/api/readings/{id}/review`                                                  | Confirmar, rechazar y reincorporar rechazadas                | Pendiente      | E3      |
| API-30 | POST   | `/api/readings/{id}/void`                                                    | Anular con motivo conservando trazabilidad                   | Pendiente      | E3      |
| API-31 | GET    | `/api/readings/{id}/history`                                                 | Auditoría paginada con cambios antes/después                 | Pendiente      | E3      |
| API-32 | POST   | `/api/evidence/upload`                                                       | Subir original JPEG, PNG o PDF                               | Pendiente      | E4      |
| API-33 | POST   | `/api/evidence/attach`                                                       | Asociar original a una lectura existente                     | Pendiente      | E4      |
| API-34 | GET    | `/api/evidence/reading/{readingId}`                                          | Mostrar evidencias de una lectura                            | Pendiente      | E4      |
| API-35 | GET    | `/api/evidence/{id}/download`                                                | Visualizar y descargar original                              | Pendiente      | E4      |
| API-36 | GET    | `/api/extractions`                                                           | Bandeja persistente paginada y filtrada por estado           | Pendiente      | E4      |
| API-37 | GET    | `/api/extractions/{id}`                                                      | Estado, texto, propuestas, confianza y lectura resultante    | Pendiente      | E4      |
| API-38 | POST   | `/api/extractions/{id}/confirm`                                              | Confirmación humana que crea una lectura una sola vez        | Pendiente      | E4      |
| API-39 | POST   | `/api/extractions/{id}/retry`                                                | Reencolar un Failed sin repetir la carga                     | Pendiente      | E4      |
| API-40 | GET    | `/api/reports/pending-readings`                                              | Pendientes de revisión, filtros de período y propiedad       | Pendiente      | E5      |
| API-41 | GET    | `/api/reports/missing-readings/{billingPeriodId}`                            | Medidores sin lectura activa, filtro de propiedad            | Pendiente      | E5      |
| API-42 | GET    | `/api/reports/abnormal-readings`                                             | Alertas activas, filtro de período                           | Pendiente      | E5      |
| API-43 | GET    | `/api/reports/monthly-summary/{billingPeriodId}`                             | Resumen, discrepancias, unidades, orígenes e incompletitud   | Pendiente      | E5      |
| API-44 | GET    | `/api/reports/condominiums/{condominiumId}/reconciliation/{billingPeriodId}` | Conciliación por origen, sospechas y explicación             | Pendiente      | E5      |
| API-45 | GET    | `/api/version`                                                               | Información de versión de la API en Configuración → Sistema  | Pendiente      | E0      |

Totales: catálogos y períodos 22; lecturas 9; evidencias 4; extracciones 4; reportes 5; versión 1.

`GET /health` existe fuera de OpenAPI: conservarlo en diagnóstico y preflight del harness, sin sumarlo a las 45 operaciones. Su respuesta no demuestra que Worker, almacenamiento u OCR estén operativos. Swagger y OpenAPI son herramientas de integración, no pantallas de negocio a replicar.

## 4. Navegación y organización previstas

| Área          | Rutas propuestas                                                                                                                              | Responsabilidad                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Configuración | `/configuracion/organizaciones`, `/condominios`, `/propiedades`, `/medidores`, `/periodos`, todos bajo `/configuracion` y con detalles `/:id` | Listar, crear y editar cada catálogo; relaciones visibles; medidor principal  |
| Sistema       | `/configuracion/sistema`                                                                                                                      | Versión de API y diagnóstico de conexión                                      |
| Período       | `/periodo?billingPeriodId=…`                                                                                                                  | Resumen operativo, faltantes, pendientes, alertas y cierre                    |
| Lecturas      | `/lecturas` y `/lecturas/:id`                                                                                                                 | Consultas por contexto, captura, corrección, revisión, evidencias e historial |
| Documentos    | `/documentos` y `/documentos/:id`                                                                                                             | Bandeja global de extracciones y revisión del original                        |
| Reportes      | `/reportes?billingPeriodId=…`                                                                                                                 | Resumen, conciliación y listas con acceso al detalle                          |

Mantener `features/catalogs`, `period-workspace`, `readings`, `documents` y `reports`. Agregar módulos internos de contratos, API, consultas y componentes donde crezcan las funcionalidades. Incorporar `shared/lib` para fechas/decimales y componentes compartidos de paginación, selección y conflictos. Evitar un formulario universal que oculte diferencias del dominio.

El período y los filtros navegables se mantienen en URL. Abrir un detalle directamente debe recuperar sus dependencias mediante GET por ID aunque no estén en la página de opciones actual. La ausencia de período no debe impedir capturas sin período, permitidas por la API. La bandeja OCR es global: no asumir un filtro por período que el servidor no ofrece.

Las listas de lecturas no tienen un GET global: la pantalla debe pedir contexto de medidor, propiedad o período y usar el endpoint correspondiente. Los filtros adicionales sobre arrays completos serán locales y explícitos; no se inventarán parámetros de servidor.

## 5. Entregas ordenadas por dependencia

Cada entrega incluye implementación, pruebas de su recorrido y actualización de documentación/matriz. E7 agrega validación integrada, no posterga todas las pruebas hasta el final.

### E0 — Contratos, transporte y utilidades de dominio

Dependencia: ninguna. Resultado: base capaz de consumir todos los tipos de respuesta.

- Registrar una copia fechada del OpenAPI y una matriz verificable método/ruta → función cliente → recorrido → prueba. Detectar adiciones, eliminaciones y cambios antes de declarar completitud.
- Ampliar el cliente para JSON, `FormData`, descarga binaria y `204 No Content`; dejar al navegador generar el boundary multipart. Conservar `AbortSignal`, errores de red y ProblemDetails, incluidos `errors.request`, 400, 404, 409, 413 y 500.
- Conservar `Location` cuando aporte al recorrido; no confundir ID de evidencia, trabajo y lectura. Validar respuestas con esquemas Zod y tratar los errores de contrato como errores visibles, no como listas vacías.
- Definir contratos de todos los DTO, páginas, arrays, nulos y estados. Verificar la representación real de enums: el recurso usa `water/electricity/gas`, mientras revisión y OCR exponen estados textuales como `Pending` y `NeedsReview`.
- Definir claves de caché por recurso/contexto y reglas de invalidación. Mantener desactivados los reintentos automáticos de mutaciones; las recuperaciones deben respetar la idempotencia específica.
- Implementar decimales con entrada local y precisión hasta `numeric(18,2)`: valor no negativo, menor a 10^16 y máximo dos decimales. Evitar pasar el rango completo por `Number`/`parseFloat`/`response.json()` sin una estrategia que preserve precisión. Probar transporte decimal sin pérdida, aprovechando cadenas si el contrato real las acepta o parseo/serialización JSON exactos. No reducir silenciosamente el rango admitido por el backend.
- Fechas en `America/Santiago`, ISO 8601 con offset de la fecha seleccionada, almacenamiento UTC en servidor. Resolver explícitamente horas ambiguas o inexistentes por cambio horario; no fijar `-03:00`, usar la zona del navegador ni inferir un mes calendario.
- Agregar información de versión y mantener estados accesibles de carga, guardado, vacío y error.

Aceptación: contratos y utilidades verifican JSON, multipart, binarios, 204, decimales límite, nulos, cambios horarios y errores; el recorrido existente de propiedades sigue funcionando.

### E1 — Catálogos y configuración completa

Dependencia: E0. Resultado: configurar todo lo necesario para capturar y conciliar.

- Organizaciones: lista, búsqueda, detalle, alta y edición de nombre/contacto.
- Condominios: lista, búsqueda por organización, detalle, alta y edición de nombre/dirección.
- Propiedades: conservar lo existente y agregar detalle, edición y acceso a medidores/lecturas.
- Medidores: lista con filtros de propiedad/recurso/serie, alta, detalle y edición de serie/modelo. Heredar el recurso de la propiedad y mostrar unidad e instalación; `installedAt` es de lectura, no un campo aceptado por el POST actual.
- Asignar/sustituir principal desde el condominio. Obtener candidatos de sus propiedades mediante los filtros disponibles, recorriendo páginas sin truncar. No existe filtro directo `condominiumId` en medidores ni acción de desasignar principal.
- Selectores por nombre, dirección o serie, paginados y recuperables por ID. Mostrar nombres repetidos con contexto. Las entidades independientes deben poder crearse sin inventar organizaciones obligatorias.
- Validaciones de texto y correo conforme al backend; respetar pertenencias, recurso y unidad inmutables en edición. No ofrecer cambios que los PUT no admiten.

Aceptación: configurar una organización, condominio, propiedades, varios medidores y principal; editar cada tipo; abrir detalles tras recarga; navegar más de 50 opciones y mantener filtros. No pedir UUID ni ofrecer borrado.

### E2 — Períodos y contexto de trabajo

Dependencia: E0; se integra con la navegación de E1.

- Directorio paginado, filtro por estado, creación, detalle y edición de fechas.
- Selector global con fechas y estado; persistencia en URL y resolución al recargar.
- Cambios entre Open, Collecting y Validating según contrato. La API permite cambios entre estados no cerrados: no imponer un avance lineal obligatorio.
- Implementar desde aquí la protección transversal de Closed y preparar su acción de cierre para E6.
- Evitar que un cambio de fechas excluya lecturas existentes; mostrar el error del backend conservando el formulario. No inventar una regla de no solapamiento si no existe en el servidor.

Aceptación: creación y selección de período, cambios de estado, recarga directa, edición válida y rechazo de fechas incompatibles. Todas las pantallas consumen un mismo contexto de período.

### E3 — Ciclo completo de lecturas y auditoría

Dependencias: E0, E1 y E2.

- Listar por medidor, propiedad y período; mostrar también rechazadas/anuladas cuando el endpoint las devuelve. Consultar detalle, lectura previa, alertas y estados separados.
- Captura manual con origen explícito: Manual, Resident, Company u OCR, según las opciones del POST. Hacer claros Resident/Company para conciliación; la confirmación documental tiene un conjunto distinto de orígenes en E4.
- Seleccionar medidor; recuperar propiedad y unidad; período opcional y fecha histórica. Mostrar anterior activa del mismo medidor/origen y estimación informativa de consumo. Enviar `previousReadingId` solo cuando corresponda a la anterior inmediata verificada, o dejar su resolución al servidor.
- Generar un `requestId` por captura y conservar ID y cuerpo al recuperar una respuesta perdida. Si se modifican valores, tratarlo como otra captura; no reutilizar el ID con un cuerpo distinto. Tras 201 consultar el detalle completo, ya que la respuesta de creación es reducida.
- Corregir valor/fecha/período con `expectedVersion` y motivo; permitir asignar, cambiar o quitar período cuando el backend lo admite. La lectura vuelve a Pending.
- Confirmar o rechazar con motivo y versión; permitir reincorporar una rechazada si el backend lo acepta. Mantener advertencias visibles en lecturas confirmadas.
- Anular con confirmación explícita, motivo y versión; conservar detalle, historial y evidencias. No ofrecer desanular.
- Ante 409: conservar borrador, recuperar estado actual, mostrar diferencias y permitir una nueva decisión. No reenviar automáticamente una versión nueva ni tratar todo 409 como conflicto de versión: puede ser duplicado, cierre o idempotencia.
- Historial paginado con fecha, acción, motivo, cambios antes/después y acceso al JSON original cuando sea útil. Contemplar snapshots nulos o cambios futuros de estructura.
- Tras mutaciones, invalidar las lecturas afectadas y los reportes: insertar un histórico, rechazar, corregir o anular puede recalcular lecturas posteriores e incrementar otras versiones, incluso fuera del período visible.

Aceptación: captura inicial y posterior, histórico intercalado, disminución con advertencia, consumo alto, revisión, corrección, rechazo/reincorporación, anulación, historial y recuperación de 409. Un reintento no duplica lecturas. Una operación que recalcule datos cerrados falla íntegramente y la UI lo explica.

### E4 — Evidencias, bandeja OCR y confirmación humana

Dependencias: E0, E1, E2 y detalle de lecturas de E3. Requiere infraestructura completa para la aceptación real.

- Cargar JPEG/PNG/PDF hasta 20 MiB; mostrar estado de carga y errores de formato/firma/tamaño, conservar campos y evitar doble envío. No prometer reintento idempotente de upload: el endpoint no ofrece `requestId` para archivos.
- Recuperar trabajos desde la bandeja paginada del servidor, con filtros Queued, Processing, NeedsReview, Failed y Confirmed. Mostrar archivo, intentos, error, disponibilidad y lectura confirmada.
- Consultar detalle con polling acotado solo durante Queued/Processing, detenerlo al salir o llegar a estado terminal y permitir actualización manual. Recuperar conexión sin crear otro trabajo.
- Vista del original junto a campos editables; mostrar texto, todas las propuestas disponibles, motor y confianza nullable. Confianza OCR no equivale a probabilidad de que un campo sea correcto. Renderizar texto/documentos sin interpretar contenido como HTML ejecutable.
- Confirmación exclusivamente desde NeedsReview con medidor, unidad, lectura acumulada, fecha, propiedad/período opcionales y origen Company, Resident u OCR. Nunca confundir monto, consumo, vencimiento o fecha de emisión con la lectura/fecha medida.
- Confirmar una extracción devuelve `readingId`: abrir esa lectura y reflejar su versión y alertas actuales. Una repetición usa la misma extracción y devuelve la misma lectura; no ejecutar además POST `/readings`.
- Reintentar Failed mediante `/retry`; conservar el original y volver a seguir el estado. No permitir retry de otros estados.
- Desde lectura: listar evidencias, abrir/descargar originales y adjuntar una evidencia existente o recién cargada. Resolver evidencias existentes desde bandeja/detalles disponibles, sin inventar un GET global de evidencias.
- Separar «adjuntar a lectura existente» de «confirmar OCR y crear lectura». Upload también crea un trabajo OCR; attach no lo marca confirmado ni existe cancelación de extracción. Explicar ese estado para evitar una segunda lectura accidental.
- Descargar usando MIME y nombre disponibles, ofrecer alternativa si el navegador no previsualiza PDF y liberar URLs de objetos al salir.

Aceptación: cargar documento real sintético, esperar OCR real, recargar navegador, recuperar trabajo, corregir propuestas, confirmar dos veces sin duplicar lectura y descargar el mismo original. Verificar attach idempotente, períodos cerrados, archivos inválidos y recuperación de un Failed. Los estados simulados sirven para probar la UI, pero no certifican procesamiento real.

### E5 — Reportes y espacio operativo del período

Dependencias: E2 y E3; incorporar resultados documentales de E4.

- Pendientes con filtros opcionales de período/propiedad; no confundir con faltantes.
- Faltantes: medidores sin lectura activa en el período. Acción de capturar con medidor/período preseleccionados. No interpretarlo como falta de una lectura por cada origen: el endpoint no distingue orígenes.
- Anomalías: alertas y enlaces al detalle/historial de la lectura.
- Resumen: conteos, discrepancias Resident/Company, totales por unidad y por origen incluidos Manual/OCR; mostrar `uncalculableReadingCount` y nulos como información incompleta.
- Conciliación: condominio, período y origen explícitos. Admitir Resident, Company, Manual y OCR, validados en el backend. Mostrar principal, subtotal, diferencia, porcentaje, unidad, `isComplete`, explicación y propiedades con razones de sospecha.
- Las sospechas de conciliación referencian propiedades; enlazar a propiedad/lecturas contextualizadas, sin fabricar un readingId inexistente en ese DTO.
- Convertir `/periodo` en panel de trabajo con resumen, faltantes, pendientes, confirmadas y advertencias enlazadas. Consultar en paralelo fuentes independientes y mostrar errores parciales sin perder el contexto.
- Usar totales del servidor; nunca sumar unidades incompatibles, reemplazar null por 0 ni excluir Pending como regla inventada. Rejected/Voided quedan excluidas según las reglas del backend.

Aceptación: fixtures conocidos de consumo completo e incompleto, sin anterior válida, consumo decreciente, unidades distintas, principal ausente, varios submedidores y discrepancias por origen. Cualquier acción correctiva actualiza listas, cifras y conciliación sin recargar toda la aplicación.

### E6 — Cierre y coherencia integral

Dependencias: E2–E5.

- Incorporar cierre al espacio de período con resumen actualizado de pendientes, faltantes y advertencias y aviso inequívoco de irreversibilidad.
- Pedir confirmación de la acción al usuario de la aplicación. No agregar criterios de bloqueo por pendientes o anomalías si el backend no los exige; mostrar consecuencias y dejar que el servidor decida la validez.
- Tras 204, consultar nuevamente estado e invalidar contexto y vistas dependientes.
- Deshabilitar captura, corrección, revisión, anulación, asociación de evidencia y edición de fechas que afecten períodos cerrados; conservar consultas, historial, originales y reportes.
- Manejar cierre desde otra pestaña y operaciones históricas que recalculen una lectura cerrada, aunque el formulario se hubiera abierto con estado editable. El 409 del backend sigue siendo la protección definitiva.

Aceptación: cerrar un período de prueba, comprobar que no puede reabrirse y verificar todas las restricciones desde UI y respuestas reales. Las consultas siguen disponibles.

### E7 — Certificación de cobertura completa

Dependencias: todas las anteriores.

- Vincular las 45 filas con código, ruta visible, prueba y artefactos de la última ejecución. Cero operaciones pendientes y cero pantallas de alcance pendiente en los recorridos acordados.
- Ejecutar recorridos integrales en escritorio y móvil, teclado, foco y mensajes de estado; enlaces directos y recarga; API desconectada, retorno de conexión y preservación de borradores.
- Validar persistencia real de catálogos, lecturas, auditoría, originales y trabajos al reiniciar el entorno de prueba completo.
- Actualizar README y e2e/README con funcionamiento final, comandos, requisitos, capacidades y limitaciones reales.
- Publicar informe de aceptación con resultados por operación y recorrido, entorno utilizado y cualquier bloqueo pendiente. Si falla OCR real o un límite decimal, no declarar 100% funcional.

Orden recomendado: **E0 → E1 → E2 → E3 → E4 → E5 → E6 → E7**. Cada entrega puede dividirse en PR pequeños siguiendo sus subflujos, pero la meta de aceptación sigue siendo la totalidad.

## 6. Orquestación de estados e invalidación

| Acción                                | Consultas que deben actualizarse                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Alta/edición de catálogo              | Lista, detalle, selectores y nombres relacionados; reportes afectados si cambia el conjunto de medidores            |
| Asignación de principal               | Detalle del condominio y conciliaciones                                                                             |
| Cambio de fechas/estado               | Detalle/listas de períodos, contexto activo y capacidades de escritura                                              |
| Crear/corregir/revisar/anular lectura | Detalle, historia, listas por medidor/propiedad/período, antecedentes y todos los reportes afectados por recálculos |
| Upload/retry                          | Bandeja y detalle del trabajo; seguimiento hasta estado terminal                                                    |
| Confirmar extracción                  | Trabajo, bandeja, lectura resultante, evidencias y consultas/reportes de lecturas                                   |
| Adjuntar evidencia                    | Evidencias y detalle de lectura; recuperar versión vigente si cambia                                                |
| Cerrar período                        | Estado del contexto, listas, reportes y controles de escritura abiertos                                             |

Empezar con invalidación conservadora de familias de consultas para mutaciones que recalculan cadenas. Reducirla solo si se puede demostrar qué datos deja intactos el contrato. Evitar actualizaciones optimistas de lecturas, reportes o cierre que representen como aceptada una operación todavía no confirmada.

Las secuencias compuestas usan los IDs devueltos por el servidor. Si una alta de propiedad funciona y luego falla la del medidor, conservar/enlazar la propiedad creada y reintentar el paso pendiente; no hay transacción frontend ni DELETE compensatorio. Aplicar el mismo criterio a carga de evidencia seguida de asociación.

## 7. Estrategia de pruebas y entornos

### A. Verificaciones específicas

Pruebas acotadas para parsing/serialización decimal, fechas de Chile, estados e invalidaciones críticas. Usar pruebas de contrato para páginas/arrays, null, respuestas reducidas de creación, archivos y errores. Incorporar un runner de pruebas unitarias si hace falta; no replicar la lógica de negocio del backend en tests de UI.

### B. E2E aislado con API real en memoria

Extender el harness existente para catálogos, períodos, lecturas, auditoría, reportes y cierre. Sembrar datos efímeros mediante API; no usar acceso SQL ni endpoints de reset añadidos para la web. Mantener los casos existentes y cubrir paginación real de catálogos, historia y bandeja donde el entorno la soporte.

Probar errores y estados difíciles de reproducir mediante intercepción HTTP de forma explícita. Distinguir esos resultados de las pruebas que verifican reglas/transacciones reales. Este modo no certifica Worker/OCR durable.

### C. E2E con infraestructura completa desechable

Agregar un modo de harness documentado, por ejemplo `full-stack`, que prepare un proyecto Compose de pruebas con puertos, volúmenes y datos propios, desde la configuración del backend. API y Worker deben compartir PostgreSQL y almacenamiento, y usar el servicio OCR real. No reutilizar ni detener servicios o volúmenes de trabajo.

Usar fixtures sintéticos PDF con texto y PNG/JPEG para cubrir extracción de texto y reconocimiento de imagen, sin depender de exactitud universal del OCR. Probar almacenamiento/descarga, procesamiento, confirmación repetida, persistencia y recuperación. Provocar un fallo controlado de OCR exclusivamente en ese entorno para comprobar Failed → retry → NeedsReview.

El harness web y los artefactos quedan en `e2e/` y `e2e/artifacts/`; pruebas .NET y validaciones internas del backend siguen en su repositorio. La integración PostgreSQL existente complementa el navegador para concurrencia/transacciones; no se sustituye con mocks.

### D. Live

Conservar `test:e2e:live` de solo lectura. Conservar también el alcance actual de `test:e2e:live:write`: una propiedad sintética persistente. No convertir silenciosamente ese comando en una suite que cree lecturas, suba documentos o cierre períodos.

Si se necesita escritura más amplia contra un backend existente, agregar una modalidad explícita para datos sintéticos propios, con manifiesto inmediato de IDs y efectos. El cierre se prueba solo sobre períodos de la corrida. La cobertura completa debe demostrarse preferentemente en el stack desechable.

### Recorridos de aceptación obligatorios

| Caso | Recorrido y evidencia esperada                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------- |
| T01  | Configurar entidades independientes/asociadas, editar metadatos, asignar principal y recorrer más de una página         |
| T02  | Crear período, seleccionar por URL, cambiar estados y validar edición de fechas con lecturas existentes                 |
| T03  | Capturar primera y segunda lectura por origen; insertar histórico y verificar recálculos posteriores                    |
| T04  | Perder respuesta de captura y reenviar mismo requestId/cuerpo: un solo registro; cuerpo distinto: conflicto             |
| T05  | Confirmar con advertencia, corregir a Pending, rechazar/reincorporar, anular y revisar auditoría                        |
| T06  | Cambiar versión desde otro contexto; conservar borrador y resolver conflicto sin sobrescritura silenciosa               |
| T07  | Subir, adjuntar y descargar evidencia; repetir attach sin duplicar; tratar archivo inválido y tamaño excesivo           |
| T08  | OCR real, recuperación de bandeja tras recarga y confirmación humana repetida con un solo readingId                     |
| T09  | Failed, error visible, retry sin nueva carga y parada del polling al terminar/salir                                     |
| T10  | Pendientes/faltantes/anomalías, resumen y conciliación con datos completos e incompletos, unidades y orígenes distintos |
| T11  | Cierre irreversible y rechazo de mutaciones directas o recálculos indirectos sobre datos cerrados                       |
| T12  | Navegación móvil/teclado, enlaces directos, carga/vacío/error, desconexión y recuperación                               |
| T13  | Persistencia tras reinicio del stack de prueba y trazabilidad 45/45 contra OpenAPI actualizado                          |

Comandos de verificación: `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:e2e`, `npm run test:e2e` y `npm run test:e2e:live`. Se agregaron `npm run test:unit` y `npm run test:e2e:full-stack`; resultados en el informe de implementación. No registrar una prueba omitida por falta de infraestructura como aprobada.

## 8. Riesgos, decisiones y límites del contrato

| Tema                                   | Decisión / tratamiento                                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Precisión decimal                      | Resolver en E0 con valores límite de entrada y respuesta real. El formato OpenAPI `double` no elimina que el backend trabaje con decimal/numeric(18,2).                                                                  |
| Fechas y horario de verano             | Conversión por zona y fecha, con casos ambiguos/inexistentes explícitos. Validar límites de períodos sin inventar horarios.                                                                                              |
| Respuesta perdida en alta/upload       | No hay idempotencia general; no reintentar automáticamente. Ofrecer revisar directorio/bandeja antes de iniciar otra alta.                                                                                               |
| Idempotencia de lecturas/OCR           | requestId con cuerpo estable para captura; ID de extracción para confirmación; attach idempotente. Son mecanismos distintos.                                                                                             |
| Cierre y cambios concurrentes          | UI explica y previene cuando conoce el estado; servidor decide y 409 recuperable protege la operación.                                                                                                                   |
| OCR incompleto o infraestructura caída | Mostrar estado/error y permitir recuperación. No sustituir resultados reales por datos simulados para declarar completitud.                                                                                              |
| Arrays sin paginación                  | Mostrar todos los datos disponibles; paginación/filtrado local si hace falta. Un cambio a paginación de servidor sería trabajo coordinado de backend.                                                                    |
| Duplicación de reglas                  | Frontend valida ergonomía y formatos; backend resuelve cadenas, consumos, alertas, pertenencias e inmutabilidad.                                                                                                         |
| Brecha entre contrato y código         | Registrar reproducción y efecto. Si una capacidad exige corregir API, crear trabajo separado en `D:\coding\UtilityMeter`, actualizar contrato y desbloquear integración; no cambiar reglas unilateralmente desde la web. |

No forman parte de esta API: autenticación/roles, borrado de catálogos o documentos, desanular, reabrir períodos, mover pertenencias, cambiar unidad/recurso históricos, cancelar trabajos OCR, carga masiva transaccional, exportación de reportes del servidor, tarifas, cobros, prorrateo ni conversión de unidades. No se añadirán controles que prometan esas operaciones. Esto delimita el contrato actual; no reduce la cobertura de sus capacidades disponibles.

La primera versión funcional conserva accesibilidad básica, navegación adaptable y feedback de errores desde cada entrega. El rediseño visual puede realizarse después sin posponer esas condiciones de uso.

## 9. Lista de salida

- [x] 45/45 operaciones con integración visible, contrato validado y prueba identificada.
- [x] Cinco catálogos completos y asignación de principal; todos los filtros del servidor accesibles.
- [x] Períodos, captura, históricos, revisión, corrección, rechazo/reincorporación, anulación y auditoría completos.
- [x] Evidencias y OCR real con recuperación de bandeja, reintento, confirmación idempotente y descarga.
- [x] Cinco reportes y panel operativo con nulos, unidades y orígenes correctos.
- [x] Cierre irreversible y restricciones directas/indirectas verificadas.
- [x] Decimales y fechas sin pérdida silenciosa; 400/404/409/413/500 y red manejados.
- [x] Pruebas de regresión y stack completo aprobadas; artefactos/manifiestos en `e2e/artifacts/`.
- [x] README, harness y matriz actualizados; sin funcionalidades pendientes ocultas tras mocks.

La matriz de la sección 3 conserva el estado inicial para mostrar la brecha original. El estado final por operación, las pruebas y sus artefactos están en [IMPLEMENTACION_API.md](IMPLEMENTACION_API.md). Las pruebas con escritura se ejecutan sobre entornos desechables propios; el backend de trabajo en 8080 no se modifica.
