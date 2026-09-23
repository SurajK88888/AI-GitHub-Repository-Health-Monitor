"""Tests for GitHub App JWT generation and token caching."""

from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import jwt
import pytest

from app.services.github.auth import generate_app_jwt


class TestGenerateAppJwt:
    def test_raises_when_private_key_not_set(self) -> None:
        from app.config import Settings

        with patch("app.services.github.auth.get_settings") as mock_settings:
            settings = MagicMock(spec=Settings)
            settings.github_app_private_key = ""
            mock_settings.return_value = settings

            with pytest.raises(ValueError, match="GITHUB_APP_PRIVATE_KEY"):
                generate_app_jwt()

    def test_returns_string(self) -> None:
        """JWT is a non-empty string."""
        import base64

        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        # Generate a test RSA key pair
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        b64_pem = base64.b64encode(pem).decode()

        from app.config import Settings

        with patch("app.services.github.auth.get_settings") as mock_settings:
            settings = MagicMock(spec=Settings)
            settings.github_app_private_key = b64_pem
            settings.github_app_id = "12345"
            mock_settings.return_value = settings

            token = generate_app_jwt()

        assert isinstance(token, str)
        assert len(token) > 50

    def test_token_has_correct_claims(self) -> None:
        """JWT payload contains iss, iat, exp claims."""
        import base64

        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        public_key = private_key.public_key()
        b64_pem = base64.b64encode(pem).decode()

        from app.config import Settings

        with patch("app.services.github.auth.get_settings") as mock_settings:
            settings = MagicMock(spec=Settings)
            settings.github_app_private_key = b64_pem
            settings.github_app_id = "99"
            mock_settings.return_value = settings

            token = generate_app_jwt()

        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_exp": False},
        )
        assert payload["iss"] == "99"
        assert "iat" in payload
        assert "exp" in payload
        # Expiry should be roughly 10 minutes from now
        assert payload["exp"] > time.time()
        assert payload["exp"] < time.time() + 700
