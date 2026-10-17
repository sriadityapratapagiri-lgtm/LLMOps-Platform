
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DATABASE_PATH = Path(__file__).resolve().parent.parent / "inference.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        # Store inference request history.
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS inference_requests (
                request_id TEXT PRIMARY KEY,
                model_id TEXT NOT NULL,
                model_version TEXT NOT NULL,
                prompt TEXT NOT NULL,
                generated_text TEXT,
                status TEXT NOT NULL,
                latency_ms REAL,
                input_tokens INTEGER,
                output_tokens INTEGER,
                error_message TEXT,
                created_at TEXT NOT NULL
            )
            """
        )

        # Store registered models.
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS models (
                model_id TEXT PRIMARY KEY,
                model_version TEXT NOT NULL,
                provider TEXT NOT NULL,
                status TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL
            )
            """
        )

        # Register the mock model if it does not already exist.
        connection.execute(
            """
            INSERT OR IGNORE INTO models (
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
                "mock-model-v1",
                "1.0.0",
                "mock",
                "ready",
                "Mock model for testing the Inference API",
                datetime.now(timezone.utc).isoformat(),
            ),
        )
