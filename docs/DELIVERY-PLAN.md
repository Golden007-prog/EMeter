# Plan de ejecución con DeepSeek

Objetivo: recorrer 106 días-persona de trabajo con una persona y un agente, sin rehacer lo
hecho y sin que la calidad dependa de la suerte del prompt.

## 1. La idea

El agente no reemplaza el criterio: **acelera la ejecución de decisiones ya tomadas**. La
inversión rinde cuando el trabajo está partido en unidades pequeñas con criterio de aceptación
verificable, y se desperdicia cuando se le pide "hazme el módulo de auditoría".

Tres reglas gobiernan el plan:

1. **Un issue, una sesión.** Contexto acotado, resultado verificable, commit propio.
2. **La prueba es el contrato.** El criterio de aceptación se escribe antes de pedir el código;
   si no se puede comprobar, el issue no está listo.
3. **La documentación es caché.** `AGENTS.md` y `docs/` bien mantenidos son lo que evita pagar
   el mismo contexto en cada sesión.

## 2. Enrutamiento por tipo de tarea

No todas las tareas merecen el modelo más caro ni el mismo esfuerzo de razonamiento.

| Tipo de tarea | Modelo sugerido | Esfuerzo | Por qué |
| --- | --- | --- | --- |
| Diseño de reglas de auditoría, tarifas, migraciones | Razonador (mayor capacidad) | Alto | Un error de lógica aquí se propaga a todo el producto |
| Depuración de defectos sutiles (D1–D5 del análisis) | Razonador | Alto | Requiere leer código y reproducir, no autocompletar |
| Contratos de API, migraciones EF, validadores | Razonador o general | Medio | Precisión sobre creatividad |
| CRUD, pantallas, tests repetitivos, fixtures | General o rápido | Bajo | Trabajo mecánico con patrón establecido |
| Documentación, renombres, limpieza | Rápido | Bajo | No requiere razonamiento profundo |
| Auditorías de solo lectura (revisar un módulo) | Subagente en paralelo | Medio | Aísla contexto y no contamina la sesión principal |

Regla práctica: si el issue toca dinero, fechas o invariantes de dominio, sube de nivel. Si
toca presentación o texto, baja.

## 3. Estructura de una sesión

```text
1. Contexto   AGENTS.md raíz + el AGENTS.md del área + docs del área + los 2-3 archivos que se tocan.
2. Encargo    El issue completo, con criterios de aceptación y "fuera de alcance".
3. Ejecución  Cambio mínimo; el agente corre build y pruebas antes de decir que terminó.
4. Verificación La persona revisa el diff y ejecuta la prueba de aceptación.
5. Cierre     Commit con el número de issue; el tablero se mueve solo al cerrar.
```

Lo que **no** se hace: pedir varios issues a la vez en la misma sesión, aceptar "compila" como
sinónimo de "funciona", ni permitir que el agente invente requisitos.

## 4. Presupuesto

Orden de magnitud para planificar, no una factura:

| Fase | Sesiones estimadas | Contexto por sesión | Nota |
| --- | --- | --- | --- |
| M1 (defectos + confianza) | 10-12 | 40-80k tokens | Trabajo quirúrgico, mucho archivo pequeño |
| M2 (boleta) | 8-10 | 60-120k | Migración + endpoints + UI |
| M3 (tarifas) | 6-8 | 50-100k | Depende del spike de fuentes |
| M4 (auditoría) | 12-14 | 80-150k | La fase más cara: reglas y pruebas exhaustivas |
| M5 (reclamo) | 6-8 | 60-100k | PDF y flujo de estados |
| M6 (seguridad) | 6-8 | 100-150k | Toca todo el backend |
| M7 (OCR y móvil) | 5-6 | 50-100k | Evaluación con corpus real |

Dos economías concretas:

- **Caché de contexto.** Mantener `AGENTS.md` y los índices de `docs/` al día reduce el contexto
  inicial de cada sesión. Releer 40 KB de documentos en cada turno es el mayor gasto evitable.
- **Paralelización con subagentes.** Las auditorías de solo lectura (como las dos que produjeron
  este análisis) van en subagentes: consumen su propio contexto y devuelven un resumen de 100
  líneas en lugar de 40 KB de código leído.

## 5. Cadencia

Semana tipo, con una persona a tiempo parcial:

| Día | Trabajo |
| --- | --- |
| Lunes | Revisar tablero, elegir 2 issues, escribir criterios de aceptación si faltan |
| Martes-Jueves | Ejecutar un issue por día con el agente; CI en verde antes de pasar al siguiente |
| Viernes | Revisar deuda, actualizar `docs/`, ajustar el roadmap y el backlog |

Un issue por día es un ritmo sostenible para issues de 1-3 días-persona, porque el agente
reduce el trabajo mecánico, no el de decidir ni el de revisar.

## 6. Guardrails

Estas reglas existen porque el costo de un error en un producto de dinero es asimétrico:

1. **Ninguna regla monetaria sin prueba de caso límite** (redondeo, tolerancia, moneda, unidad).
2. **Nunca relajar un invariante para que pase una prueba.** Si el período cerrado estorba, el
   diseño está mal, no la regla.
3. **Sin dependencias nuevas sin justificación escrita** en el issue o en un ADR.
4. **Sin migraciones destructivas** ni `EnsureCreated` mezclado con migraciones.
5. **Sin secretos, boletas reales ni datos personales** en el repositorio; los corpus van fuera
   con hash de referencia.
6. **Sin refactors grandes mezclados con features.** Un diff debe poder revertirse sin perder
   trabajo no relacionado.
7. **El agente declara lo que no verificó.** "No ejecuté las pruebas de integración porque
   requieren Docker" es una respuesta válida; "todo pasa" sin evidencia, no.

## 7. Cómo medir el retorno

| Señal | Meta |
| --- | --- |
| Issues cerrados por semana | ≥ 3 en M1-M2, ≥ 2 en M4 |
| Retrabajo (issue reabierto o PR corregido dos veces) | < 20 % |
| Defectos escapados a `main` | 0 por fase |
| Tiempo de revisión humana por issue | < 30 minutos |
| Costo por issue | se mide y se compara entre fases |

Si el retrabajo sube, el problema casi nunca es el modelo: es un criterio de aceptación vago.

## 8. Riesgos de la inversión

| Riesgo | Señal temprana | Mitigación |
| --- | --- | --- |
| Sobreconfianza en el código generado | Pruebas verdes y comportamiento incorrecto | Criterio de aceptación observable, no "compila" |
| Pérdida de coherencia arquitectónica | Aparecen capas nuevas sin ADR | Revisar diffs por arquitectura, no sólo por tests |
| Contexto insuficiente | El agente inventa endpoints o campos | Enlazar archivos exactos en el encargo |
| Costo creciente por sesión | Sesiones de 200k+ tokens | Partir el issue; cachear documentación |
| Deuda de pruebas | Cobertura plana con más features | Cada regla nueva entra con su prueba |

## 9. Plantilla de encargo

```text
Issue #<n>: <título>

Contexto mínimo
- apps/api/AGENTS.md, docs/DOMAIN.md, docs/API.md
- Archivos: <rutas exactas>

Qué hacer
<dos o tres frases, sin ambigüedad>

Criterios de aceptación
<los del issue, copiados>

Fuera de alcance
<lo que no debe tocarse>

Verificación
Ejecuta: <comandos>. Reporta el resultado real, incluido lo que no pudiste ejecutar.
```

El "fuera de alcance" es la parte que más discusiones evita.

## 10. Primer sprint (semana 1)

Ordenados por riesgo, no por facilidad:

| Día | Issue | Por qué primero |
| --- | --- | --- |
| 1 | #36 El parser no debe corromper números | Un importe mal leído invalida toda auditoría futura |
| 2 | #31 Período cerrado bloquea toda captura | Es el invariante más caro y hoy está roto |
| 3 | #32 Rechazar períodos solapados | Dos períodos reclamando la misma lectura rompe el cierre |
| 4 | #4 Desconocido ≠ cero y #5 formato decimal | Barato, muy visible, sostiene la confianza |
| 5 | #6 Precarga del OCR | Convierte el OCR en ahorro de trabajo real |
| 6 | Cierre de semana: correr CI completo, actualizar `docs/`, revisar tablero | — |

Al terminar la semana, el sistema no audita cobros todavía, pero **deja de mentir**. Ese es el
requisito para que todo lo demás tenga valor.
