from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pydantic_settings import BaseSettings
from typing import Optional
from sqlalchemy.engine import URL
from sqlalchemy import text


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

def _create_engine():
    if not _use_real_db:
        print("⚠️  No database credentials, using SQLite")
        return create_engine(
            "sqlite:///./inquiry_ms.db",
            connect_args={"check_same_thread": False},
        )

    try:
        connection_url = URL.create(
            "mssql+pyodbc",
            username=settings.DB_USER,
            password=settings.DB_PASSWORD,
            host=settings.DB_SERVER,
            port=1433,
            database=settings.DB_NAME,
            query={
                "driver": settings.DB_DRIVER,
                "Encrypt": "yes",
                "TrustServerCertificate": "yes"
            }
        )

        engine = create_engine(connection_url, echo=False, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"✅ Connected to SQL Server: {settings.DB_SERVER}")
        return engine
    except Exception as e:
        print(f"⚠️  Cannot reach SQL Server ({settings.DB_SERVER}): {type(e).__name__}")
        print("📦 Falling back to SQLite")
        return create_engine(
            "sqlite:///./inquiry_ms.db",
            connect_args={"check_same_thread": False},
        )

engine = _create_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
