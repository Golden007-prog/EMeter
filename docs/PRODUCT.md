# Producto · EMeter / UtilityMeter

## El problema

Una boleta de luz, agua o gas es un documento que casi nadie puede verificar. Trae decenas de
líneas, unidades que se confunden entre sí, lecturas estimadas presentadas como reales y
cargos cuyo nombre no explica nada. Cuando el monto sube, el usuario no tiene forma de saber
si consumió más o si le cobraron algo que no corresponde, y reclamar exige juntar evidencia que
no está a su alcance.

El resultado es una asimetría: la empresa tiene los datos y la norma; la persona tiene una
sospecha. **Nuestro objetivo es cerrar esa asimetría con datos y cuentas reproducibles.**

## Qué construimos

Una aplicación que:

1. **Registra la medición** del medidor (lectura manual o foto) y conserva la evidencia.
2. **Lee la boleta** (OCR con confirmación humana) y la convierte en datos estructurados:
   cargos, lecturas, potencias, períodos, totales.
3. **Audita la boleta** contra tarifas oficiales y contra el propio medidor, y emite hallazgos
   explicables: qué se esperaba, qué se cobró y cuánto es la diferencia.
4. **Prepara el reclamo** con un expediente que incluye el cálculo, las evidencias y el monto
   en disputa.

Lo que se vende no es la app: es la certeza de que el número que muestra se puede defender
frente al proveedor y frente al regulador.

## Personas

| Persona | Qué necesita | Cómo lo resuelve EMeter |
| --- | --- | --- |
| Residente | Saber si esta boleta está bien sin estudiar el pliego tarifario | Auditoría con diferencia en pesos y explicación en una frase |
| Administrador de condominio | Repartir el consumo del medidor principal entre submedidores sin subsidios cruzados | Conciliación existente, con trazabilidad de unidad y período |
| Dirigente vecinal | Probar un patrón de cobro en el barrio | Serie histórica y comparación entre suministros |
| Auditor o periodista | Reproducir un cálculo y citarlo | Expediente exportable con fuente de cada valor |

## Trabajos por resolver (jobs to be done)

1. Cuando llega la boleta, quiero saber **si pagué de más** y cuánto, sin ser experto.
2. Cuando el monto sube, quiero saber **si consumí más o me cobraron distinto**.
3. Cuando reclamo, quiero **un documento que no puedan desarmar**.
4. Cuando el reclamo no prospera, quiero **saber a quién escalar y con qué evidencia**.
5. Cuando administro un edificio, quiero **repartir el consumo sin inventar**.

## Principios de producto

1. **Nunca inventar un número.** Un dato desconocido se muestra como desconocido, nunca como cero.
2. **Mostrar la cuenta.** Cada monto esperado es reproducible a mano: tarifa, cantidad, unidad, fuente.
3. **Un hallazgo, una acción.** Detectar sin poder reclamar es entretención, no producto.
4. **El OCR propone, la persona confirma.** Automatizar la lectura, nunca la decisión.
5. **La evidencia es el activo.** Originales inmutables, con hash, ligados al hallazgo.
6. **Privacidad por diseño.** Boletas y direcciones son datos sensibles; se guardan para el usuario, no para el proveedor.
7. **La captura debe caber en un teléfono.** Si auditar una boleta cuesta 20 minutos, nadie audita la segunda.

## Alcance

**Dentro:** medición y consumo con evidencia; boleta estructurada; tarifas oficiales con
vigencia; auditoría por reglas; expediente y seguimiento de reclamo; operación local y
multiusuario.

**Fuera, por ahora:** pagos, cálculo de tarifas propias, asesoría legal, integración con
sistemas del proveedor, predicción de consumo con modelos, y cualquier cálculo que no se pueda
reconstruir con una fuente citable.

## Métricas de éxito

| Métrica | Objetivo inicial |
| --- | --- |
| Tiempo desde la foto de la boleta hasta ver un hallazgo | < 5 minutos |
| Boletas auditadas sin corregir un dato del OCR | > 70 % |
| Hallazgos con diferencia calculable frente al total de hallazgos | > 80 % |
| Reclamos con respuesta favorable o reajuste | medir desde la fase 5 |
| Precisión de los campos monetarios del OCR | > 99 % en total y cargos |
| Diferencia detectada acumulada | se reporta, no se promete |
