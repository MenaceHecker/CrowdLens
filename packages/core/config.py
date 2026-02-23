from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Environment
    APP_ENV: str = "local"      # local | dev | prod
    LOG_LEVEL: str = "INFO"     # DEBUG | INFO | WARNING | ERROR
    SERVICE_NAME: str = "crowdlens"

    # Ports mainly for docs and uvicorn uses CLI flag
    API_PORT: int = 8000
    WORKER_PORT: int = 8001

settings = Settings()
