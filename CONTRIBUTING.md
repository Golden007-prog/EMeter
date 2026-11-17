# Cómo contribuir

## Requisitos

- .NET SDK 10 (`apps/api/global.json` fija la versión).
- Node.js 22.12 o superior.
- Python 3.12 para el servicio OCR y sus pruebas.
- Docker, sólo para PostgreSQL, MinIO, Worker y OCR.

## Flujo

1. Elige un issue del [tablero](https://github.com/cbinput/EMeter/projects) o crea uno con
   la plantilla correspondiente. Sin issue no hay rama.
2. Crea la rama desde `main`: `feat/<tema>`, `fix/<tema>` o `chore/<tema>`.
3. Implementa el cambio más pequeño que cumpla los criterios de aceptación.
4. Ejecuta las verificaciones del área (ver abajo) y pega los comandos en el PR.
5. Abre el pull request describiendo qué cambia, por qué y cómo se probó. Enlaza el issue
   con `Closes #N`.

## Verificaciones por área

| Área | Comando |
| --- | --- |
| Backend | `dotnet build apps/api/CleanMinimalApi.sln` y `dotnet test` en los proyectos unitarios |
| OCR | `python -m unittest discover -s apps/api/services/ocr -v` |
| Frontend | `cd apps/web; npm run lint; npm run build; npm run test:unit; npm run check:e2e` |
| Integración | Proyectos `*.Tests.Integration` con Docker en ejecución |
| Stack completo | `docker compose up -d --build` y `python apps/api/scripts/smoke.py --base http://localhost:8080` |

No declares una verificación como aprobada si no la ejecutaste.

## Estilo

- C#: `.editorconfig` de `apps/api`, nullable habilitado, Serilog con parámetros nombrados.
- TypeScript: Prettier + ESLint de `apps/web`, contratos validados con Zod.
- Documentación y mensajes de interfaz en español neutro; nombres de código en inglés.

## Seguridad y datos

- Este prototipo no tiene autenticación ni aislamiento de inquilinos: no lo expongas a
  Internet.
- No subas secretos, `.env`, volúmenes ni boletas reales. Usa los datos sintéticos del
  smoke test y de `apps/api/tests`.
