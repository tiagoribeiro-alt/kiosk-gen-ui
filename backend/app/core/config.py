from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    gemini_api_key: str = Field(..., env="GEMINI_API_KEY")
    model_name: str = Field("gemini-2.5-flash-native-audio-preview-12-2025", env="MODEL_NAME")
    eventuais_backend_url: str = Field("https://api1tcp.eventuais.com", env="EVENTUAIS_BACKEND_URL")
    agent_id: str = Field("cim", env="AGENT_ID")
    greeting_audio_path: str | None = Field(None, env="GREETING_AUDIO_PATH")
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = Field(default=["*"], env="CORS_ORIGINS")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
