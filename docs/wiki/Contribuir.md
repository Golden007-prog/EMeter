# Contribuir

Es un proyecto abierto: se agradecen casos reales anonimizados, correcciones de cálculo, parsers
de nuevos proveedores y mejoras de accesibilidad.

## Antes de escribir código

1. Busca un issue abierto o crea uno con la plantilla correspondiente.
2. Si el cambio toca dinero, fechas o invariantes de dominio, discútelo en el issue antes de
   implementarlo.
3. Para empezar, revisa los issues con la etiqueta
   [`good first issue`](https://github.com/cbinput/EMeter/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

## Flujo

```powershell
git clone https://github.com/cbinput/EMeter.git
cd EMeter
git switch -c feat/mi-cambio
```

Un issue por rama (`feat/…`, `fix/…`, `chore/…`). Al terminar, abre el pull request con la
plantilla y enlaza el issue con `Closes #N`.

## Verificaciones

| Área | Comando |
| --- | --- |
| Backend | `dotnet build apps/api/CleanMinimalApi.sln` y `dotnet test` en los proyectos unitarios |
| OCR | `python -m unittest discover -s apps/api/services/ocr -v` |
| Frontend | `cd apps/web; npm run lint; npm run build; npm run test:unit; npm run check:e2e` |
| Integración | Proyectos `*.Tests.Integration` con Docker en ejecución |

No declares una verificación como aprobada si no la ejecutaste; el CI la va a repetir.

## Reglas del proyecto

- Nunca muestres un dato desconocido como cero.
- Un monto sin moneda no existe; un consumo sin unidad tampoco.
- El OCR propone, una persona confirma.
- Los períodos cerrados son inmutables.
- Sin secretos, sin boletas reales y sin direcciones de suministro en el repositorio.

## Datos y privacidad

Para reportar un caso, **anonimiza** la boleta: tapa nombre, dirección, número de cliente y
código de pago. Si necesitas compartir un documento completo, no lo subas al repositorio.

## Seguridad

Para vulnerabilidades, usa el
[reporte privado](https://github.com/cbinput/EMeter/security/advisories/new), no un issue público.
Detalles en [SECURITY.md](https://github.com/cbinput/EMeter/blob/main/SECURITY.md).

## Conducta

Al participar aceptas el
[código de conducta](https://github.com/cbinput/EMeter/blob/main/CODE_OF_CONDUCT.md).
