# Análisis de brechas

Verificado el 17 de noviembre de 2026 sobre el commit `d01e8d1` (API) y `7c46cf2` (web),
ya importados al monorepo. Todo lo afirmado aquí se comprobó ejecutando comandos o leyendo el
código citado; lo que depende de Docker o PostgreSQL se marca como **no verificado**.

## 1. Qué se ejecutó

| Verificación | Resultado |
| --- | --- |
| `dotnet build apps/api/CleanMinimalApi.sln` | Éxito, 0 errores (7 advertencias de analizadores en la primera corrida) |
| `dotnet test tests/Application.Tests.Unit` | 20 aprobadas, 0 fallidas |
| `dotnet test tests/Presentation.Tests.Unit` | 4 aprobadas, 0 fallidas |
| `dotnet test tests/Presentation.Tests.Integration` | 7 aprobadas, 0 fallidas (sin Docker) |
| `python -m unittest discover -s services/ocr` | 7 aprobadas |
| `tests/Infrastructure.Tests.Integration` | **No ejecutado**: requiere Testcontainers y Docker |
| `npm run lint`, `build`, `test:unit`, `format:check`, `check:e2e` | Todo en verde; unitarias 5/5 |
| Suite Playwright full-stack (45 operaciones) | **No re-ejecutada**; sólo consta por artefacto previo |

## 2. Lo que ya funciona

No es un prototipo vacío. La parte difícil de un sistema de medición ya está resuelta y con
pruebas:

- **46 endpoints** (44 de negocio) sobre cinco catálogos, lecturas, evidencias, extracción OCR,
  cinco reportes y versión/salud.
- **Lecturas con historia real**: versiones, `requestId`, `expectedVersion`, revisiones con
  snapshot antes/después, anulación, reincorporación y recálculo transaccional de alertas.
- **Evidencia inmutable**: originales en MinIO con SHA-256, cola durable en PostgreSQL con
  lease y reintentos, y confirmación humana obligatoria.
- **Reportes que ya evitan errores caros**: consumo desconocido no se presenta como cero en el
  backend, unidades separadas, conciliación de condominio que excluye el medidor principal.
- **Cliente web completo** para los seis flujos, con contratos Zod y 45 operaciones cubiertas
  por el harness.

La base técnica es sólida. **La brecha está en el dinero**, no en la medición.

## 3. La brecha central

`docs/DOMAIN.md`, `docs/OPERATIONS.md` y `AGENTS.md` lo dicen con todas sus letras: **no hay
tarifas, ni facturación monetaria, ni prorrateo, ni conversión de unidades**. En el código no
existe ningún tipo monetario: `grep` de `tarifa|precio|monto|importe|currency|IVA` sólo
encuentra `ExtractedCharge.Amount`, que es **un string**.

| Capacidad necesaria | Estado |
| --- | --- |
| Boleta como entidad persistida (cabecera + cargos) | ❌ Los cargos viven en el JSON del trabajo OCR y nadie los lee |
| Precio unitario, cargo fijo, potencia, IVA, alumbrado | ❌ No se extraen del documento |
| Tarifa oficial con vigencia y comuna | ❌ No existe |
| Comparación facturado contra esperado | ❌ No existe |
| Monto en disputa | ❌ No existe |
| Expediente de reclamo | ❌ No existe |
| Seguimiento del reclamo | ❌ No existe |

El OCR extrae hoy `totalAmount`, cargos, lecturas, constante y potencia conectada, pero **se
descartan**: ningún consumidor en .NET lee `charges`, `metadata`, `proposals` ni `readings` del
resultado. Es decir, el dato existe y se pierde en la siguiente pantalla.

## 4. Cobros irregulares: qué se detecta hoy

Esta es la tabla que responde al objetivo del producto.

| Señal de cobro irregular | ¿Se detecta hoy? | Qué falta |
| --- | --- | --- |
| Consumo facturado distinto al medido | ❌ | Persistir la boleta y comparar contra Δlecturas (M2, M4 #21) |
| Total de boleta distinto a la suma de cargos | ❌ | Persistir cargos y cuadrar (M2, M4 #19) |
| Precio por kWh superior al pliego | ❌ | Tarifas + regla de cargo variable (M3, M4 #20) |
| Cargo fijo distinto al pliego | ❌ | Ídem |
| IVA mal aplicado o sobre base equivocada | ❌ | Extraer neto/IVA y tarifa afecta (M2 #13, M4 #20) |
| Alumbrado público indebido o duplicado | ❌ | Extraer el cargo y su comuna (M2 #13, M4 #20) |
| Lectura estimada presentada como real | ⚠️ Parcial: el OCR lee "fecha estimada próxima lectura" como texto, pero `Reading` no distingue estimada de medida | Flag de origen del valor (M1 #7) |
| Constante o multiplicador mal aplicado | ⚠️ Se extrae `meterConstant` y nunca se aplica | Regla `(actual−anterior)×constante` (M4 #21) |
| Reliquidación o cobro retroactivo | ❌ | Regla de meses máximos y justificación (M4 #21) |
| Concepto cobrado dos veces en el período | ❌ | Regla de duplicados (M4 #19) |
| Intereses o repactación sin respaldo | ⚠️ El OCR extrae `interest` y `debtAgreement`; nadie los evalúa | Regla de cargos accesorios (M4 #19) |
| Redondeo "para facilitar el pago en efectivo" acumulado | ⚠️ Se extrae, no se evalúa | Regla de redondeo (M4 #19) |
| Período facturado con días de más o solapado | ❌ Y hoy se aceptan períodos solapados en el catálogo | Validar períodos (M1 #32) y regla de duración (M4 #19) |
| Salto de consumo o monto contra el año anterior | ⚠️ Sólo alerta contra el promedio propio; no hay serie interanual | Serie histórica (M5 #26) |
| Pago anterior no aplicado a la boleta | ❌ | Cotejar `lastPayment` con saldo (M2 #13) |

De catorce señales típicas, **cero se detectan de punta a punta** y cuatro se detectan a medias,
sin poder cuantificar la diferencia en pesos.

## 5. Defectos reproducidos

Estos no son hipótesis: se reprodujeron con peticiones HTTP reales.

| # | Severidad | Defecto | Evidencia |
| --- | --- | --- | --- |
| D1 | **S1** | Un período cerrado no bloquea una lectura que no declara período: responde **201** | `EntityFrameworkReadingWorkflow.cs:44-45`; contradice `DOMAIN.md` |
| D2 | **S1** | Se aceptan períodos de facturación solapados y una lectura puede caer en cualquiera | `Catalog.cs:126-134` |
| D3 | **S1** | El OCR corrompe números con punto decimal: `"8.80"` → **880**, `"0.5"` → **5** | `bill_models.py:28-32` |
| D4 | **S1** | Confirmar un OCR no es idempotente: un fallo intermedio duplica la lectura | `PostgresExtractionJobs.cs:103-104` |
| D5 | **S1** | El consumo decreciente devuelve **0** en el dominio, y hay tres fórmulas de consumo distintas | `Reading.cs:27-32`; reportes reimplementan |
| D6 | S2 | Medidor de agua acepta unidad `kWh` (201) y las unidades son texto libre | `Catalog.cs:102-124` |
| D7 | S2 | Un campo ausente en reportes web se muestra como **0** | `reports/api.ts:33` |
| D8 | S2 | Confirmar OCR permite elegir cualquier medidor y le impone su unidad | `DocumentDetailPage.tsx:89-97` |
| D9 | S2 | `/api/version` devuelve el stack trace al cliente | `VersionEndpoints.cs:30-35` |
| D10 | S3 | Los 400/404 se registran como **500** con stack, ensuciando Seq | `ApiExceptionMiddleware.cs:12-29` |
| D11 | S3 | Evidencia de una lectura inexistente responde `[]` en vez de 404 | `EntityFrameworkEvidenceRepository.cs:19-23` |
| D12 | S3 | Las alertas muestran promedios con 27 decimales y dependen de la cultura del host | `ReadingWorkflow.cs:52`, `Reading.cs:61` |
| D13 | S3 | Reportes y listas cargan todas las lecturas por request | `GetMonthlySummaryQuery.cs:18` |

Los cinco S1 deben resolverse antes de invitar a un solo usuario real: tres de ellos permiten
que un dato inválido entre al sistema y dos corrompen cifras en silencio.

## 6. Riesgos de confianza

Son los que más daño hacen al objetivo, porque el usuario deja de creer en la aplicación:

1. **Cifras que mienten por omisión.** Un total vacío se lee como cero; un consumo no
   calculable puede aparecer como `0` en el cliente.
2. **Dos formatos para el mismo número.** "1234.5" en el detalle y "1234,5" en el reporte.
3. **Unidades inconsistentes.** "m3", "m³" y "M3 " rompen la conciliación sin aviso.
4. **El OCR no ahorra trabajo.** La pantalla de confirmación arranca vacía: el usuario
   transcribe lo que el sistema ya leyó, y con eso se pierde la razón de tener OCR.
5. **Un OCR confirmado con el medidor equivocado** crea una lectura verosímil y falsa, que
   luego contamina el historial y las alertas.
6. **Sin distinción estimada/real**, el usuario no puede saber si el consumo que ve lo midió un
   aparato o lo supuso una empresa.

## 7. Fricción para la persona

Detectada en la auditoría del cliente web, ordenada por costo para el usuario:

| Fricción | Archivo |
| --- | --- |
| La confirmación OCR no aplica las propuestas extraídas | `DocumentDetailPage.tsx:33-38` |
| Adjuntar evidencia obliga a recorrer toda la bandeja, sin filtro | `ReadingEvidence.tsx:49-53` |
| El diálogo de evidencia conserva estado obsoleto al cerrar | `ReadingEvidence.tsx:66-71` |
| Listas de lecturas sin filtros de origen, estado ni fecha | `ReadingsPage.tsx:150-155` |
| El cierre de período no está disponible desde el directorio | `BillingPeriodsPage.tsx:49-53` |
| El 404 muestra "Próxima entrega" | `App.tsx:104-111` |
| Foco visible anulado tras navegar | `global.css:158-160` |
| Sin captura desde el teléfono | — |

## 8. Qué haría primero

**Esta semana (4 cambios pequeños, todos verificables):**

1. Corregir el parser de números (#36). Un importe mal leído destruye cualquier auditoría futura.
2. Bloquear la captura en períodos cerrados (#31) y los períodos solapados (#32).
3. Quitar el `default(0)` de los reportes (#4) y unificar el formato decimal (#5).
4. Precargar la confirmación OCR (#6): es la diferencia entre usar el OCR o transcribir a mano.

**Después, en orden:** boleta persistida (M2) → tarifas (M3) → reglas de auditoría (M4) →
expediente de reclamo (M5) → identidad y aislamiento (M6).

Sin M2 y M3 no hay auditoría posible; sin M4 no hay producto; sin M5 el usuario detecta pero no
puede actuar. Ese es el orden del [roadmap](ROADMAP.md).
