# Ejecución

Requiere Docker para el stack completo; SDK .NET 10 y Python para desarrollo y pruebas.

```powershell
docker compose up -d --build
docker compose ps
```

- API y Swagger: http://localhost:8080/swagger
- Salud de API: http://localhost:8080/health
- MinIO: http://localhost:9001
- Seq: http://localhost:5341

PostgreSQL, MinIO, modelos OCR y Seq tienen volúmenes persistentes. `docker compose down` conserva los volúmenes; eliminarlos explícitamente elimina sus datos. Los puertos publicados se enlazan a localhost para el prototipo sin autenticación.

Configuración y flujo completo en [OCR](OCR.md). `.env.example` muestra las variables locales. La primera construcción de MinIO desde fuente y descarga de modelos Paddle pueden tardar varios minutos.

## Desarrollo .NET

```powershell
dotnet restore CleanMinimalApi.sln
dotnet build CleanMinimalApi.sln
dotnet test CleanMinimalApi.sln
```

La suite incluye un PostgreSQL temporal con Testcontainers; Docker debe estar disponible. Se puede ejecutar API sin infraestructura con `dotnet run --project src/Presentation` para pruebas manuales en memoria; ese modo no ofrece procesamiento OCR durable.

Para ejecutar API y Worker en el host contra servicios de Compose, configura en ambos procesos:

```powershell
$env:ConnectionStrings__UtilityMeter='Host=localhost;Database=utilitymeter;Username=utilitymeter;Password=utilitymeter-local'
$env:Storage__Endpoint='localhost:9000'
$env:Storage__AccessKey='utilitymeter'
$env:Storage__SecretKey='utilitymeter-local-secret'
$env:Ocr__BaseUrl='http://localhost:8090/'
```

OCR no publica puerto al host por defecto; publica 8090 mediante un override de Compose para esta modalidad. Inicia primero API para aplicar migraciones y crear bucket, después Worker. Los perfiles locales de API usan HTTPS 7032 y HTTP 5032. Dentro de contenedores se usa HTTP 8080; HTTPS debe terminarse en un proxy si se despliega fuera del equipo.

Las migraciones están en Infrastructure/Databases/UtilityMeter/Migrations. Para generar nuevas, usa dotnet-ef 10.0.11 contra Infrastructure (incluye factory de diseño). No uses EnsureCreated junto con migraciones.

## Actualizar esta versión

```powershell
docker compose up -d --build api worker
```

La API aplica FrontendWorkflows al arrancar. La migración agrega version, reviewStatus y ReadingRevisions y conserva lecturas y confirmaciones OCR previas. El historial comienza con las operaciones realizadas después de la actualización. No se eliminan registros ni volúmenes.

Los clientes existentes deben adaptar los GET de catálogos al sobre paginado con items y los POST a 201. Los errores son ProblemDetails; la confirmación OCR ya no pide id en el cuerpo. Los campos nulos se incluyen para mantener el contrato OpenAPI.

CORS permite localhost:5173 y 127.0.0.1:5173 por defecto; se reemplaza con Cors:AllowedOrigins. El alcance continúa siendo local de un usuario, sin autenticación.

## Frontend React

El frontend se mantiene en el repositorio separado `D:\coding\EMeter\monorepo\apps\web`. Desde esa carpeta, ejecutar `npm ci`, copiar `.env.example` a `.env` y ejecutar `npm run dev`. Abrir http://127.0.0.1:5173. El valor inicial de `VITE_API_BASE_URL` apunta a Compose (http://localhost:8080); con `dotnet run --project src/Presentation` desde este repositorio backend, cambiarlo a http://localhost:5032 y reiniciar Vite.

La primera entrega implementa lista y creación de propiedades. Desde UtilityMeterWeb, `npm run build` comprueba TypeScript y genera el build; `npm run test:e2e` inicia una API aislada en memoria y Vite para verificar el recorrido con Chromium, usando `../api/src/Presentation`. Requiere `npx playwright install chromium` una vez y los puertos 18080 y 5173 libres. Más instrucciones, alcance y limitaciones en [UtilityMeterWeb/README.md](../../web/README.md).

Con la API de Compose iniciada en 8080, ejecutar `npm run test:e2e:live` desde `D:\coding\EMeter\monorepo\apps\web` para comprobar integración y navegador sin escribir datos. `npm run test:e2e:live:write` agrega una propiedad `[E2E]` identificada en los artefactos. Estos modos solo requieren libre el puerto 5173 y no reinician el backend. Reportes y opciones en [el harness de UtilityMeterWeb](../../web/e2e/README.md).
