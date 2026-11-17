# Roadmap

El orden sigue la dependencia de datos: sin cifras confiables no se audita; sin boleta no hay
qué auditar; sin tarifa no hay precio esperado; sin reglas no hay hallazgo; sin expediente no
hay reclamo.

| Fase | Objetivo | Criterio de salida | Esfuerzo |
| --- | --- | --- | --- |
| **M0** | Monorepo, CI y documentación | `main` compila, CI verde, tablero publicado | 5 d · **hecho** |
| **M1** | Números confiables | Sin S1 abiertos; desconocido nunca es cero; unidades validadas | 21 d · **en curso** |
| **M2** | La boleta como dato | Cargar, ver y reabrir una boleta sin OCR | 15 d |
| **M3** | Tarifas oficiales | La boleta resuelve su tarifa o declara que no la tiene | 11 d |
| **M4** | Auditoría automática | Una boleta produce hallazgos con monto explicable | 22 d |
| **M5** | Reclamo y evidencia | Hallazgo → expediente PDF → reclamo con estado | 11 d |
| **M6** | Producto seguro | Dos organizaciones no se filtran; respaldo probado | 12 d |
| **M7** | Cobertura OCR y móvil | Precisión publicada; captura sin señal | 9 d |

Camino crítico: **M0 → M1 → M2 → M4 → M5 → M6**. M2 y M3 pueden ir en paralelo; M7 parte
cuando exista boleta persistida.

## Qué se arregla primero

Los cinco defectos S1 reproducidos en la auditoría:

1. Un período cerrado no bloquea una lectura sin período declarado (#31).
2. Se aceptan períodos solapados (#32).
3. El OCR corrompe números con punto decimal: `"8.80"` → `880` (#36).
4. Confirmar un OCR no es idempotente (#37).
5. El consumo decreciente devuelve `0` y hay tres fórmulas distintas (#34).

## Enlaces

- [Roadmap detallado](https://github.com/cbinput/EMeter/blob/main/docs/ROADMAP.md)
- [Backlog versionado](https://github.com/cbinput/EMeter/tree/main/docs/backlog)
- [Tablero](https://github.com/users/cbinput/projects/3)
- [Plan de ejecución con DeepSeek](https://github.com/cbinput/EMeter/blob/main/docs/DELIVERY-PLAN.md)
