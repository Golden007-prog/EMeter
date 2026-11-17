# Backlog · M0 Fundación del monorepo

Trabajo ya realizado para dejar el prototipo en un solo repositorio verificable.
Estos issues se crean cerrados: documentan la línea base y el punto de partida del tablero.

## [M0] Importar backend y frontend a un monorepo con historial
labels: type:task, area:infra, fase:0, prio:alta
effort: 2
milestone: M0 · Fundación del monorepo

**Contexto.** El backend (`cbinput/UtilityMeter`) y el frontend vivían en repositorios separados; el frontend no tenía remoto y su trabajo estaba sin commitear.

**Hecho.**
- `apps/api` y `apps/web` importados con `git subtree`, conservando los commits de ambos repositorios.
- Rutas cruzadas corregidas: harness E2E (`../api/src/Presentation`), Compose, `AGENTS.md` y documentación.
- `AGENTS.md` raíz con objetivo, mapa, comandos e invariantes.

**Verificación.** `git log` conserva el historial de ambos proyectos; `git ls-files` = 202 archivos de API y 78 de web.
