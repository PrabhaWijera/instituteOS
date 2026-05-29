# Changelog

All notable changes to NexClass / instituteOS are documented here.

This project follows [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions.

API changes follow the versioning contract defined in `docs/api-versioning.md`.

---

## [Unreleased]

### Added
- **Resilience**: Circuit breaker pattern for Groq AI and Cloudinary external services
- **Resilience**: `withRetry` utility with exponential back-off + jitter for transient failures
- **Resilience**: Bulkhead middleware — per route-group concurrency limiting (AI: 10, Upload: 5, General: 150)
- **Resilience**: Graceful Redis degradation — attendance OTP falls back to DB if Redis is unavailable
- **Database**: Connection pool configuration (`connection_limit=10`, `pool_timeout=30`) injected into `DATABASE_URL` at startup
- **Security**: Per-user Redis-backed rate limiting (`userRateLimit` middleware); AI route capped at 20 req/min per user
- **API**: Structured request/response logger with PII field redaction (replaces morgan)
- **API**: `Deprecation`, `Sunset`, and `Link` response headers on legacy `/api/*` routes; clients should migrate to `/api/v1/*`
- **Compliance**: `GET /api/v1/users/me/data-export` — GDPR Right to Access (Art. 15)
- **Compliance**: `DELETE /api/v1/users/me` — GDPR Right to Erasure (Art. 17)
- **Compliance**: `DELETE /api/v1/users/:id/data` (Super Admin) — admin-initiated data erasure
- **Compliance**: Nightly data retention worker (02:00 UTC) — purges AI chat history >1 yr, notifications >90 days, expired tokens/invites, soft-deleted users >2 yr, old attendance sessions >2 yr
- **DevOps**: CI/CD pipeline expanded with staging (develop branch) and production (main branch) deploy jobs
- **DevOps**: `.github/dependabot.yml` — weekly automated dependency updates for backend, frontend, and GitHub Actions
- **DevOps**: Husky pre-commit hooks enforcing lint-staged; `commit-msg` hook enforcing Conventional Commits format
- **Infrastructure**: `scripts/db-backup.sh` — automated pg_dump with gzip, S3 upload, integrity check, and log rotation
- **Infrastructure**: `infrastructure/terraform/main.tf` — complete AWS IaC: VPC, EC2 t3.small, RDS PostgreSQL 16, S3 backup bucket
- **Ops**: `docs/ops/runbook.md` — incident playbook covering 12 common failure scenarios

### Changed
- `GET /api/health` now returns `circuits` map with state of each circuit breaker; returns HTTP 207 when any circuit is OPEN
- `src/config/prisma.ts` — emits slow-query warnings (>500 ms) in development

### Security
- AI chat (`POST /api/v1/ai/chat`) now enforces per-user rate limit (20 req/min) in addition to IP-based limit

---

## [1.0.0] — 2026-01-01  *(initial release)*

### Added
- Multi-tenant institute management platform
- Roles: Super Admin, Institute Admin, Teacher, Student, Parent
- GPS + OTP attendance with haversine geofencing
- Real-time attendance board (WebSocket + Redis pub/sub)
- Student enrollment and automated billing worker (every 10 min)
- Fee payment workflow (UNPAID → PAYMENT_READY → PAID)
- AI tutor powered by Groq `llama-3.3-70b-versatile`
- Class materials (PDF upload via Cloudinary, video/live links)
- In-app notifications + email alerts
- Role-based access control with JWT (access + refresh token rotation)
- Login lockout after 5 failed attempts (Redis, 15-min window)
- Invite-based onboarding for teachers and parents
- Swagger API docs at `/api/docs`
- Full observability stack: Prometheus, Grafana, Loki, Jaeger, Alertmanager
- `GET /api/v1/*` versioned API (legacy `/api/*` aliases kept)

---

## API Versioning Policy

| Version | Status | Sunset |
|---------|--------|--------|
| `/api/v1` | **Current** | No planned sunset |
| `/api/*` (unversioned) | **Deprecated** | 2028-01-01 |

### Breaking change process

1. Introduce the new behaviour under `/api/v2/...`
2. Add `Deprecation: true` and `Sunset: <date>` headers to the old endpoint
3. Announce via email to institute admins at least **90 days** before sunset
4. Keep the old endpoint alive until the sunset date
5. Document the change in this CHANGELOG under `### Breaking` or `### Changed`

### Non-breaking changes (safe to ship at any time)
- Adding new optional request fields
- Adding new response fields
- Adding new endpoints
- Relaxing validation rules
- Bug fixes that preserve the documented contract

### Breaking changes (require new version)
- Removing or renaming fields
- Changing field types
- Changing HTTP method or status codes
- Adding required request fields
- Stricter validation

[Unreleased]: https://github.com/YOUR_ORG/nexclass/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/YOUR_ORG/nexclass/releases/tag/v1.0.0
