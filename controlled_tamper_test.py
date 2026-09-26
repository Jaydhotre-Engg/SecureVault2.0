"""Reversible tamper-detection test for Evidence #7.

Run from the backend directory while the existing API is running. The access
token is read from SECUREVAULT_ACCESS_TOKEN or entered without echoing.
"""

import getpass
import json
import os
import shutil
import sys
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


EVIDENCE_ID = 7
API_URL = os.getenv("SECUREVAULT_API_URL", "http://127.0.0.1:8000")
MARKER = b"\n[CONTROLLED TAMPER TEST - RESTORE FROM BACKUP]\n"


def call_verify(token: str) -> dict:
    request = Request(
        f"{API_URL}/api/evidence/{EVIDENCE_ID}/verify",
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.load(response)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Verification request failed ({error.code}): {body}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach {API_URL}: {error.reason}") from error


def main() -> None:
    backend_dir = Path(__file__).resolve().parent / "backend"
    if Path.cwd().resolve() != backend_dir:
        raise RuntimeError(f"Run this script from {backend_dir}")

    # Importing these modules loads the existing .env and existing Fernet key;
    # this script never reads, prints, generates, or replaces either secret.
    from app.database import SessionLocal
    from app.models.evidence import Evidence
    from app.services.encryption_service import decrypt_data, encrypt_data

    token = os.getenv("SECUREVAULT_ACCESS_TOKEN") or getpass.getpass(
        "SecureVault access token (input hidden): "
    )
    if not token:
        raise RuntimeError("An authenticated access token is required")

    db = SessionLocal()
    try:
        evidence = db.query(Evidence).filter(Evidence.id == EVIDENCE_ID).first()
        if evidence is None:
            raise RuntimeError("Evidence #7 was not found")

        stored_hash_before = evidence.file_hash
        storage_path = Path(evidence.storage_path).resolve()
        if not storage_path.is_file():
            raise RuntimeError(f"Evidence #7 storage file was not found: {storage_path}")

        backup_path = storage_path.with_name(
            f".{storage_path.name}.evidence-{EVIDENCE_ID}-backup-{uuid.uuid4().hex}.enc"
        )
        print(f"Evidence #{EVIDENCE_ID} encrypted storage file: {storage_path}")
        print(f"Database stored hash before test: {stored_hash_before}")
        shutil.copy2(storage_path, backup_path)
        print(f"Backup created: {backup_path}")

        tampered_response = None
        restore_error = None
        try:
            encrypted_data = storage_path.read_bytes()
            original_data = decrypt_data(encrypted_data)
            storage_path.write_bytes(encrypt_data(original_data + MARKER))
            print("Replaced only Evidence #7's encrypted file with modified ciphertext.")

            tampered_response = call_verify(token)
            print(json.dumps(tampered_response, indent=2))
            if tampered_response.get("status") != "TAMPERED":
                raise AssertionError("Expected status TAMPERED")
            if tampered_response.get("stored_hash") != stored_hash_before:
                raise AssertionError("Database stored hash changed unexpectedly")
            if tampered_response.get("current_hash") == stored_hash_before:
                raise AssertionError("Modified content produced the original hash")
        finally:
            try:
                os.replace(backup_path, storage_path)
                print("Original encrypted file restored from backup.")
            except Exception as error:
                restore_error = error

        if restore_error:
            raise RuntimeError(f"Could not restore Evidence #7: {restore_error}")

        restored_response = call_verify(token)
        print(json.dumps(restored_response, indent=2))
        if restored_response.get("status") != "VALID":
            raise AssertionError("Expected status VALID after restoration")
        if restored_response.get("stored_hash") != stored_hash_before:
            raise AssertionError("Database stored hash changed unexpectedly")
        if restored_response.get("current_hash") != stored_hash_before:
            raise AssertionError("Restored file hash does not match the original hash")
        print("Controlled tamper test passed; Evidence #7 is restored and VALID.")
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"TEST FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)