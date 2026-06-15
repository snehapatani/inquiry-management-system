"""Tests for authentication and authorization."""
import pytest
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone
import jwt

from auth import hash_password, verify_password, create_access_token, decode_token, get_current_user, require_admin
from database import settings
import models


class TestPasswordHashing:
    """Test password hashing and verification."""

    def test_hash_password_creates_different_hash(self):
        """Hash of same password should be different each time."""
        plain = "SecurePassword123!"
        hash1 = hash_password(plain)
        hash2 = hash_password(plain)
        assert hash1 != hash2

    def test_verify_password_matches_hashed(self):
        """Verify password should match hashed version."""
        plain = "TestPassword123"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed)

    def test_verify_password_rejects_wrong_password(self):
        """Verify password should reject incorrect password."""
        plain = "TestPassword123"
        hashed = hash_password(plain)
        assert not verify_password("WrongPassword", hashed)

    def test_verify_password_case_sensitive(self):
        """Password verification should be case-sensitive."""
        plain = "TestPassword"
        hashed = hash_password(plain)
        assert not verify_password("testpassword", hashed)


class TestJWTTokens:
    """Test JWT token creation and verification."""

    def test_create_access_token_returns_string(self):
        """Create access token should return JWT string."""
        data = {"sub": "123", "username": "testuser"}
        token = create_access_token(data)
        assert isinstance(token, str)
        assert len(token) > 0

    def test_decode_token_extracts_payload(self):
        """Decode token should extract original payload."""
        data = {"sub": "456", "username": "paras"}
        token = create_access_token(data)
        decoded = decode_token(token)
        assert decoded["username"] == "paras"

    def test_decode_token_converts_sub_to_int(self):
        """Decode token should convert 'sub' from string to int."""
        data = {"sub": "789"}
        token = create_access_token(data)
        decoded = decode_token(token)
        assert decoded["sub"] == 789
        assert isinstance(decoded["sub"], int)

    def test_decode_token_includes_expiration(self):
        """Decoded token should include exp claim."""
        data = {"sub": "111"}
        token = create_access_token(data)
        decoded = decode_token(token)
        assert "exp" in decoded

    def test_decode_expired_token_raises_exception(self):
        """Decoding expired token should raise HTTPException."""
        data = {"sub": "222"}
        # Create token that expires immediately
        payload = data.copy()
        payload["exp"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        expired_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        with pytest.raises(HTTPException) as exc:
            decode_token(expired_token)
        assert exc.value.status_code == 401
        assert "Token expired" in str(exc.value.detail)

    def test_decode_invalid_token_raises_exception(self):
        """Decoding invalid token should raise HTTPException."""
        invalid_token = "invalid.token.string"

        with pytest.raises(HTTPException) as exc:
            decode_token(invalid_token)
        assert exc.value.status_code == 401

    def test_create_token_with_multiple_fields(self):
        """Token should preserve multiple fields in payload."""
        data = {"sub": "333", "username": "sneha", "role": "admin"}
        token = create_access_token(data)
        decoded = decode_token(token)
        assert decoded["username"] == "sneha"
        assert decoded["role"] == "admin"


class TestGetCurrentUser:
    """Test user authentication dependency."""

    def test_get_current_user_without_credentials_raises_401(self, client):
        """Calling without auth header should raise 401."""
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_get_current_user_with_invalid_token_raises_401(self, client):
        """Invalid token should raise 401."""
        headers = {"Authorization": "Bearer invalid.token"}
        response = client.get("/auth/me", headers=headers)
        assert response.status_code == 401

    def test_get_current_user_with_valid_token(self, client, db_engine):
        """Valid token should return user."""
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=db_engine)
        db = Session()

        # Create test user
        user = models.User(
            Username="testuser",
            HashedPassword=hash_password("password123"),
            FullName="Test User",
            Role="user",
            IsActive=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create token
        token = create_access_token({"sub": str(user.UserID)})
        headers = {"Authorization": f"Bearer {token}"}

        response = client.get("/auth/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["Username"] == "testuser"

        db.close()

    def test_get_current_user_with_inactive_user_raises_401(self, client, db_engine):
        """Inactive user should raise 401."""
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=db_engine)
        db = Session()

        # Create inactive user
        user = models.User(
            Username="inactiveuser",
            HashedPassword=hash_password("password123"),
            FullName="Inactive User",
            Role="user",
            IsActive=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create token
        token = create_access_token({"sub": str(user.UserID)})
        headers = {"Authorization": f"Bearer {token}"}

        response = client.get("/auth/me", headers=headers)
        assert response.status_code == 401

        db.close()


class TestRequireAdmin:
    """Test admin authorization."""

    def test_require_admin_denies_regular_user(self, client, db_engine):
        """Regular user should get 403 on admin endpoint."""
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=db_engine)
        db = Session()

        # Create regular user
        user = models.User(
            Username="regularuser",
            HashedPassword=hash_password("password123"),
            FullName="Regular User",
            Role="user",
            IsActive=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create token
        token = create_access_token({"sub": str(user.UserID)})
        headers = {"Authorization": f"Bearer {token}"}

        # Try accessing admin endpoint
        response = client.get("/auth/users", headers=headers)
        assert response.status_code == 403

        db.close()

    def test_require_admin_allows_admin_user(self, client, db_engine):
        """Admin user should access admin endpoints."""
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=db_engine)
        db = Session()

        # Create admin user
        user = models.User(
            Username="adminuser",
            HashedPassword=hash_password("password123"),
            FullName="Admin User",
            Role="admin",
            IsActive=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create token
        token = create_access_token({"sub": str(user.UserID)})
        headers = {"Authorization": f"Bearer {token}"}

        # Access admin endpoint
        response = client.get("/auth/users", headers=headers)
        assert response.status_code == 200

        db.close()


class TestLoginLogout:
    """Test login and logout flows."""

    def test_login_with_correct_credentials(self, client, db_engine):
        """Login with correct username/password should return token."""
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=db_engine)
        db = Session()

        # Create test user
        password = "TestPassword123!"
        user = models.User(
            Username="logintest",
            HashedPassword=hash_password(password),
            FullName="Login Test",
            Role="user",
            IsActive=True,
        )
        db.add(user)
        db.commit()
        db.close()

        # Login
        response = client.post("/auth/login", json={
            "username": "logintest",
            "password": password,
        })
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_login_with_wrong_password_fails(self, client, db_engine):
        """Login with wrong password should fail."""
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=db_engine)
        db = Session()

        # Create test user
        user = models.User(
            Username="logintest2",
            HashedPassword=hash_password("CorrectPassword"),
            FullName="Login Test 2",
            Role="user",
            IsActive=True,
        )
        db.add(user)
        db.commit()
        db.close()

        # Try login with wrong password
        response = client.post("/auth/login", json={
            "username": "logintest2",
            "password": "WrongPassword",
        })
        assert response.status_code == 401

    def test_login_nonexistent_user_fails(self, client):
        """Login with nonexistent user should fail."""
        response = client.post("/auth/login", json={
            "username": "nonexistentuser",
            "password": "anypassword",
        })
        assert response.status_code == 401

    def test_token_expires_after_timeout(self):
        """Token should become invalid after expiration."""
        data = {"sub": "999"}
        token = create_access_token(data)

        # Decode immediately should work
        decoded = decode_token(token)
        assert decoded["sub"] == 999

        # Create expired token manually
        payload = {"sub": "999"}
        payload["exp"] = datetime.now(timezone.utc) - timedelta(seconds=5)
        expired_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        # Decoding should fail
        with pytest.raises(HTTPException):
            decode_token(expired_token)
