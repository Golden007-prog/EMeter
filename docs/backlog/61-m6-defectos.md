# Backlog · M6 Defectos de seguridad

Hallazgos que hoy no afectan a nadie porque el prototipo sólo corre en local, pero que
impiden compartirlo o desplegarlo. Son baratos: conviene adelantarlos antes de invitar usuarios.

## [M6] No filtrar trazas internas ni registrar 500 donde hubo 400
labels: type:bug, area:api, area:security, prio:alta, fase:6
effort: 1
milestone: M6 · Producto seguro

**Reproducido.** `GET /api/version` devuelve `ex.StackTrace` como `ProblemDetails.Detail` (`src/Presentation/Endpoints/VersionEndpoints.cs:30-35`) y un test lo consagra (`tests/Presentation.Tests.Unit/Endpoints/VersionEndpointTests.cs:66`). Además, `ApiExceptionMiddleware` (`Extensions/ApiExceptionMiddleware.cs:12-29`) está fuera de `UseSerilogRequestLogging`: validaciones y 404 se registran como **500 con stack completo**, lo que ensucia Seq y dispara alertas falsas.

**Criterios de aceptación.**
- [ ] Ninguna respuesta HTTP contiene stack, rutas de archivo ni nombres de tipo internos.
- [ ] Errores 4xx se registran como información; sólo 5xx como error con traza.
- [ ] El test que esperaba la traza se reemplaza por uno que verifica su ausencia.

## [M6] Evidencia inexistente debe responder 404
labels: type:bug, area:api, prio:media, fase:6
effort: 1
milestone: M6 · Producto seguro

**Problema.** `GetByReadingIdAsync` devuelve lista vacía si la lectura no existe (`src/Infrastructure/.../EntityFrameworkEvidenceRepository.cs:19-23`): una lectura inexistente y una lectura sin evidencias son indistinguibles para el cliente, y la UI no puede distinguir un error de un vacío legítimo.

**Criterios de aceptación.**
- [ ] Lectura inexistente → 404; lectura existente sin evidencias → 200 con lista vacía.
- [ ] Prueba HTTP de ambos casos.
