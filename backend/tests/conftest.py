"""Pytest fixtures shared across all test modules."""
import sys, os
# Add backend root (for main, models, etc.) and tests dir (for helpers)
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # backend/
sys.path.insert(0, os.path.dirname(__file__))                   # backend/tests/

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
import main as app_module

TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def db_engine():
    # StaticPool: all connections share one in-memory DB so create_all and
    # request sessions see the same tables.
    engine = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_engine):
    Session = sessionmaker(bind=db_engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app_module.app.dependency_overrides[get_db] = override_get_db
    with TestClient(app_module.app) as c:
        yield c
    app_module.app.dependency_overrides.clear()
