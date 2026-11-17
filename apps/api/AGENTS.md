# UtilityMeter Agent Instructions

## Scope and repository boundaries

- These instructions apply to this repository and its subdirectories. Follow any additional `AGENTS.md` instructions in the directory being changed.
- Work from `D:\coding\UtilityMeter` for backend changes: the .NET API, Worker, infrastructure, OCR service, backend tests, and validation scripts.
- The frontend is a separate repository at `D:\coding\UtilityMeterWeb`. Its application code, browser E2E harness, and browser artifacts belong there. Do not create a `frontend/` directory in this repository.
- Keep changes focused on the requested task and preserve unrelated work already present in the working tree.

## Project context and documentation

UtilityMeter records residential water, electricity, and gas meter readings, preserves supporting evidence, and calculates consumption, alerts, and condominium reconciliation. The current application is a local, single-user prototype without authentication or tenant isolation.

Read [.github/copilot-instructions.md](.github/copilot-instructions.md) for project conventions and architectural intent. Use the following documentation for the area being changed:

| Document | Purpose |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Project responsibilities, persistence, and asynchronous processing |
| [docs/DOMAIN.md](docs/DOMAIN.md) | Domain invariants, reading workflows, and report calculations |
| [docs/API.md](docs/API.md) | HTTP contracts, errors, serialization, and CORS |
| [docs/RUN.md](docs/RUN.md) | Local setup, configuration, and migrations |
| [docs/OCR.md](docs/OCR.md) | Evidence uploads, extraction jobs, and human confirmation |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Diagnostics and operational limitations |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Backend contracts supporting frontend workflows |

The Copilot instructions and `.github/plans/` include historical proposals and future goals. Check the current implementation and `docs/` before treating those proposals as implemented behavior or required work. In particular, the Worker already exists and OCR uses a durable PostgreSQL queue, not the legacy in-memory queue.

## Repository layout and architecture

| Path | Responsibility |
| --- | --- |
| `src/Application/` | Domain entities, feature-oriented commands and queries, MediatR handlers, validators, and interfaces |
| `src/Infrastructure/` | EF Core mappings and repositories, PostgreSQL migrations, MinIO storage, and extraction job persistence |
| `src/Presentation/` | Minimal API endpoints, HTTP contracts, serialization, OpenAPI, middleware, and dependency injection wiring |
| `src/Worker/` | Background job host dispatching Application commands |
| `services/ocr/` | Python OCR service and parser tests |
| `tests/` | .NET unit and integration tests |
| `scripts/` | Backend validation scripts, including the API/OCR smoke test |

- Preserve the modular monolith and existing project boundaries. Application owns the domain; do not introduce a separate Domain project or microservices without a task requiring that change.
- Keep endpoints and the Worker thin. Dispatch commands and queries through MediatR; place business logic in Application and persistence implementations in Infrastructure.
- Define infrastructure abstractions in Application. Keep implementation types internal where consistent with existing conventions; expose only the necessary wiring and contracts.
- Keep slow extraction work asynchronous. Preserve the durable job transaction, lease, retry, and idempotency behavior; an in-process queue cannot replace communication between the API and Worker.
- Preserve `CleanMinimalApi.sln` and the existing `CleanMinimalApi.*` namespaces unless renaming is explicitly part of the task.

## Domain invariants

- Keep measurement, consumption, billing, proration, and audit concepts separate. Current reconciliation is informational; monetary billing and proration are not implemented.
- Calculate consumption from consecutive active readings of the same meter and source. Do not mix sources or units, treat the first cumulative reading as consumption, or present unknown consumption as zero.
- Preserve immutable evidence originals in object storage with their metadata and hash in the database. Do not store file bytes in PostgreSQL.
- Closed billing periods are immutable. Reject operations that would alter their readings, evidence, or historical calculations.
- Preserve reading revisions, optimistic concurrency (`expectedVersion`), request idempotency, and transactional recalculation of affected histories.
- Rejected and voided readings do not contribute to active consumption chains or reports. Voiding is final; corrections require review again.
- Distinguish malformed input from business warnings. A valid but decreasing or unusually high reading is retained with an alert, rather than rejected solely for that anomaly.
- OCR proposes values and requires human confirmation before creating a reading. Repeated confirmation must not create duplicates.

## Coding and API conventions

- Target .NET 10 using the SDK selection in `global.json` and shared settings in `Directory.Build.props`. Follow `.editorconfig` and nearby code conventions, including nullable reference types.
- Use the existing MediatR and FluentValidation pipeline, AutoMapper patterns where applicable, and Serilog structured logging with named parameters.
- Use xUnit, Shouldly, and NSubstitute in .NET tests; do not introduce competing test libraries for routine changes.
- Keep HTTP contracts explicit and document endpoint summaries and response types in OpenAPI. Follow existing DTO and serialization patterns instead of exposing persistence implementation details.
- Preserve camelCase JSON, included null fields, ISO 8601 timestamps with offsets, and UTC persistence. Follow the existing ProblemDetails mapping for validation, missing resources, and conflicts.
- Preserve documented pagination, status codes, and idempotency contracts. Update `docs/API.md` and relevant workflow documentation when behavior changes.
- Configure CORS through `Cors:AllowedOrigins`. The default frontend origins are `http://localhost:5173` and `http://127.0.0.1:5173`; see `docs/API.md` for the full policy.

## Build, run, and validate

Run commands from the backend repository root in PowerShell. Development requires the .NET 10 SDK; OCR tests and smoke scripts also require Python. PostgreSQL integration tests use Testcontainers and require Docker.

```powershell
dotnet restore CleanMinimalApi.sln
dotnet build CleanMinimalApi.sln
dotnet test CleanMinimalApi.sln
```

For focused unit checks without the PostgreSQL integration suite:

```powershell
dotnet test tests/Application.Tests.Unit/Application.Tests.Unit.csproj
dotnet test tests/Presentation.Tests.Unit/Presentation.Tests.Unit.csproj
```

For changes to the OCR parser:

```powershell
python -m unittest discover -s services/ocr -v
```

For manual API development or the complete persistent stack:

```powershell
dotnet run --project src/Presentation
docker compose up -d --build
```

The standalone API falls back to in-memory persistence and storage when external services are not configured; that mode does not provide durable Worker processing. Compose runs the persistent stack and exposes Swagger at `http://localhost:8080/swagger`.

With the full stack running, `python scripts/smoke.py --base http://localhost:8080` checks the API/OCR workflow. It creates records and uploads evidence; use an appropriate test instance.

- Run checks appropriate to the changed behavior. Add regression coverage for business rules, API contracts, or persistence behavior when affected. Documentation-only changes do not require the application test suite.
- Use PostgreSQL integration tests for transaction, concurrency, migration, and durable queue behavior; in-memory tests cannot establish those guarantees.
- Report what changed, which checks ran, and any checks that could not run. Do not report unexecuted checks as passing.

## Persistence and configuration

- Keep EF Core migrations under `src/Infrastructure/Databases/UtilityMeter/Migrations`. Follow the design-time factory and migration tooling documented in `docs/RUN.md`; do not mix `EnsureCreated` with migrations.
- API startup applies migrations and prepares the storage bucket. Start it before the Worker when running hosts separately; both need matching PostgreSQL and MinIO configuration.
- Use `.env.example` and existing configuration conventions for local setup. Do not commit secrets or real evidence files.
- Preserve PostgreSQL and MinIO data when changing the stack. Do not delete persistent volumes as a routine build, test, or troubleshooting step.
