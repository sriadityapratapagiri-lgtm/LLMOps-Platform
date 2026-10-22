# Inference — LLMOps Platform

Inference is a lightweight, local-first LLMOps control panel designed for managing registered models, running inference playground tests, inspecting past inference request history, and viewing aggregate metrics and token estimations.

---

## 1. Architecture & Data Flow

```
┌──────────────────────────────────────────────┐
│        Frontend (TanStack Start / React 19)  │
│        - Vite + TailwindCSS                  │
│        - TanStack Query (React Query)        │
│        - Port 3000                           │
└──────────────────────┬───────────────────────┘
                       │ HTTP / JSON (REST)
                       ▼
┌──────────────────────────────────────────────┐
│        Backend API (FastAPI / Python 3.12+)  │
│        - Uvicorn ASGI Server                 │
│        - Structured Error & Status Handling  │
│        - Port 8000                           │
└──────────────────────┬───────────────────────┘
                       │ Parameterized SQL
                       ▼
┌──────────────────────────────────────────────┐
│        Storage (SQLite: inference.db)        │
│        - models table                        │
│        - inference_requests table            │
└──────────────────────────────────────────────┘
```

### Data Flow
1. **Model Registry (`/models`)**: Lists registered models and allows registering new ones with version, provider, and description. Stored in SQLite `models`.
2. **Playground (`/playground`)**: Submits a prompt and parameters to `POST /api/v1/inference`. The backend invokes the generator, records latency and token estimates, and persists the transaction to `inference_requests`.
3. **Request Logs (`/requests`)**: Retrieves paginated inference request records from `GET /api/v1/requests`, displaying timestamp, status, latency, and token counts.
4. **Metrics (`/metrics`)**: Pulls real aggregates (request totals, success/failure counts, average latency, total input/output tokens) from `GET /api/v1/metrics/summary` and `/api/v1/metrics`.
5. **Evaluations (`/evaluations`) & Deployments (`/deployments`)**: Structured views with explicit demo/simulated indicators until connected to an external evaluation runner or runtime orchestrator.

---

## 2. Prerequisites

- **Python**: 3.11+ (tested on Python 3.12 / 3.14)
- **Node.js**: v20+ or **Bun**: v1.2+ (frontend uses `bun.lock`)
- **OS**: Windows, macOS, or Linux (WSL friendly)
- **Hardware**: Runs comfortably on 8 GB RAM with no GPU required.

---

## 3. Local Setup & Startup

### Backend (`interface-backend`)
```bash
cd interface-backend

# Install dependencies
pip install -r requirements.txt

# Run test suite
python -m pytest tests/ -v

# Start FastAPI development server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API docs available at: `http://127.0.0.1:8000/docs`

### Frontend (`interface_frontend`)
```bash
cd interface_frontend

# Install dependencies using Bun
bun install --frozen-lockfile

# Run type check and unit tests
bun x tsc --noEmit
bun run test

# Start frontend development server
bun run dev -- --host 127.0.0.1 --port 3000
```
Web app accessible at: `http://127.0.0.1:3000`

---

## 4. Environment Variables

### Backend (`interface-backend`)
| Variable | Description | Default |
|---|---|---|
| `DATABASE_PATH` | Path to the SQLite database file | `../inference.db` |
| `PORT` | Server listening port | `8000` |

### Frontend (`interface_frontend`)
| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the FastAPI backend | `http://localhost:8000` |
| `NITRO_PRESET` | Nitro deployment target (`node-server`, `cloudflare-module`, etc.) | `cloudflare-module` |

---

## 5. API Endpoints

| Method | Endpoint | Description | Sample Request |
|---|---|---|---|
| `GET` | `/health` | Health & service status check | N/A |
| `GET` | `/api/v1/models` | List all registered models | N/A |
| `GET` | `/api/v1/models/{model_id}` | Retrieve specific model details | N/A |
| `POST` | `/api/v1/models` | Register a new model | `{"model_id": "llama-3-8b", "model_version": "1.0.0", "provider": "custom", "description": "Llama 3"}` |
| `POST` | `/api/v1/inference` | Execute an inference prompt | `{"model_id": "mock-model-v1", "prompt": "Explain APIs", "max_tokens": 100}` |
| `GET` | `/api/v1/requests` | List paginated request history | Query params: `?limit=20&offset=0` |
| `GET` | `/api/v1/metrics` | Aggregate request & token metrics | N/A |
| `GET` | `/api/v1/metrics/summary`| Frontend-compatible summary payload | N/A |
| `GET` | `/api/v1/metrics/timeseries`| Timeseries points for volume/latency | Query params: `?range=24h` |

---

## 6. Docker & Container Deployment

Run the entire platform with persistent SQLite storage in one command:
```bash
docker compose up --build
```
- Backend accessible on `http://localhost:8000`
- Frontend accessible on `http://localhost:3000`
- SQLite database persisted across restarts in the `backend-data` volume.

---

## 7. Limitations & Honest Disclosures

- **Mock Inference**: Inference requests are served by a local generator and do not require external API keys or a GPU.
- **Token Counts**: Reported input/output tokens are word-count estimates, not derived from a byte-pair tokenizer.
- **Latency**: Measured latency reflects the execution time of the local handler, not remote LLM cluster latency.
- **Model Registry vs. Deployment**: Registering a model saves metadata in SQLite; it does not automatically load model weights or provision cloud infrastructure.
- **Evaluations & Deployments Pages**: Currently display synthetic benchmark cases and deployment simulation logs until integrated with a real evaluations pipeline or Kubernetes/Docker runner.

