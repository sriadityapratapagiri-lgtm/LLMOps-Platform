# Inference LLMOps --- Production Completion Guide

**Purpose:** This is the execution guide for the coding agent
responsible for finishing, validating, and deploying the existing
Inference LLMOps project end-to-end.

**Desired outcome:** A publicly accessible website with a working
frontend, securely configured backend API, persistent storage
appropriate for the chosen platform, and working model registry,
playground/inference, request logs, and metrics. Other UI sections must
either work end-to-end or be clearly marked as planned---not fake
working functionality.

**Execution rule:** Inspect first, preserve existing work, implement
incrementally, verify every phase, and keep this document updated. Do
not stop after writing a plan. Continue until the product is deployable
or a concrete external blocker (credentials, account access, billing
approval, or user decision) prevents progress. Never claim deployment
succeeded unless the live URL has been tested.

## 1. Actual repository layout

The repository root is expected to contain:

``` text
LLMops/
├── production.md
├── interface-backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── inference.py
│   │   ├── model_registry.py
│   │   └── schemas.py
│   ├── tests/test_inference.py
│   ├── .venv/              # WSL/Linux environment; not Windows-compatible
│   ├── inference.db        # Local development DB; do not commit
│   └── ...
└── interface_frontend/
    ├── src/
    │   ├── components/
    │   ├── routes/
    │   ├── lib/
    │   │   ├── api-client.ts
    │   │   ├── config.ts
    │   │   ├── data.ts
    │   │   ├── demo-data.ts
    │   │   └── formatters.ts
    │   └── types/api.ts
    ├── package.json
    ├── .env.example
    └── ...
```

This layout comes from the developer's inspection. Treat the checked-out
repository as authoritative and verify actual paths before using
commands.

## 2. Product scope and honest behavior

Inference is an LLMOps control panel. The Lovable-generated frontend
reportedly uses TanStack Start, React, TypeScript, and Vite. The backend
uses Python/FastAPI, SQLite, and a mock inference provider.

### Required end-to-end functionality

1.  **Dashboard (`/`)** --- summary cards, registered models, and recent
    requests populated by the live API. Clearly identify demo fallback
    data.
2.  **Model Registry (`/models`)** --- list, register, validate, show
    success/errors, and navigate to model details.
3.  **Model Details (`/models/$id`)** --- show actual model metadata. Do
    not invent endpoint URLs, versions, or deployment status.
4.  **Playground (`/playground`)** --- submit a prompt to a selected
    registered model and display the result, request ID, status,
    latency, and estimated token counts.
5.  **Request Logs (`/requests`)** --- implement the route with real
    request history, pagination, status, latency, model details, and
    useful empty/error states.
6.  **Metrics (`/metrics`)** --- implement the route using actual
    aggregates and real time-series data only. Never fabricate chart
    points.
7.  **Evaluations (`/evaluations`)** --- implement a real, persisted,
    tested evaluation workflow if feasible; otherwise clearly mark it as
    planned and do not display fake scores.
8.  **Deployments (`/deployments`)** --- implement real deployment
    behavior only when a runtime/provider and lifecycle semantics exist.
    Otherwise make it clear that deployment is planned or metadata-only.
9.  **Settings (`/settings`)** --- expose only working settings; do not
    add fake authentication, secrets storage, or inert toggles.

The minimum complete product flow is **dashboard → model registry →
register model → playground inference → request logs → metrics**. Other
sections must be functional or honestly marked as not yet available.

### Critical limitations

-   The current inference provider is mock/simulated, not a real
    language model.
-   Token counts are word-count estimates, not tokenizer-derived values.
-   Measured latency is mock-function execution time, not real
    model-serving latency.
-   A model registry record does not mean a model is loaded or deployed.
-   Do not imply real GPU inference, production deployment, or real
    token accounting unless implemented and verified.
-   Do not send prompts or user data to an external provider unless one
    has been intentionally configured and documented.

## 3. Known backend issues and frontend mismatches

The backend reportedly exposes these routes; verify each in
`interface-backend/app/main.py` and `/docs`:

-   `GET /`
-   `GET /health`
-   `POST /api/v1/inference`
-   `GET /api/v1/requests?limit=...&offset=...`
-   `GET /api/v1/metrics`
-   `GET /api/v1/models`
-   `GET /api/v1/models/{model_id}`
-   `POST /api/v1/models`

Known issues found during inspection:

1.  `main.py` referenced `sqlite3.IntegrityError` without importing
    `sqlite3`, causing `NameError` on duplicate model registration.
2.  `@app.post("/api/v1/inference")` reportedly appeared multiple times
    around lines 45--58. Remove accidental duplicates while retaining
    exactly one correct route.
3.  Registration tests use hardcoded IDs with persistent SQLite, so
    repeated runs may fail.
4.  Frontend types in `src/types/api.ts` describe richer model records
    (`id`, `displayName`, `modelIdentifier`, `endpointUrl`,
    `latestVersion`, `activeVersion`, `versions[]`, `tags[]`) than the
    backend's minimal record (`model_id`, `model_version`, `provider`,
    `status`, `description`, `created_at`).
5.  Frontend API calls reportedly reference endpoints not yet
    implemented, such as `/api/v1/metrics/summary`,
    `/api/v1/metrics/timeseries`, `/api/v1/evaluations`,
    `/api/v1/deployments`, and `/api/v1/requests/{id}`.
6.  `src/lib/data.ts` uses a `withFallback` pattern, so the interface
    may show demo data when the backend is unavailable. The UI must
    visibly disclose whether it is in live, demo, or offline/error mode.
7.  `.venv` is a WSL/Linux environment (`bin/`, not `Scripts/`). Use WSL
    or create a separate environment for Windows; don't run the Linux
    venv directly from PowerShell.

## 4. Non-negotiable engineering rules

-   Do not rebuild the project from scratch.
-   Inspect existing code and UI before editing.
-   Preserve the Lovable design and working components.
-   Make small, coherent changes and test them.
-   Avoid whole-file rewrites unless justified.
-   Keep local development lightweight for an 8 GB RAM laptop without a
    usable GPU.
-   Never commit `.env`, secrets, API keys, private data, or the local
    SQLite database.
-   Do not claim tests/builds/integrations/deployment succeeded unless
    verified.
-   Do not silently fall back to demo data while presenting it as live.
-   Keep TypeScript contracts consistent with actual backend contracts.
-   Do not delete user data or reset the developer's local database to
    make tests pass.
-   Keep a root README with setup, architecture, test, environment, and
    deployment instructions.
-   Do not expose stack traces or secrets in API errors.
-   Before public deployment, address persistence, CORS, logs, and
    access/security risks.

## 5. Phase 0 --- Establish baseline

1.  Inspect root directory, Git status, ignored files, README files,
    manifests, lockfiles, and environment examples.
2.  Read backend files: `main.py`, `database.py`, `inference.py`,
    `model_registry.py`, `schemas.py`, and all tests.
3.  Read frontend `package.json`, `src/types/api.ts`,
    `src/lib/api-client.ts`, `src/lib/config.ts`, `src/lib/data.ts`,
    `src/lib/demo-data.ts`, and all route files.
4.  Confirm the package manager from the lockfile. The frontend
    reportedly uses Bun; don't create a second lockfile.
5.  Identify actual scripts and dependency versions.
6.  Run backend tests and frontend typecheck/build using the correct
    environment.
7.  Start both apps locally and record baseline errors.
8.  Summarize verified findings, then continue to fixes; don't stop at a
    plan.

Example commands (adjust to actual manifests):

``` bash
# In WSL, from repository root
cd interface-backend
source .venv/bin/activate
python -m pytest -v
uvicorn app.main:app --reload

# In another terminal
cd interface_frontend
bun install --frozen-lockfile
```

Inspect `package.json` before choosing `bun run dev`, build, typecheck,
or lint scripts. If Bun is unavailable, report the blocker and use a
compatible approach without corrupting lockfiles.

## 6. Phase 1 --- Stabilize backend

### Route and import fixes

-   Add `import sqlite3` in `main.py` if it uses
    `sqlite3.IntegrityError`.
-   Ensure exactly one `@app.post("/api/v1/inference")` route exists.
-   Verify model registration returns `201 Created`.
-   Verify duplicate IDs return `409 Conflict`.
-   Verify unknown models return `404`, invalid input returns `422`, and
    expected failures return safe structured errors.

### Reliable tests

Tests must be repeatable without deleting or altering the developer's
real `inference.db`.

Preferred approach: - Refactor database setup to support an injectable
temporary SQLite path for tests. - Initialize the schema in the test
database. - Isolate state per test or clean only rows created by that
test. - Preserve the production/default database configuration. - Unique
IDs may help but should not replace isolation. - Run the test suite at
least twice consecutively.

Test successful inference, validation, unknown models, request
persistence, failure logging, pagination, metrics matching the database,
model listing/details, successful registration, duplicate registration,
and repeated runs. Do not weaken assertions to force a green suite.

### Database configuration and persistence

-   Support a documented database path/URL environment variable with a
    sensible local default.
-   Ensure the database directory exists.
-   Use parameterized SQL and correct connection handling.
-   Do not assume SQLite data on an ephemeral deployment filesystem
    survives restarts.
-   For a single-instance app with a persistent disk, SQLite may be
    acceptable. For multiple instances or more robust production, prefer
    managed PostgreSQL.
-   Provide a repeatable schema initialization/migration strategy.
-   Do not commit local request prompts or the SQLite database.

### CORS, health, errors, and logging

-   Configure FastAPI CORS for actual frontend origins, using
    environment configuration.
-   For local development, support the real dev origin (often
    `http://localhost:5173`, but verify the port).
-   Do not combine wildcard origins with credentials.
-   Verify health/readiness endpoints.
-   Keep API response/error shapes consistent.
-   Validate external inputs with Pydantic.
-   Log internal diagnostic details server-side, but don't return stack
    traces.
-   Avoid logging raw prompts by default in production unless
    deliberately configured and documented.

## 7. Phase 2 --- Reconcile the API contract

Inspect every call in `src/lib/api-client.ts` and `src/lib/data.ts`.
Build a small contract table containing method, URL, request shape,
expected response, actual backend response, and the chosen fix.

Prefer a **frontend adapter** to minimize unnecessary backend changes:
keep the existing backend contract and map responses to UI view models
in one place. Alternatively, create explicit Pydantic DTOs if richer
backend responses are genuinely needed. Document the choice.

Safe mapping examples: - `model_id` may map to UI `id`. -
`model_version` may map to a displayed version. - `displayName` may be a
presentation fallback derived from an ID. - Do not invent `endpointUrl`,
`activeVersion`, `versions[]`, or deployment health. - Unknown provider
strings should be handled explicitly, not silently mislabelled.

For missing frontend endpoints, either update the client to use
equivalent existing endpoints or add compatibility endpoints with tests.
Don't create duplicate routes without a clear reason.

Core contract to verify: - `GET /api/v1/models` -
`GET /api/v1/models/{model_id}` - `POST /api/v1/models` -
`POST /api/v1/inference` - `GET /api/v1/requests?limit=N&offset=N` -
`GET /api/v1/metrics`

Document payloads, response fields, status codes, and error shapes. Add
response models where useful.

## 8. Phase 3 --- Integrate frontend

### API client

-   Centralize network logic in `src/lib/api-client.ts` or the existing
    equivalent.
-   Use `VITE_API_BASE_URL` from the existing `.env.example`.
-   Normalize base URL joins.
-   Use typed request/response contracts.
-   Parse errors safely and support cancellation/timeouts where useful.
-   Don't silently swallow API failures and substitute demo data without
    identifying the mode.

### Live, demo, and offline states

-   **Live:** request succeeded; show actual backend data.
-   **Demo:** fallback data is displayed; show a visible demo
    badge/notice.
-   **Offline/error:** API failed and no live data is available; provide
    retry/helpful status.
-   Never combine real and demo data in the same chart/table without
    clearly identifying each source.

### Routes

Existing routes reportedly include `/`, `/playground`, `/models`, and
`/models/$id`. Verify and implement `/requests`, `/metrics`,
`/evaluations`, `/deployments`, and `/settings`.

Inspect TanStack's file-based routing convention. If route trees are
generated, use the configured generation process rather than manually
editing generated files.

### UX quality

Each core page should have loading, empty, success, validation, and
error states as appropriate. Disable submissions while pending, avoid
duplicate submissions, provide accessible labels/keyboard use, preserve
responsive styling, handle long prompts/output, and format dates
consistently. Label latency and token counts as simulated/estimated for
the mock provider.

### Browser integration tests

Verify: 1. Dashboard loads real API data. 2. Registry lists
`mock-model-v1`. 3. A new model registers and appears. 4. Duplicate
registration shows a useful conflict message. 5. Playground submits a
prompt and displays the result. 6. The request appears in history. 7.
Metrics reflect new requests. 8. Demo/offline state is clearly
disclosed. 9. No navigation link leads to a missing or blank route. 10.
No uncaught browser errors, failed critical requests, or hydration
errors remain.

## 9. Phase 4 --- Feature completeness

Prioritize the core product before advanced features.

### Evaluations

Only implement if real and testable: define evaluation inputs, persisted
runs/results, scoring semantics (deterministic, rule-based, or
model-judged), API endpoints, history UI, and tests. Otherwise provide
an honest planned page; never show fake evaluation scores.

### Deployments

Real deployment requires a target runtime/provider, a deploy action,
lifecycle status, logs/errors, and health checks. If no runtime exists,
keep it explicitly planned or metadata-only. A registry record is not a
deployment.

### Authentication and public access

Before public exposure of registration, inference, logs, and metrics,
assess authentication, rate limiting, and tenant isolation. Do not
expose sensitive prompts/logs to anonymous users. For a public portfolio
demo, minimize stored data, avoid logging sensitive prompts, apply
reasonable rate limits if supported, and document limitations. Don't
invent nonfunctional authentication.

## 10. Phase 5 --- Deploy to production

The hosting target has not been specified. Inspect the actual framework
and choose compatible, affordable hosting based on runtime and
persistence requirements. Do not assume the user has accounts, secrets,
or billing configured. Continue all work that doesn't require them and
ask only for the specific action when blocked.

### Architecture choice

A likely arrangement is: - Frontend on a host compatible with the
TanStack Start app's actual build/runtime. - Backend on a Python
ASGI-capable service running Uvicorn. - Database on a persistent disk
for single-instance SQLite, or managed PostgreSQL for
multi-instance/reliable production.

TanStack Start may require server runtime support; don't assume it is a
static Vite SPA. Inspect its adapter and build output before choosing
the frontend host. Do not store the backend database in the frontend
deployment or rely on ephemeral disk.

### Backend deployment checklist

-   Use a suitable dependency manifest with controlled versions.
-   Configure the ASGI start command.
-   Configure database path/URL, allowed CORS origins, logging level,
    and optional provider through environment variables.
-   Store credentials in platform secrets.
-   Configure health checks and persistent storage.
-   Add request size/time limits and rate limiting where supported.
-   Decide whether public API docs should be enabled.
-   Ensure logs/errors don't expose credentials or prompts.
-   If using SQLite, verify persistence and concurrency; prefer
    PostgreSQL for multiple instances.

### Frontend deployment checklist

-   Set `VITE_API_BASE_URL` to the production API URL/path.
-   Ensure the host runtime matches TanStack Start's build requirements.
-   Set production CORS to the exact deployed frontend origin.
-   Keep secrets out of browser-exposed variables.
-   Ensure no production bundle contains an unintended localhost URL.
-   Verify deep-link refresh for all implemented routes.

### CI and builds

Add a lightweight CI workflow if appropriate: - backend tests; -
frontend typecheck/lint/build; - locked dependency installation; - check
that `.env` and local database files are not committed.

Run tests locally as well; CI is not a substitute.

### Live deployment acceptance

Deployment is not complete until verified on the real public URL: -
HTTPS homepage loads. - Nested routes load and refresh. - Frontend
reaches the deployed API and CORS works. - Listing/registering models
works. - Inference works and creates a log entry. - Metrics reflect real
requests. - Persistence behaves as documented after a backend
restart/redeploy. - No secrets are exposed in bundles, logs, or
repository. - Core flows work without local development services. -
Final URLs and remaining limitations are documented.

Never state a URL is deployed unless you deployed and tested it. If
account login, domain setup, billing, or secrets require user action,
finish all preparatory work and request only that exact action.

## 11. Documentation deliverables

Create/update root `README.md` with: - product description and
screenshots if available; - architecture/data flow; - prerequisites; -
local setup for both folders; - environment variables and
`.env.example`; - test, typecheck, lint, and build commands; - API
endpoint table and sample payloads; - mock-provider limitations; -
deployment architecture and setup; - verified frontend/API URLs; - known
limitations and security notes.

Update any backend README, environment examples, API docs, and this
`production.md` as implementation changes. Never include secrets,
private data, or machine-specific absolute paths.

## 12. Progress reporting

After each substantial phase, report: 1. **Changed:** files and
behavior. 2. **Verified:** exact commands, tests, builds, and flows run.
3. **Remaining:** known gaps/blockers. 4. **Next:** next concrete
action.

Use status accurately: - `DONE` --- implemented and verified. -
`IN PROGRESS` --- started but not fully verified. - `BLOCKED` ---
external action is required. - `NOT STARTED` --- not implemented.

Code written alone is not proof a task is done.

## 13. Definition of done

-   [ ] Backend tests pass on repeated runs.
-   [ ] Frontend typecheck/lint/build pass using the configured scripts.
-   [ ] API contracts are consistent and documented.
-   [ ] Model list/details/register work end-to-end.
-   [ ] Playground runs mock inference and labels it as simulated.
-   [ ] Request logs and metrics show actual backend data.
-   [ ] Every visible route works or clearly says it is planned.
-   [ ] Live/demo/offline states are explicit.
-   [ ] Production persistence is configured and verified.
-   [ ] CORS, secrets, logging, and public-access risks are addressed.
-   [ ] README and environment examples are complete.
-   [ ] Deployed site is tested over HTTPS, including nested routes and
    core flows.
-   [ ] Final URLs, setup details, and limitations are recorded.

## 14. Immediate agent instructions

Do not stop at inspection. Execute this sequence:

1.  Inspect the actual root, Git status, manifests, and folders.
2.  Fix the missing `sqlite3` import and duplicate inference decorator
    if still present.
3.  Isolate tests from the persistent local database and run the backend
    suite twice consecutively.
4.  Build/typecheck the frontend and identify every API contract
    mismatch.
5.  Integrate the frontend through typed adapters with explicit
    live/demo/offline status.
6.  Finish core routes and add honest placeholder states for incomplete
    features.
7.  Test the full local flow in a browser.
8.  Select a deployment architecture based on the actual framework and
    persistence needs.
9.  Deploy both services, configure environment
    variables/CORS/persistence, and test the live site end-to-end.
10. Update documentation with verified commands, URLs, results, and
    limitations.

Continue autonomously wherever no credentials, account access, billing
approval, or user-only decision is required. If a true blocker occurs,
complete all preparation and ask for only the specific required action.
The goal is a working deployed website, not merely a plan or successful
local build.
