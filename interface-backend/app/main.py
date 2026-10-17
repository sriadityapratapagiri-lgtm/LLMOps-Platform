
from uuid import uuid4
from datetime import datetime, timezone
from app.schemas import InferenceRequest, InferenceResponse, ModelRegistrationRequest
from app.model_registry import get_model, list_models, register_model
from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager

from app.database import initialize_database, get_connection
from app.inference import MODEL_ID, generate_response
from app.schemas import InferenceRequest, InferenceResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Inference API",
    description="Backend for an LLMOps platform",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/")
def root():
    return {
        "message": "Welcome to Inference",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "inference-api",
        "version": "0.1.0",
    }


@app.post(
    "/api/v1/inference",
    response_model=InferenceResponse,
)

@app.post(
    "/api/v1/inference",
    response_model=InferenceResponse,
)

@app.post(
    "/api/v1/inference",
    response_model=InferenceResponse,
)
def run_inference(request: InferenceRequest) -> InferenceResponse:
    model = get_model(request.model_id)

    if model is None:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{request.model_id}' is not registered",
        )

    request_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    try:
        result = generate_response(
            prompt=request.prompt,
            max_tokens=request.max_tokens,
        )

        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO inference_requests (
                    request_id, model_id, model_version, prompt,
                    generated_text, status, latency_ms, input_tokens,
                    output_tokens, error_message, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    request_id,
                    result["model_id"],
                    result["model_version"],
                    request.prompt,
                    result["generated_text"],
                    "success",
                    result["latency_ms"],
                    result["input_tokens"],
                    result["output_tokens"],
                    None,
                    created_at,
                ),
            )

        return InferenceResponse(
            request_id=request_id,
            **result,
        )

    except Exception as exc:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO inference_requests (
                    request_id, model_id, model_version, prompt,
                    generated_text, status, latency_ms, input_tokens,
                    output_tokens, error_message, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    request_id,
                    request.model_id,
                    model["model_version"],
                    request.prompt,
                    None,
                    "failed",
                    None,
                    None,
                    None,
                    str(exc)[:1000],
                    created_at,
                ),
            )

        raise HTTPException(
            status_code=500,
            detail="Inference failed",
        ) from exc

@app.get("/api/v1/requests")
def get_requests(
    limit: int = 20,
    offset: int = 0,
):
    if not 1 <= limit <= 100:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 100",
        )

    if offset < 0:
        raise HTTPException(
            status_code=400,
            detail="offset must be non-negative",
        )

    with get_connection() as connection:
        total = connection.execute(
            "SELECT COUNT(*) FROM inference_requests"
        ).fetchone()[0]

        rows = connection.execute(
            """
            SELECT
                request_id,
                model_id,
                model_version,
                prompt,
                generated_text,
                status,
                latency_ms,
                input_tokens,
                output_tokens,
                error_message,
                created_at
            FROM inference_requests
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "requests": [dict(row) for row in rows],
    }


@app.get("/api/v1/metrics")
def get_metrics():
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                COUNT(*) AS total_requests,
                COALESCE(
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END),
                    0
                ) AS successful_requests,
                COALESCE(
                    SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END),
                    0
                ) AS failed_requests,
                COALESCE(AVG(latency_ms), 0) AS average_latency_ms,
                COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
                COALESCE(SUM(output_tokens), 0) AS total_output_tokens
            FROM inference_requests
            """
        ).fetchone()

    total = row["total_requests"]
    successful = row["successful_requests"]

    success_rate = (
        (successful / total) * 100
        if total > 0
        else 0.0
    )

    return {
        "total_requests": total,
        "successful_requests": successful,
        "failed_requests": row["failed_requests"],
        "success_rate_percent": round(success_rate, 2),
        "average_latency_ms": round(row["average_latency_ms"], 3),
        "total_input_tokens": row["total_input_tokens"],
        "total_output_tokens": row["total_output_tokens"],
    }
@app.get("/api/v1/models")
def get_models():
    return {
        "models": list_models(),
    }
@app.get("/api/v1/models/{model_id}")
def get_model_details(model_id: str):
    model = get_model(model_id)

    if model is None:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_id}' is not registered",
        )

    return model

@app.post("/api/v1/models", status_code=201)
def create_model(request: ModelRegistrationRequest):
    try:
        model = register_model(
            model_id=request.model_id,
            model_version=request.model_version,
            provider=request.provider,
            description=request.description,
        )
        return {"model": model}

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="A model with this model_id already exists",
        )
