# Operación

## Levantar el stack

```powershell
cd apps/api
docker compose up -d --build
```

Levanta API, Worker, PostgreSQL, MinIO, OCR y Seq. Swagger en
<http://localhost:8080/swagger>. La primera construcción descarga modelos de OCR y puede tardar
varios minutos.

Sin Docker, `dotnet run --project src/Presentation` usa persistencia en memoria: sirve para
desarrollo manual y **no** demuestra cola durable.

## Cliente web

```powershell
cd apps/web
npm ci
Copy-Item .env.example .env
npm run dev
```

`VITE_API_BASE_URL` apunta al backend sin `/api` final.

## Diagnóstico

| Síntoma | Qué revisar |
| --- | --- |
| La API no responde | `docker compose ps`; la API sólo escucha tras aplicar migraciones y preparar el bucket |
| Trabajos OCR atascados | `GET /api/extractions?status=Queued`; el lease dura 10 min y el Worker reintenta 3 veces |
| Un trabajo quedó `Failed` | Reintentar con `POST /api/extractions/{id}/retry`; no hace falta volver a subir el archivo |
| Errores 500 en Seq sin error real | Conocido: el middleware de excepciones registra 400/404 como 500 (issue #38) |
| Números raros en una boleta | Revisar `artifacts` y `warnings` del resultado OCR; el parser puede haber tomado un valor de otra página |

## Datos y respaldo

PostgreSQL y MinIO se respaldan **juntos**: no hay transacción distribuida y una interrupción
puede dejar un objeto huérfano. No borres los volúmenes si necesitas conservar la historia.

## Límites actuales

- Sin autenticación, autorización ni aislamiento de inquilinos: **no exponer a Internet**.
- Sin tarifas ni cálculo de montos: la auditoría de cobros aún no existe.
- Un solo parser de proveedor real (CGE).
- Shell del proyecto: `docs/OPERATIONS.md` y `docs/RUN.md` en `apps/api/docs/`.
