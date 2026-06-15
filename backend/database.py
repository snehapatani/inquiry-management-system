from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DB_SERVER: str = "192.168.1.195"
    DB_NAME: str = "InquiryMS"
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    ANTHROPIC_API_KEY: str = ""
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"

    class Config:
        env_file = ".env"


settings = Settings()

_use_real_db = (
    settings.DB_USER
    and settings.DB_USER not in ("your_sql_login", "")
    and settings.DB_PASSWORD not in ("your_password", "", None)
)

if _use_real_db:
    connection_string = (
        f"mssql+pyodbc://{settings.DB_USER}:{settings.DB_PASSWORD}"
        f"@{settings.DB_SERVER}/{settings.DB_NAME}"
        f"?driver={settings.DB_DRIVER.replace(' ', '+')}"
        f"&Encrypt=yes&TrustServerCertificate=yes"
    )
    engine = create_engine(connection_string, echo=False, pool_pre_ping=True)
else:
    engine = create_engine(
        "sqlite:///./inquiry_ms.db",
        connect_args={"check_same_thread": False},
    )
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
