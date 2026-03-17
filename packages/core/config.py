from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "local"
    LOG_LEVEL: str = "INFO"
    SERVICE_NAME: str = "crowdlens"

    API_PORT: int = 8000
    WORKER_PORT: int = 8001

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    AI_BRIEFING_ENABLED: bool = False


settings = Settings()