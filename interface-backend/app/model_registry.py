
from app.database import get_connection


def list_models() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT model_id, model_version, provider, status, description, created_at
            FROM models
            ORDER BY created_at DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]


def get_model(model_id: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT model_id, model_version, provider, status, description, created_at
            FROM models
            WHERE model_id = ?
            """,
            (model_id,),
        ).fetchone()

    return dict(row) if row else None

def register_model(
    model_id: str,
    model_version: str,
    provider: str,
    description: str = "",
) -> dict:
    from datetime import datetime, timezone

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO models (
                model_id,
                model_version,
                provider,
                status,
                description,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                model_id,
                model_version,
                provider,
                "ready",
                description,
                datetime.now(timezone.utc).isoformat(),
            ),
        )

    model = get_model(model_id)
    return model
