# Política de seguridad

## Alcance

EMeter es un **prototipo local**: no tiene autenticación, autorización ni aislamiento entre
usuarios. No debe exponerse a Internet. Los límites conocidos están documentados en
[docs/GAP-ANALYSIS.md](docs/GAP-ANALYSIS.md) y en la [wiki](https://github.com/cbinput/EMeter/wiki/Operacion).

Se consideran vulnerabilidades, entre otras:

- Ejecución remota de código o inyección en la API, el Worker o los parsers de boletas.
- Lectura o escritura de archivos fuera del almacenamiento previsto.
- Fuga de datos de otras personas una vez que exista multi-tenant.
- Exposición de secretos o credenciales en el repositorio o en los artefactos de CI.
- Un cálculo de dinero que pueda manipularse desde el cliente.

## Cómo reportar

Usa el **reporte privado de vulnerabilidades** del repositorio:
<https://github.com/cbinput/EMeter/security/advisories/new>.

Incluye: versión o commit, pasos para reproducir, impacto esperado y, si puedes, una prueba de
concepto. No abras un issue público con detalles explotables.

## Qué esperar

- Acuse de recibo en un plazo razonable; este es un proyecto personal, no un producto con SLA.
- Si el reporte se acepta, se corrige en `main` con una prueba de regresión y se publica un
  aviso de seguridad.
- Se reconoce públicamente a quien reporta, salvo que prefiera el anonimato.

## Fuera de alcance

- La ausencia de autenticación y de multi-tenant: está declarada y planificada (fase M6).
- Las contraseñas por defecto de `docker-compose.yml`: son para uso local y están documentadas
  como tales. Si las reutilizas en un entorno accesible, eso es el problema.
- Denegación de servicio contra una instancia local.
- Ingeniería social o acceso físico al equipo.

## Buenas prácticas para quien despliega

- No publiques la API ni el cliente en Internet antes de completar la fase M6.
- Cambia las credenciales de PostgreSQL y MinIO si el stack sale de tu equipo.
- Respaldar PostgreSQL y MinIO juntos: no hay transacción distribuida entre ambos.
