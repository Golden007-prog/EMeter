# Operación y desarrollo

[Índice](README.md) · [Ejecución](RUN.md)

## Compilación y pruebas

Desde la raíz:

```powershell
dotnet restore CleanMinimalApi.sln
dotnet build CleanMinimalApi.sln --no-restore
dotnet test CleanMinimalApi.sln --no-restore
```

| Proyecto de pruebas | Cobertura actual |
| --- | --- |
| `Application.Tests.Unit` | Entidades, cierre de períodos, validación de comandos, consumo/alertas, conciliación, versión y excepción de no encontrado |
| `Infrastructure.Tests.Integration` | Persistencia de lecturas y consulta por período usando EF Core InMemory |
| `Presentation.Tests.Unit` | Validador de GUID y endpoint de versión |
| `Presentation.Tests.Integration` | Endpoint de versión con `WebApplicationFactory` |

La integración actual no valida un servidor SQL, almacenamiento externo ni el flujo HTTP completo de lecturas/evidencias. Probar un validator directamente no comprueba que el endpoint lo ejecute.

Para ejecutar un proyecto específico:

```powershell
dotnet test tests/Application.Tests.Unit/Application.Tests.Unit.csproj
```

`Directory.Build.props` centraliza `net10.0`, nullable y rutas de salida. Compilación y archivos intermedios se generan bajo `artifacts/bin/{proyecto}` y `artifacts/obj/{proyecto}`.

## Diagnóstico

| Síntoma | Revisión |
| --- | --- |
| No se selecciona el SDK | Ejecutar `dotnet --list-sdks` y `dotnet --version` en la raíz; contrastar `global.json` |
| Error de certificado local | Ejecutar `dotnet dev-certs https --trust`; usar el puerto HTTPS del perfil |
| Reiniciar elimina lecturas/evidencias | Es el comportamiento de los proveedores InMemory; no existe recuperación persistente |
| El Worker no recibe trabajos de la API | Cada proceso tiene su propio Channel; no hay broker compartido ni productores en los handlers |
| No aparecen logs en consola | El sink Console está en el entorno `local`; verificar entorno y configuración de Serilog |
| Seq no recibe logs en contenedores | `localhost` apunta al contenedor actual; usar la dirección de Seq en una red compartida |
| Falla la carga multipart | Revisar la configuración antiforgery del endpoint `IFormFile`; ver [API](API.md) |
| Crear una lectura inválida no devuelve `400` | El validator del comando no está conectado al request HTTP |
| Conciliación falla con un GUID nuevo | No hay datos iniciales ni CRUD de condominios; el handler no convierte la ausencia a `404` |
| Compose rechaza la configuración | Hay una red referenciada sin definir; ver [RUN](RUN.md) |

La API registra propiedades y cabeceras de requests/responses con HTTP logging y eventos de Serilog. No tiene endpoint de health/readiness, métricas ni trazas distribuidas. `/api/version/` informa versiones del ensamblado; no verifica dependencias.

## Límites y trabajo pendiente

Estos puntos están presentes en el código actual y deben considerarse al extender o desplegar el servicio:

- **Durabilidad:** base, archivos y trabajos en memoria; no hay respaldo, restauración ni migraciones.
- **Concurrencia:** `DbContext` singleton compartido por requests; requiere revisar lifetimes para uso concurrente.
- **Acceso:** no hay autenticación, autorización ni aislamiento de acceso por organización. Swagger se publica en todos los entornos.
- **Validación:** validators de comandos sin conexión efectiva al flujo HTTP; faltan controles referenciales, de cronología, unidades y cierre de período.
- **Errores:** algunos endpoints devuelven detalles internos/stack traces en `ProblemDetails`; los reportes no tienen traducción uniforme de excepciones.
- **Evidencias:** configuración antiforgery incompleta, sin controles propios de formato/tamaño, sin endpoint de descarga y con un `Location` de carga que no tiene GET asociado.
- **Catálogos:** sin endpoints ni seed de organizaciones, propiedades, condominios, medidores y períodos. La conciliación necesita datos cargados desde código.
- **Reportes:** el resumen suma valores de lectura; la conciliación no implementa reparto monetario. Revisar [fórmulas](DOMAIN.md) antes de interpretar resultados como consumos o cobros.
- **Worker:** cola local sin productores actuales, reintentos ni recuperación de trabajos fallidos.
- **Despliegue:** revisar redes, puertos, HTTPS y destino Seq de Compose. La imagen final contiene solo la API.

OCR, extracción automática de boletas, integraciones con proveedores, dashboards, tarifas y facturación monetaria no están implementados.

## Automatización y archivos del template

`.github/workflows/build-pipeline.yml` declara análisis CodeQL, build/tests/cobertura mediante Docker, publicación de imagen y empaquetado/publicación NuGet del template. Las etapas de publicación dependen de secretos Docker/NuGet y de condiciones de rama. Esta configuración no demuestra que el pipeline esté operativo en este repositorio.

`CleanMinimalApi.sln`, los namespaces, etiquetas de Swagger/logging, `template/`, `.template_config/` y `NUGET.md` conservan referencias al template original. `NUGET.md` está vinculado al paquete en `template/template.csproj`; su propósito es el empaquetado legado, no la instalación de UtilityMeter. Eliminar ese mecanismo requiere ajustar también el workflow y el proyecto de empaquetado.

## Mantener esta documentación

Al cambiar una ruta o DTO, actualiza [API](API.md); para reglas o fórmulas, [DOMAIN](DOMAIN.md); para proveedores y dependencias, [ARCHITECTURE](ARCHITECTURE.md); para comandos y despliegue, [RUN](RUN.md). Mantén las limitaciones de esta guía alineadas con las correcciones reales y enlaza nuevas guías desde [el índice](README.md).
