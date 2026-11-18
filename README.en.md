# EMeter · UtilityMeter

[Español](README.md) · **English**

[![CI](https://github.com/cbinput/EMeter/actions/workflows/ci.yml/badge.svg)](https://github.com/cbinput/EMeter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)
[![Status: prototype](https://img.shields.io/badge/status-prototype-orange.svg)](docs/GAP-ANALYSIS.md)

A prototype for **auditing basic-utility bills**: it records water, electricity and gas meter
readings, reads the bill with OCR, computes consumption and reconciles apartment buildings.

The point is not measuring for its own sake: it is to let a person **check whether a bill
contains irregular charges and have what they need to complain**. Today the prototype covers
measurement; the money layer is planned and does not exist yet. See the
[gap analysis](docs/GAP-ANALYSIS.md) (Spanish).

## Current status

**Works and is tested**

- Readings with immutable evidence, versions, idempotency, review, correction and voiding.
- Five catalogs with detail, filters and pagination; billing periods with immutable closure.
- Bill OCR on a durable queue (PostgreSQL + Worker), human review and confirmation.
- Five reports: pending, missing, anomalies, monthly summary and building reconciliation.
- React client covering all six flows, with a 45-operation Playwright harness.

**Not built yet**

- Persisting the bill and its line items (they are discarded after review today).
- Official tariffs, monetary amounts and overcharge detection.
- Claim dossier and tracking.
- Authentication, multi-tenancy and data isolation.
- Unit conversion and more than one bill provider.

This is a **local, single-user prototype**: do not expose it to the Internet.

## Quick start

Requirements: Docker for the full stack, .NET SDK 10, Node.js 22.12+ and Python 3.12.

```powershell
# Full stack: API, Worker, PostgreSQL, MinIO, OCR and Seq
cd apps/api
docker compose up -d --build
# Swagger at http://localhost:8080/swagger

# Web client
cd apps/web
npm ci
Copy-Item .env.example .env
npm run dev            # http://127.0.0.1:5173
```

Without Docker, `dotnet run --project src/Presentation` starts in in-memory mode (no durable
Worker).

## Verification

```powershell
dotnet build apps/api/CleanMinimalApi.sln
dotnet test apps/api/tests/Application.Tests.Unit/Application.Tests.Unit.csproj
dotnet test apps/api/tests/Presentation.Tests.Unit/Presentation.Tests.Unit.csproj
python -m unittest discover -s apps/api/services/ocr -v
cd apps/web; npm run lint; npm run build; npm run test:unit; npm run check:e2e
```

`Infrastructure` integration tests use Testcontainers and require Docker.

## Structure

| Path | Contents |
| --- | --- |
| `apps/api/` | .NET 10 API, Worker, Infrastructure and the Python OCR service |
| `apps/web/` | React + TypeScript + Vite, Zod contracts and the E2E harness |
| `docs/` | Product, gaps, roadmap, architecture, delivery plan and ADRs |
| `docs/backlog/` | Versioned backlog: one file per phase, the source of the issues |
| `scripts/github/` | Idempotent sync of labels, milestones, issues and the project board |
| `.github/` | CI, issue forms and pull request template |

## Roadmap

| Phase | Goal | Effort |
| --- | --- | --- |
| M0 | Monorepo, CI and documentation | 5 days · **done** |
| M1 | Trustworthy numbers: no figure lies | 24 days · **in progress** |
| M2 | The bill as persisted data | 15 days |
| M3 | Official tariffs with validity periods | 11 days |
| M4 | Automatic audit with an amount in dispute | 22 days |
| M5 | Claim dossier and tracking | 11 days |
| M6 | Identity, multi-tenancy and operations | 12 days |
| M7 | Measured OCR coverage and mobile capture | 9 days |

Details, dependencies and exit criteria: [docs/ROADMAP.md](docs/ROADMAP.md).
How to execute it with agents: [docs/DELIVERY-PLAN.md](docs/DELIVERY-PLAN.md) (Spanish).

## Documentation

| Document | Contents |
| --- | --- |
| [Wiki](https://github.com/cbinput/EMeter/wiki) | Overview, real screenshots, architecture and operations |
| [Product](docs/PRODUCT.md) | Problem, personas, principles and metrics |
| [Gaps](docs/GAP-ANALYSIS.md) | What exists, what is missing and which defects were reproduced |
| [Roadmap](docs/ROADMAP.md) | Phases, dependencies, effort and exit criteria |
| [Architecture](docs/ARCHITECTURE.md) | Components, flows and persistence |
| [Delivery plan](docs/DELIVERY-PLAN.md) | Working with DeepSeek without losing quality |
| [Versioning](docs/VERSIONING.md) | Semantic versioning and release process |
| [Changelog](CHANGELOG.md) | What changed in each version |
| [Decisions](docs/decisions/) | ADRs: monorepo and the audit layer |

## How work happens

- `main` is protected: every change lands through a pull request with CI passing and a
  maintainer's approval. No direct pushes.
- Releases follow [Semantic Versioning](https://semver.org/); the changelog is updated in the
  same pull request.
- The plan lives in [`docs/backlog/`](docs/backlog/); `./scripts/github/sync.ps1` publishes it
  to GitHub. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Community

Open source: issues with anonymized real cases, calculation fixes and new provider parsers are
welcome.

- [Contributing](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md) and [private vulnerability report](https://github.com/cbinput/EMeter/security/advisories/new)
- [Application screenshots](https://github.com/cbinput/EMeter/wiki/Capturas)

## License

[MIT](LICENSE.md). Attribution of the original `CleanMinimalApi` template is preserved.
