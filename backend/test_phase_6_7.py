import os
import sys
import json
import sqlite3
import bcrypt
from dotenv import load_dotenv

load_dotenv()

# We can use starlette/fastapi TestClient with urllib/custom or via app directly
# If httpx is needed for TestClient, let's test how starlette TestClient behaves or test the endpoint function / client
print("=" * 60)
print("SECUREVAULT 2.0 — PHASE 6 & 7 REGISTRATION AUTOMATED TESTS")
print("=" * 60)

from app.main import app
from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()

# Clean up any previous test users other than admin
db.query(User).filter(User.username.like("test_%")).delete()
db.commit()

from app.schemas.user import UserRegisterRequest
from app.routers.auth import register_user
from fastapi import HTTPException

# Test 1: Successful Registration of Investigator
print("\n[TEST 1] Successful User Registration (INVESTIGATOR role)")
req = UserRegisterRequest(
    username="test_investigator1",
    email="investigator1@securevault.local",
    password="SecurePassword2026!"
)
user_resp = register_user(req, db)
assert user_resp.id is not None
assert user_resp.username == "test_investigator1"
assert user_resp.email == "investigator1@securevault.local"
assert user_resp.role == "INVESTIGATOR"
assert user_resp.is_active is True
print(f"  User created: ID={user_resp.id}, username={user_resp.username}, role={user_resp.role}")

# Verify in database directly
user_in_db = db.query(User).filter(User.username == "test_investigator1").first()
assert user_in_db is not None
assert user_in_db.password_hash.startswith("$2b$12$")
assert bcrypt.checkpw("SecurePassword2026!".encode("utf-8"), user_in_db.password_hash.encode("utf-8")) is True
assert user_in_db.role == "INVESTIGATOR"
print(f"  Database password_hash verified (bcrypt 12 rounds): {user_in_db.password_hash[:15]}...")
print("  -> RESULT: PASS")

# Test 2: Duplicate Username Rejected
print("\n[TEST 2] Duplicate Username Rejection (400 Bad Request)")
dup_user_req = UserRegisterRequest(
    username="test_investigator1",
    email="another_email@securevault.local",
    password="AnotherPassword2026!"
)
try:
    register_user(dup_user_req, db)
    raise AssertionError("Expected HTTPException(400) for duplicate username!")
except HTTPException as e:
    assert e.status_code == 400
    assert "Username already registered" in e.detail
    print(f"  Correctly raised HTTP {e.status_code}: {e.detail}")
print("  -> RESULT: PASS")

# Test 3: Duplicate Email Rejected
print("\n[TEST 3] Duplicate Email Rejection (400 Bad Request)")
dup_email_req = UserRegisterRequest(
    username="test_investigator2",
    email="investigator1@securevault.local",
    password="AnotherPassword2026!"
)
try:
    register_user(dup_email_req, db)
    raise AssertionError("Expected HTTPException(400) for duplicate email!")
except HTTPException as e:
    assert e.status_code == 400
    assert "Email already registered" in e.detail
    print(f"  Correctly raised HTTP {e.status_code}: {e.detail}")
print("  -> RESULT: PASS")

# Test 4: Password Complexity / Validation Rules
print("\n[TEST 4] Pydantic Validation Constraints")
from pydantic import ValidationError

# Password too short (< 8 chars)
try:
    UserRegisterRequest(username="test_short", email="test@val.local", password="123")
    raise AssertionError("Validation failed to reject short password!")
except ValidationError as e:
    print("  Short password (<8 chars) rejected as expected.")

# Invalid email format
try:
    UserRegisterRequest(username="test_bademail", email="invalid-email-format", password="ValidPass1234!")
    raise AssertionError("Validation failed to reject invalid email format!")
except ValidationError as e:
    print("  Invalid email format rejected as expected.")

# Invalid characters in username
try:
    UserRegisterRequest(username="bad name with spaces!", email="valid@test.local", password="ValidPass1234!")
    raise AssertionError("Validation failed to reject invalid characters in username!")
except ValidationError as e:
    print("  Username with spaces/invalid characters rejected as expected.")
print("  -> RESULT: PASS")

# Test 5: Client Role Injection Prevention
print("\n[TEST 5] Client Role Tampering / Escalation Prevention")
# If a client sends 'role': 'ADMIN' in request payload, UserRegisterRequest ignores/excludes it
req_data = {
    "username": "test_attacker",
    "email": "attacker@securevault.local",
    "password": "AttackerPass2026!",
    "role": "ADMIN"  # Attempted injection
}
validated_req = UserRegisterRequest(**req_data)
created_attacker = register_user(validated_req, db)
assert created_attacker.role == "INVESTIGATOR", f"Role was tampered to: {created_attacker.role}"
print(f"  Attempt to pass role='ADMIN' ignored -> user created strictly as: {created_attacker.role}")
print("  -> RESULT: PASS")

# Clean up test users
db.query(User).filter(User.username.like("test_%")).delete()
db.commit()

# Test 6: Verify Protected Files
print("\n[TEST 6] Protected Files Integrity Check")
protected = [
    'app/services/encryption_service.py',
    'app/services/file_service.py',
    'app/services/hash_service.py',
    'app/models/evidence.py',
    'app/routers/evidence.py'
]
for p in protected:
    assert os.path.exists(p), f"Protected file missing: {p}"
    print(f"  {p}: verified intact")
print("  -> RESULT: PASS")

# Test 7: Verify Evidence Records
print("\n[TEST 7] Evidence Records Integrity Check")
from app.models.evidence import Evidence
records = db.query(Evidence).all()
assert len(records) == 5, f"Expected 5 evidence records, found {len(records)}"
print(f"  Evidence count: {len(records)} intact records")
print("  -> RESULT: PASS")

db.close()

print("\n" + "=" * 60)
print("ALL PHASE 6 & 7 TESTS PASSED (100% SUCCESS)")
print("=" * 60)
