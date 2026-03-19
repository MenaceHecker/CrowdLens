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

    GCP_PROJECT_ID: str = ""
    FIRESTORE_DATABASE: str = "(default)"
    FIRESTORE_REPORTS_COLLECTION: str = "reports"
    FIRESTORE_EVENTS_COLLECTION: str = "events"

    USE_CLOUD_TASKS: bool = False
    TASKS_LOCATION: str = "us-central1"
    TASKS_QUEUE_NAME: str = "process-report"
    WORKER_URL: str = "http://localhost:8001"
    TASKS_SERVICE_ACCOUNT_EMAIL: str = ""

    GCS_BUCKET_NAME: str = ""


settings = Settings()