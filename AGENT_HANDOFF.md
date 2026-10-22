# Inference --- Agent Handoff & Continuation Guide

## Mission

Continue building **Inference**, an LLMOps platform, from the existing
codebase. The project now has a Lovable-generated frontend and a
FastAPI/SQLite backend. The agent should first inspect and understand
the existing implementation, then integrate the frontend with the
backend and continue the product in small, verifiable increments.

**Do not rebuild the project from scratch. Do not replace working code
or redesign the frontend unnecessarily.** Preserve the current structure
and visual design unless a concrete issue requires a change.

## Repository layout

The project root contains two main folders:

``` text
project-root/
├── frontend/    # Existing Lovable-generated frontend
└── backend/     # Existing FastAPI backend
```

The earlier backend development directory was `~/interface-backend` in
WSL Ubuntu. The user has since organized the project into `frontend/`
and `backend/`. Treat the current project root and its actual files as
authoritative; inspect them before assuming paths or commands.

## Product goal

Build a practical LLMOps platform for managing models and inspecting
inference activity. The existing implementation starts with a mock
inference provider so it can run on the developer's laptop without a GPU
or a large local language model.

The intended product areas include:

-   **Model Registry:** list, inspect, and register model records.
-   **Playground / Inference:** submit a prompt to a selected model and
    view the response.
-   **Request Logs:** inspect past inference requests, status, latency,
    token estimates, and errors.
-   **Metrics:** view request counts, success/failure rates, latency,
    and token usage.
-   **Evaluations:** a future area for tracking model/agent quality and
    evaluation runs.
-   **Deployments:** a future area for model deployment/version status.
-   **Settings:** retain and use the frontend's existing settings
    experience where appropriate.

Some of these areas may currently be frontend-only placeholders. Inspect
the UI and backend before deciding what is already implemented.

## Existing backend capabilities

The backend was developed with **Python 3.12, FastAPI, Uvicorn, and
SQLite**. Inference is currently mocked, not powered by a real LLM.

The implemented API capabilities are understood to include:

-   `GET /` --- root/health-style response.
-   `GET /health` --- health check.
-   `POST /api/v1/inference` --- validates an inference request, invokes
    the mock generator, and logs the request.
-   `GET /api/v1/requests` --- paginated request history; supports
    `limit` and `offset`.
-   `GET /api/v1/metrics` --- aggregate inference metrics.
-   `GET /api/v1/models` --- lists registered models from SQLite.
-   `GET /api/v1/models/{model_id}` --- returns one model or a 404.
-   `POST /api/v1/models` --- registers a model record; intended to
    return `201 Created` and return `409 Conflict` for a duplicate
    `model_id`.

Confirm the exact routes and response shapes from `backend/app/main.py`
and `/docs`. Do not rely on this list instead of inspecting the code.

### Inference request example

``` json
{
  "model_id": "mock-model-v1",
  "prompt": "Explain distributed systems simply",
  "max_tokens": 100
}
```

The mock inference response includes fields such as `request_id`,
`model_id`, `model_version`, `generated_text`, `latency_ms`,
`input_tokens`, and `output_tokens`.

**Important limitations to communicate honestly in the UI and docs:**

-   The generator returns a mock response; it is not actual LLM
    inference.
-   Token counts are word-count estimates, not tokenizer-derived token
    counts.
-   Latency measures the mock function's execution time, not real
    model-serving latency.
-   Registering a model currently creates metadata in the registry; it
    does not automatically load or deploy a real model.
-   Do not imply production-grade model deployment, real GPU inference,
    or real token accounting unless implemented and verified.

## Database

The database is SQLite, currently named `inference.db` in the backend
project root (verify the current path in `backend/app/database.py`).

Known tables:

### `inference_requests`

Stores request history, including:

-   `request_id`
-   `model_id`
-   `model_version`
-   `prompt`
-   `generated_text`
-   `status`
-   `latency_ms`
-   `input_tokens`
-   `output_tokens`
-   `error_message`
-   `created_at`

### `models`

Stores model registry metadata, including:

-   `model_id` (primary key)
-   `model_version`
-   `provider`
-   `status`
-   `description`
-   `created_at`

`initialize_database()` creates the tables and seeds `mock-model-v1` if
it does not already exist. The seed uses version `1.0.0`, provider
`mock`, and status `ready`.

The registry module was updated to read from SQLite instead of an
in-memory dictionary. Model registration inserts records into SQLite.
Verify these details in the current source.

## Backend files to inspect

Likely backend files include:

``` text
backend/
├── app/
│   ├── __init__.py
│   ├── database.py
│   ├── inference.py
│   ├── main.py
│   ├── model_registry.py
│   └── schemas.py
├── tests/
│   └── test_inference.py
├── inference.db          # may be generated at runtime; verify actual location
└── ...
```

This is a reference, not a guarantee. Inspect the actual repository and
do not overwrite files just because the current layout differs.

## Frontend

The frontend was generated with Lovable and is already present in
`frontend/`. Preserve its existing UI, components, routes, styling, and
interactions. Determine its framework, package manager, entry point, and
environment configuration from files such as `package.json`, lockfiles,
and source code.

The agent should connect the existing frontend to the backend instead of
generating a second frontend. Avoid hardcoded fake dashboard data when
the corresponding backend endpoint can provide real data. Where a
backend feature is not implemented, make the placeholder state explicit
rather than presenting fabricated metrics as real.

## Development environment and commands

The developer uses Windows with WSL Ubuntu and VS Code. The laptop has
about **8 GB RAM and no usable GPU for this project**, so keep the
default development workflow lightweight. Do not require Docker,
Kubernetes, a GPU, or a paid model API just to run the baseline project.

Previous backend commands (adjust paths to the current folder
structure):

``` bash
# From the backend directory, with its virtual environment activated
python -m pytest -v
uvicorn app.main:app --reload
```

The API documentation is available at:

``` text
http://127.0.0.1:8000/docs
```

Use `python -m pytest -v` rather than bare `pytest` to reduce the risk
of invoking a different Python environment. Inspect `requirements.txt`
or `pyproject.toml` and the current virtual environment before
installing dependencies. Do not expose secrets or commit local
environment files.

## Test status and known testing issue

The test suite previously reported **12 passing tests and 2 errors**
when the two model-registration tests were first added. The first cause
was that those tests declared a `client` parameter even though
`tests/test_inference.py` defines a module-level
`client = TestClient(app)`. That was corrected by removing the `client`
parameters.

A later test run reported:

``` text
FAILED test_register_model - NameError: name 'sqlite3' is not defined
FAILED test_register_duplicate_model_id - NameError: name 'sqlite3' is not defined
```

The likely issue was that `app/main.py` used `sqlite3.IntegrityError`
without importing `sqlite3` in that module. The user subsequently said
the work was done, but the final test output was not shown after that
fix. **Do not assume the tests are currently green. Run them and
confirm.**

Another likely test reliability issue: the app uses a persistent SQLite
database. Tests that always register the same IDs (for example,
`registration-test-model` and `duplicate-test-model`) may pass once and
fail on later runs because the records remain in the database. Improve
test repeatability safely---prefer a temporary test database or unique
IDs and cleanup/rollback where appropriate. Do not delete the
developer's real `inference.db` to make tests pass.

## Agent workflow --- follow this order

### Phase 1: Inspect before editing

1.  Print or inspect the root directory and both `frontend/` and
    `backend/`.
2.  Read the frontend `package.json`, backend dependencies,
    `backend/app/main.py`, `database.py`, `schemas.py`, `inference.py`,
    `model_registry.py`, and all tests.
3.  Run the existing backend test suite and record the actual result.
4.  Start the backend and inspect `/docs`; verify actual endpoint paths
    and payloads.
5.  Inspect the frontend screens, API utilities, environment variables,
    and current mock data.
6.  Write a short implementation plan based on the code actually
    present. Do not ask the user to repeat details already in this guide
    or visible in the repository.

### Phase 2: Stabilize the backend

1.  Fix test failures and ensure model-registration error handling is
    correct.
2.  Make tests repeatable and isolated from the developer's persistent
    database.
3.  Verify input validation, unknown-model behavior, duplicate model
    registration, request logging, and metrics.
4.  Ensure errors return appropriate HTTP status codes and do not leak
    stack traces or secrets.
5.  Add/update tests for every behavior changed.

### Phase 3: Integrate the frontend

1.  Keep the existing Lovable UI and design.
2.  Add a single well-organized API client layer rather than scattering
    raw `fetch` calls through components.
3.  Configure the backend URL through a frontend environment variable
    suitable for the detected framework; document the expected variable
    in an example env file without real secrets.
4.  Configure CORS in FastAPI for the actual local frontend origin(s),
    using explicit origins rather than a permissive wildcard with
    credentials.
5.  Connect:
    -   model list and model details to the model registry endpoints;
    -   model registration form to `POST /api/v1/models`;
    -   playground to `POST /api/v1/inference`;
    -   request log view to `GET /api/v1/requests`;
    -   metrics dashboard to `GET /api/v1/metrics`.
6.  Add loading, empty, success, validation, and API-error states. Keep
    layouts usable at common desktop and laptop sizes.
7.  Avoid showing hardcoded numbers as if they came from the backend.
8.  Test the UI against a running backend and fix integration issues.

### Phase 4: Improve product quality

After the core UI/API integration works:

1.  Improve pagination and request-log detail views if the current UI
    calls for them.
2.  Add model status/version handling with clear semantics. Do not claim
    that a registry entry is deployed merely because it exists.
3.  Add useful metrics visualizations based on actual API responses.
4.  Add evaluations only after the core paths are stable, with explicit
    schemas and tests.
5.  Add deployment functionality only when its execution semantics are
    defined. A metadata record is not a deployment.
6.  Keep documentation current and provide straightforward local run
    instructions.

## Engineering constraints

-   Work incrementally and verify each meaningful change.
-   Before editing, inspect the existing code and reuse it where
    possible.
-   Do not replace large files wholesale unless necessary; explain why
    when doing so.
-   Avoid adding dependencies without a clear need.
-   Keep the default path runnable without a GPU, cloud credentials, or
    paid services.
-   Do not add a real model provider or external API without clearly
    documenting setup, costs, and secrets.
-   Never hardcode API keys, passwords, or tokens.
-   Preserve backward compatibility for existing endpoints unless a
    change is necessary and documented.
-   Add tests for bug fixes and new backend behavior.
-   If a command fails, diagnose the actual output instead of assuming
    success.
-   Update this guide or the README when run commands, endpoints, or
    architecture change.

## Definition of done for the next milestone

The next milestone is complete when:

-   The existing frontend runs locally using its documented package
    manager.
-   The FastAPI backend runs locally and all backend tests pass.
-   The frontend can list and register models through the backend.
-   The playground can submit a prompt and display the mock inference
    result.
-   The request logs and metrics screens show data returned by the API.
-   Loading and error states are handled clearly.
-   The README documents setup and startup for both folders.
-   The UI does not misrepresent mock inference or estimated token
    counts as real model-serving results.

## First action for the coding agent

**Start with repository inspection and test execution.** Confirm the
actual folder layout, determine whether the `sqlite3` import issue is
resolved, run the tests, and inspect the frontend. Then propose a
concise plan and proceed with the smallest useful change: stabilizing
tests and integrating the frontend with the existing API.
