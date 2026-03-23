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
    FIRESTORE_USERS_COLLECTION: str = "users"

    USE_CLOUD_TASKS: bool = False
    TASKS_LOCATION: str = "us-central1"
    TASKS_QUEUE_NAME: str = "process-report"
    WORKER_URL: str = "http://localhost:8001"
    TASKS_SERVICE_ACCOUNT_EMAIL: str = ""

    GCS_BUCKET_NAME: str = ""

    REPORT_MIN_TEXT_LENGTH: int = 8
    REPORT_SUBMISSION_COOLDOWN_SECONDS: int = 15
    REPORT_DUPLICATE_WINDOW_MINUTES: int = 5

    USER_REPUTATION_DEFAULT: float = 0.5
    USER_REPUTATION_BONUS_UNIQUE: float = 0.03
    USER_REPUTATION_PENALTY_DUPLICATE: float = 0.04
    USER_REPUTATION_PENALTY_LOW_QUALITY: float = 0.05


settings = Settings()