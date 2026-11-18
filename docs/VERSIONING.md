# Versionado y releases

El proyecto usa [Versionado Semántico 2.0.0](https://semver.org/lang/es/): `MAJOR.MINOR.PATCH`.

## Qué significa cada número

| Cambio | Versión | Ejemplos |
| --- | --- | --- |
| Incompatible: cambia el contrato de API, la forma de un dato persistido o un invariante de dominio | **MAJOR** | Renombrar un campo de `Reading`, cambiar el significado de `consumption` |
| Compatible: agrega capacidad sin romper lo existente | **MINOR** | Nuevo reporte, nuevo endpoint, una regla de auditoría, un parser de proveedor |
| Compatible: corrige un defecto | **PATCH** | Arregla el parser de números, redondeo, un 404 que debía ser 409 |

Mientras la versión sea `0.x` el proyecto está en prototipo: un cambio incompatible sube
**MINOR** (`0.1.0 → 0.2.0`) y se anota en el changelog como ruptura. La primera versión estable
será `1.0.0`, cuando exista auditoría de cobros con datos reales y `main` deje de ser un
prototipo de un solo usuario.

## Fuente de verdad

El **tag de git** es la fuente de verdad: `vMAJOR.MINOR.PATCH`, creado sobre `main`. La versión
se refleja además en:

- `apps/web/package.json` → `version`
- `apps/api/Directory.Build.props` → `<Version>`

Ambas deben coincidir con el tag. Si no coinciden, el release no se publica.

## Dónde se anota un cambio

Cada pull request agrega su entrada en [CHANGELOG.md](../CHANGELOG.md), dentro de la sección
`## [Unreleased]`, en una de estas categorías:

`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

El changelog se escribe para quien usa el proyecto, no para quien lo programó: «El parser ya no
convierte `8.80` en `880`», no «refactor de `chilean_number`».

## Flujo de un release

```powershell
# 1. main al día y CI en verde
git switch main; git pull

# 2. Mover Unreleased a la nueva versión en CHANGELOG.md y ajustar las dos versiones
#    (package.json y Directory.Build.props) en una rama y un PR.
git switch -c chore/release-0.2.0

# 3. Tras el merge, crear el tag anotado
git switch main; git pull
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0

# 4. Publicar el release con las notas del changelog
gh release create v0.2.0 --title "v0.2.0" --notes-file docs/releases/0.2.0.md
```

El release debe indicar: qué cambia, qué se rompe (si aplica), cómo migrar y qué se verificó.

## Pre-releases

Para una versión candidata: `v0.2.0-rc.1`, `v0.2.0-rc.2`. No se publican como `latest` y no
reemplazan a la estable anterior.

## Reglas

1. Un tag publicado no se mueve ni se borra: si algo salió mal, se publica `PATCH`.
2. `main` sólo recibe fusiones por pull request, con CI en verde y aprobación del mantenedor.
3. Ningún release se publica sin changelog y sin verificación ejecutada.
4. La versión mayor se decide por el contrato público (HTTP y datos), no por el tamaño del diff.
