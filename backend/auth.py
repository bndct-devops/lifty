"""Authentication utilities for lifty.

Provides:
  - PBKDF2-SHA256 password hashing / verification  (stdlib hashlib)
  - HS256 JWT creation / decoding                  (python-jose)

State (enabled flag, jwt_secret, password_hash) lives in main._auth_state
and is populated during the FastAPI startup event.
"""

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt

TOKEN_EXPIRE_DAYS = 30
ALGORITHM = "HS256"
_PBKDF2_ITERS = 260_000  # OWASP 2023 recommendation for PBKDF2-SHA256


def hash_password(password: str) -> str:
    """Return a salted PBKDF2-SHA256 hash of *password*."""
    salt = os.urandom(32)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERS)
    return salt.hex() + ":" + dk.hex()


def verify_password(password: str, hashed: str) -> bool:
    """Constant-time verification against a stored hash produced by hash_password."""
    try:
        salt_hex, dk_hex = hashed.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERS)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def create_access_token(secret: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"exp": expire, "sub": "lifty"}, secret, algorithm=ALGORITHM)


def decode_token(token: str, secret: str) -> bool:
    """Return True if the token is valid, correctly signed, and not expired."""
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        return payload.get("sub") == "lifty"
    except JWTError:
        return False
