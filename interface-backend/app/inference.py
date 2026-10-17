import time


MODEL_ID = "mock-model-v1"
MODEL_VERSION = "1.0.0"


def generate_response(prompt: str, max_tokens: int) -> dict:
    start_time = time.perf_counter()

    words = prompt.split()
    input_tokens = len(words)

    generated_text = (
        f"This is a mock response to your prompt: {prompt}"
    )

    generated_words = generated_text.split()
    generated_text = " ".join(generated_words[:max_tokens])

    output_tokens = len(generated_text.split())

    latency_ms = (time.perf_counter() - start_time) * 1000

    return {
        "model_id": MODEL_ID,
        "model_version": MODEL_VERSION,
        "generated_text": generated_text,
        "latency_ms": round(latency_ms, 3),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }
