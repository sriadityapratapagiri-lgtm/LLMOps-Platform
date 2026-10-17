from pydantic import BaseModel, Field


class InferenceRequest(BaseModel):
    model_id: str = Field(min_length=1, max_length=100)
    prompt: str = Field(min_length=1, max_length=10000)
    max_tokens: int = Field(default=100, ge=1, le=2048)


class InferenceResponse(BaseModel):
    request_id: str
    model_id: str
    model_version: str
    generated_text: str
    latency_ms: float
    input_tokens: int
    output_tokens: int

class ModelRegistrationRequest(BaseModel):
    model_id: str = Field(min_length=1, max_length=100)
    model_version: str = Field(min_length=1, max_length=50)
    provider: str = Field(min_length=1, max_length=50)
    description: str = Field(default="", max_length=500)
