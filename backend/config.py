import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    def __init__(self) -> None:
        self.mongodb_uri = os.getenv("MONGODB_URI")
        self.db_name = os.getenv("DB_NAME", "furniture_store_db")
        self.jwt_secret = os.getenv("JWT_SECRET", "change_me")
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.port = int(os.getenv("PORT", "8000"))
        cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8081")
        self.cors_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]

        if not self.mongodb_uri:
            raise RuntimeError(
                "MONGODB_URI is not set. Configure backend/.env (see backend/.env.example)."
            )


settings = Settings()
