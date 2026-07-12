from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pydantic_settings import BaseSettings
from typing import Optional
from sqlalchemy.engine import URL


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
    # This safely constructs the connection URL without string injection errors
    connection_url = URL.create(
        "mssql+pyodbc",
        username=settings.DB_USER,      # "sa"
        password=settings.DB_PASSWORD,  # "Solution_1"
        host=settings.DB_SERVER,        # "192.168.1.195"
        port=1433,                      # Hardcoding 1433 keeps it explicit
        database=settings.DB_NAME,      # "InquiryMIS"
        query={
            "driver": settings.DB_DRIVER,  # "ODBC Driver 17 for SQL Server"
            "Encrypt": "yes",
            "TrustServerCertificate": "yes"
        }
    )

    # Initialize the engine
    engine = create_engine(connection_url, echo=False, pool_pre_ping=True)
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
