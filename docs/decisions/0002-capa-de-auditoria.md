# ADR 0002 · El dinero es una capa aparte

**Estado:** aceptado · 17 de noviembre de 2026

## Contexto

El dominio actual modela medición, consumo, alertas y conciliación. No tiene ningún tipo
monetario: `ExtractedCharge.Amount` es un string y nunca llega a persistirse. Para detectar
cobros irregulares hay que comparar lo facturado contra lo que debería facturarse.

La tentación evidente es agregar un campo `Amount` a `Reading` y calcular ahí el total. Eso
mezclaría dos cosas con ciclos de vida distintos: una medición se corrige o se anula; una
boleta emitida no cambia, se reclama.

## Decisión

Tres componentes separados dentro de `Application`, sin herencia ni dependencia circular:

| Componente | Sabe | No sabe |
| --- | --- | --- |
| `Billing` | Boleta, cargos, moneda, totales, período facturado | Qué es un consumo válido |
| `Tariffs` | Pliego vigente por proveedor, comuna y fecha; componentes y unidades | Si una boleta está mal cobrada |
| `Auditing` | Reglas que comparan facturado contra esperado y emiten hallazgos | Cómo corregir la boleta |

`Auditing` lee de `Billing`, `Tariffs` y del dominio de lecturas; nunca escribe en ellos.
Un hallazgo es un hecho con fecha y versión de reglas, no un estado de la boleta.

Cada importe es decimal con escala explícita (CLP sin decimales, consumo con dos), y la moneda
viaja con el monto: no existe un número de dinero sin moneda.

## Consecuencias

**A favor.** Corregir una regla no obliga a reescribir la boleta; reauditar no altera el
histórico de reclamos. Se pueden agregar reglas nuevas sin tocar medición. El expediente de
reclamo puede congelar los hallazgos con los que se presentó, aunque después cambien.

**En contra.** Más tipos y más pasos: crear una boleta no es crear un cargo en una lectura.
Requiere resolver la tarifa aplicable, que depende de datos externos (pliegos) que hoy no
existen. Es trabajo real, pero es exactamente el trabajo que constituye el producto.

## Reglas derivadas, obligatorias

1. Una regla de auditoría siempre declara tolerancia y unidad; sin eso no se emite hallazgo.
2. Un hallazgo sin dato suficiente se informa como "no evaluable" con el motivo, nunca como cero.
3. Reauditar no duplica hallazgos abiertos ni modifica reclamos ya presentados.
