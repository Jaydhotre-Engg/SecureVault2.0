import base64
import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

MASTER_KEY = os.getenv("MASTER_ENCRYPTION_KEY")

if not MASTER_KEY:
    raise RuntimeError("MASTER_ENCRYPTION_KEY is not set")

cipher = Fernet(MASTER_KEY.encode())


def encrypt_data(data: bytes) -> bytes:
    """Encrypt raw file data."""
    return cipher.encrypt(data)


def decrypt_data(encrypted_data: bytes) -> bytes:
    """Decrypt encrypted file data."""
    base64.b64decode(encrypted_data, altchars=b"-_", validate=True)
    return cipher.decrypt(encrypted_data)