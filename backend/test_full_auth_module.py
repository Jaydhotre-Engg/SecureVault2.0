import os
import sys
import hashlib
import sqlite3
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from io import BytesIO
from dotenv import load_dotenv

load_dotenv()

print("=" * 70)
print("SECUREVAULT 2.0 — COMPREHENSIVE AUTH & SECURITY MODULE TEST SUITE")
print("=" * 70)

from app.main import app
from app.database import engine, Base, SessionLocal
from app.models.user import User
from app.models.evidence import Evidence
from app.models.case import Case
from app.models.audit_log import AuditLog
from app.schemas.user import UserRegisterRequest, UserLoginRequest
from app.schemas.evidence import EvidenceResponse
from app.services.auth_service import hash_password, verify_password, create_access_token, decode_access_token
from app.dependencies.auth import get_current_user, require_role, HTTPAuthorizationCredentials
from app.routers.auth import register_user, login_user, get_me
from app.routers.users import list_users, get_user_by_id, deactivate_user, reactivate_user, get_audit_logs
from app.routers.evidence import upload_evidence, verify_evidence, list_evidence, get_evidence
from fastapi import HTTPException, Request, UploadFile

class DummyClient:
    def __init__(self, host="127.0.0.1"):
        self.host = host

class DummyRequest:
    def __init__(self, host="127.0.0.1"):
        self.client = DummyClient(host)

req = DummyRequest()
db = SessionLocal()

# Cleanup test users except 'admin'
db.query(User).filter(User.username.like("test_%")).delete()
db.commit()

# Ensure 'admin' user exists
admin = db.query(User).filter(User.role == "ADMIN").first()
if not admin:
    admin = User(
        username="admin",
        email="admin@securevault.local",
        password_hash=hash_password("AdminMasterPass2026!"),
        role="ADMIN",
        is_active=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

print(f"\n[SETUP] Verified ADMIN account in DB: ID={admin.id}, username={admin.username}, role={admin.role}")

# ==============================================================================
# SECTION 1: REGISTRATION TESTS
# ==============================================================================
print("\n" + "=" * 50)
print("SECTION 1: REGISTRATION TESTS")
print("=" * 50)

# Test 1.1: Valid Registration
inv1_req = UserRegisterRequest(
    username="test_inv1",
    email="inv1@securevault.local",
    password="InvestigatorPass1!"
)
inv1 = register_user(inv1_req, req, db)
assert inv1.id is not None
assert inv1.username == "test_inv1"
assert inv1.role == "INVESTIGATOR"
assert inv1.is_active is True
print(f"  1.1 Valid Registration: PASS (Investigator created with ID={inv1.id})")

# Test 1.2: Duplicate Username
try:
    dup_name_req = UserRegisterRequest(
        username="test_inv1",
        email="different_email@securevault.local",
        password="InvestigatorPass1!"
    )
    register_user(dup_name_req, req, db)
    raise AssertionError("Duplicate username was not rejected!")
except HTTPException as e:
    assert e.status_code == 400
    print(f"  1.2 Duplicate Username Rejected (HTTP {e.status_code}): PASS")

# Test 1.3: Duplicate Email
try:
    dup_email_req = UserRegisterRequest(
        username="test_inv1_different",
        email="inv1@securevault.local",
        password="InvestigatorPass1!"
    )
    register_user(dup_email_req, req, db)
    raise AssertionError("Duplicate email was not rejected!")
except HTTPException as e:
    assert e.status_code == 400
    print(f"  1.3 Duplicate Email Rejected (HTTP {e.status_code}): PASS")

# Test 1.4: Register second investigator
inv2_req = UserRegisterRequest(
    username="test_inv2",
    email="inv2@securevault.local",
    password="InvestigatorPass2!"
)
inv2 = register_user(inv2_req, req, db)
assert inv2.id is not None
print(f"  1.4 Second Investigator Registration: PASS (ID={inv2.id})")

# ==============================================================================
# SECTION 2: LOGIN & JWT TESTS
# ==============================================================================
print("\n" + "=" * 50)
print("SECTION 2: LOGIN & JWT TESTS")
print("=" * 50)

# Test 2.1: Valid Login with username
login_req_username = UserLoginRequest(username="test_inv1", password="InvestigatorPass1!")
login_resp = login_user(login_req_username, req, db)
assert login_resp.access_token is not None
assert login_resp.token_type == "bearer"
inv1_token = login_resp.access_token
decoded_inv1 = decode_access_token(inv1_token)
assert decoded_inv1["sub"] == str(inv1.id)
assert decoded_inv1["username"] == "test_inv1"
assert decoded_inv1["role"] == "INVESTIGATOR"
print("  2.1 Valid Login (Username): PASS (JWT token verified)")

# Test 2.2: Valid Login with email
login_req_email = UserLoginRequest(username="inv1@securevault.local", password="InvestigatorPass1!")
login_resp_email = login_user(login_req_email, req, db)
assert login_resp_email.access_token is not None
print("  2.2 Valid Login (Email): PASS")

# Test 2.3: Admin Login
admin_login_req = UserLoginRequest(username="admin", password="AdminMasterPass2026!")
admin_login_resp = login_user(admin_login_req, req, db)
admin_token = admin_login_resp.access_token
decoded_admin = decode_access_token(admin_token)
assert decoded_admin["sub"] == str(admin.id)
assert decoded_admin["role"] == "ADMIN"
print("  2.3 Admin Login: PASS (Role=ADMIN)")

# Test 2.4: Invalid Password -> 401
try:
    wrong_pass_req = UserLoginRequest(username="test_inv1", password="WrongPassword123!")
    login_user(wrong_pass_req, req, db)
    raise AssertionError("Invalid password was not rejected!")
except HTTPException as e:
    assert e.status_code == 401
    assert "Invalid username or password" in e.detail
    print(f"  2.4 Wrong Password Rejected (HTTP {e.status_code}): PASS")

# Test 2.5: Nonexistent User -> 401 (Generic error message)
try:
    nonexistent_req = UserLoginRequest(username="nonexistent_user_999", password="Password123!")
    login_user(nonexistent_req, req, db)
    raise AssertionError("Nonexistent user login was not rejected!")
except HTTPException as e:
    assert e.status_code == 401
    assert "Invalid username or password" in e.detail
    print(f"  2.5 Nonexistent User Rejected with Generic Message (HTTP {e.status_code}): PASS")

# ==============================================================================
# SECTION 3: CURRENT-USER DEPENDENCY TESTS
# ==============================================================================
print("\n" + "=" * 50)
print("SECTION 3: CURRENT-USER DEPENDENCY TESTS")
print("=" * 50)

# Test 3.1: Valid Bearer Token
creds_inv1 = HTTPAuthorizationCredentials(scheme="Bearer", credentials=inv1_token)
current_u = get_current_user(creds_inv1, db)
assert current_u.id == inv1.id
assert current_u.username == "test_inv1"
print(f"  3.1 Valid Bearer Token Resolution: PASS (Resolved user: {current_u.username})")

# Test 3.2: Malformed / Invalid Token
try:
    bad_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.structure")
    get_current_user(bad_creds, db)
    raise AssertionError("Malformed token was not rejected!")
except HTTPException as e:
    assert e.status_code == 401
    print(f"  3.2 Malformed Token Rejected (HTTP {e.status_code}): PASS")

# Test 3.3: Expired Token
expired_token = create_access_token({"sub": str(inv1.id)}, expires_delta=timedelta(seconds=-10))
try:
    expired_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
    get_current_user(expired_creds, db)
    raise AssertionError("Expired token was not rejected!")
except HTTPException as e:
    assert e.status_code == 401
    assert "expired" in e.detail.lower()
    print(f"  3.3 Expired Token Rejected (HTTP {e.status_code}): PASS")

# Test 3.4: Tampered Signature
secret_key = os.getenv("SECRET_KEY")
tampered_token = jwt.encode(
    {"sub": str(admin.id), "role": "ADMIN", "exp": datetime.now(timezone.utc) + timedelta(minutes=60)},
    "wrong-secret-key-12345678901234567890",
    algorithm="HS256"
)
try:
    tampered_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=tampered_token)
    get_current_user(tampered_creds, db)
    raise AssertionError("Tampered signature token was not rejected!")
except HTTPException as e:
    assert e.status_code == 401
    print(f"  3.4 Tampered Signature Rejected (HTTP {e.status_code}): PASS")

# ==============================================================================
# SECTION 4: ROLE AUTHORIZATION & ADMIN USER MANAGEMENT TESTS
# ==============================================================================
print("\n" + "=" * 50)
print("SECTION 4: ROLE-BASED ACCESS CONTROL (RBAC) & USER MANAGEMENT")
print("=" * 50)

# Test 4.1: require_role("ADMIN") with Admin user -> Success
admin_checker = require_role("ADMIN")
resolved_admin = admin_checker(admin)
assert resolved_admin.id == admin.id
print("  4.1 require_role('ADMIN') with ADMIN: PASS")

# Test 4.2: require_role("ADMIN") with Investigator user -> 403 Forbidden
try:
    admin_checker(inv1)
    raise AssertionError("Investigator was allowed admin privilege!")
except HTTPException as e:
    assert e.status_code == 403
    print(f"  4.2 require_role('ADMIN') with INVESTIGATOR Rejected (HTTP {e.status_code}): PASS")

# Test 4.3: Admin List Users Endpoint
all_users = list_users(db, admin)
assert len(all_users) >= 3
print(f"  4.3 Admin List Users: PASS (Found {len(all_users)} users)")

# Test 4.4: Admin Deactivate User (test_inv2)
deactivated_user = deactivate_user(inv2.id, req, db, admin)
assert deactivated_user.is_active is False
print(f"  4.4 Admin Deactivate User '{deactivated_user.username}': PASS")

# Test 4.5: Deactivated User Cannot Login -> 401
try:
    inv2_login_req = UserLoginRequest(username="test_inv2", password="InvestigatorPass2!")
    login_user(inv2_login_req, req, db)
    raise AssertionError("Deactivated user was allowed to login!")
except HTTPException as e:
    assert e.status_code == 401
    assert "deactivated" in e.detail.lower()
    print(f"  4.5 Deactivated User Login Blocked (HTTP {e.status_code}): PASS")

# Test 4.6: Deactivated User Existing Token Rejected in get_current_user -> 401
inv2_token = create_access_token({"sub": str(inv2.id), "username": inv2.username, "role": inv2.role})
try:
    inv2_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=inv2_token)
    get_current_user(inv2_creds, db)
    raise AssertionError("Deactivated user was accepted by get_current_user!")
except HTTPException as e:
    assert e.status_code == 401
    assert "deactivated" in e.detail.lower()
    print(f"  4.6 Deactivated User Token Access Blocked (HTTP {e.status_code}): PASS")

# Test 4.7: Guard against deactivating the only active ADMIN -> 400
try:
    deactivate_user(admin.id, req, db, admin)
    raise AssertionError("Admin was allowed to deactivate the only active admin!")
except HTTPException as e:
    assert e.status_code == 400
    assert "only active admin" in e.detail.lower()
    print(f"  4.7 Guard Against Deactivating Sole Active ADMIN (HTTP {e.status_code}): PASS")

# Test 4.8: Admin Reactivate User
reactivated_user = reactivate_user(inv2.id, req, db, admin)
assert reactivated_user.is_active is True
print(f"  4.8 Admin Reactivate User '{reactivated_user.username}': PASS")

# ==============================================================================
# SECTION 5: EVIDENCE OWNERSHIP & AUTHORIZATION TESTS
# ==============================================================================
print("\n" + "=" * 50)
print("SECTION 5: EVIDENCE OWNERSHIP & AUTHORIZATION")
print("=" * 50)

import asyncio

def make_upload_file(filename: str, content: bytes):
    return UploadFile(filename=filename, file=BytesIO(content))

# Test 5.1: Authenticated Evidence Upload (by test_inv1)
upload_payload = b"Top secret forensic investigation notes for test_inv1."
test_file = make_upload_file("inv1_evidence.txt", upload_payload)

db.query(Case).filter(Case.case_number == "CASE-AUTH-1234").delete(synchronize_session=False)
test_case = Case(case_number="CASE-AUTH-1234", case_name="Auth Test Case", status="OPEN", created_by=inv1.id)
db.add(test_case)
db.commit()
db.refresh(test_case)

async def test_upload():
    return await upload_evidence(request=req, case_id=test_case.id, file=test_file, db=db, current_user=inv1)

upload_result = asyncio.run(test_upload())
evidence_id = upload_result["evidence"]["id"]
assert upload_result["evidence"]["uploaded_by"] == inv1.id
assert upload_result["evidence"]["status"] == "PENDING"
assert upload_result["evidence"]["encrypted"] is True
print(f"  5.1 Authenticated Evidence Upload: PASS (Evidence ID={evidence_id}, uploaded_by={inv1.id})")

# Test 5.2: Investigator 1 can view own evidence
inv1_evidence = get_evidence(evidence_id, db, inv1)
assert inv1_evidence.id == evidence_id
assert inv1_evidence.uploaded_by == inv1.id
print("  5.2 Investigator Accessing Own Evidence: PASS")

# Test 5.3: Investigator 2 ATTEMPTING to view Investigator 1's evidence -> 403 Forbidden
try:
    get_evidence(evidence_id, db, inv2)
    raise AssertionError("Investigator 2 was allowed to view Investigator 1's evidence!")
except HTTPException as e:
    assert e.status_code == 403
    print(f"  5.3 Unauthorized Evidence Access Blocked (HTTP {e.status_code}): PASS")

# Test 5.4: Investigator 2 ATTEMPTING to verify Investigator 1's evidence -> 403 Forbidden
try:
    verify_evidence(evidence_id, req, db, inv2)
    raise AssertionError("Investigator 2 was allowed to verify Investigator 1's evidence!")
except HTTPException as e:
    assert e.status_code == 403
    print(f"  5.4 Unauthorized Evidence Verification Blocked (HTTP {e.status_code}): PASS")

# Test 5.5: Investigator 1 can verify own evidence -> VALID
verify_res_inv1 = verify_evidence(evidence_id, req, db, inv1)
assert verify_res_inv1["status"] == "VALID"
assert verify_res_inv1["stored_hash"] == verify_res_inv1["current_hash"]
print(f"  5.5 Investigator 1 Verification of Own Evidence: PASS (status={verify_res_inv1['status']})")

# Test 5.6: Admin can access and verify any evidence
admin_evidence_view = get_evidence(evidence_id, db, admin)
assert admin_evidence_view.id == evidence_id
admin_verify_res = verify_evidence(evidence_id, req, db, admin)
assert admin_verify_res["status"] == "VALID"
print("  5.6 ADMIN Access and Verification of Any Evidence: PASS")

# Test 5.7: Evidence Filtering (List evidence)
inv1_list = list_evidence(db, inv1)
inv1_ids = [e.id for e in inv1_list]
assert evidence_id in inv1_ids

inv2_list = list_evidence(db, inv2)
inv2_ids = [e.id for e in inv2_list]
assert evidence_id not in inv2_ids, "Investigator 2 saw Investigator 1's evidence in list!"
print("  5.7 Role-based Evidence List Isolation: PASS (Investigator 2 does not see Inv 1's evidence)")

# ==============================================================================
# SECTION 6: AUDIT LOGGING VERIFICATION
# ==============================================================================
print("\n" + "=" * 50)
print("SECTION 6: AUDIT LOGGING TESTS")
print("=" * 50)

recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()
assert len(recent_logs) > 0

actions_logged = {log.action for log in recent_logs}
print(f"  Recorded audit actions: {actions_logged}")

assert "USER_REGISTERED" in actions_logged
assert "LOGIN_SUCCESS" in actions_logged
assert "LOGIN_FAILED" in actions_logged
assert "USER_DEACTIVATED" in actions_logged
assert "USER_REACTIVATED" in actions_logged
assert "EVIDENCE_UPLOADED" in actions_logged
assert "EVIDENCE_VERIFIED" in actions_logged

# Security check: Ensure NO secrets/passwords/hashes are in audit logs
for log in recent_logs:
    detail = str(log.detail or "")
    assert "InvestigatorPass" not in detail, "Plaintext password found in audit log!"
    assert "$2b$12$" not in detail, "Password hash found in audit log!"
    assert "Bearer" not in detail, "Token found in audit log!"
print("  6.1 All Critical Security Actions Logged: PASS")
print("  6.2 Zero Secrets / Passwords / Hashes in Audit Logs: PASS")

# ==============================================================================
# SECTION 7: FULL REGRESSION TEST — CRYPTO & EXISTING EVIDENCE
# ==============================================================================
print("\n" + "=" * 50)
print("SECTION 7: FULL REGRESSION & EXISTING EVIDENCE VERIFICATION")
print("=" * 50)

# Test 7.1: Verify All 5 Original Records exist and have uploaded_by=None
cursor = db.connection().connection.cursor()
cursor.execute("SELECT id, filename, file_hash, verification_status, storage_path, uploaded_by FROM evidence WHERE id <= 5 ORDER BY id")
original_records = cursor.fetchall()
assert len(original_records) == 5, f"Expected 5 original evidence records, found {len(original_records)}"

print("  Original 5 Evidence Records Status in DB:")
for r in original_records:
    eid, fname, fhash, status_val, spath, up_by = r
    print(f"    ID={eid}: '{fname}' | status={status_val} | uploaded_by={up_by}")
    assert up_by is None, f"Original evidence ID {eid} uploaded_by was modified unexpectedly!"

# Test 7.2: Verify Evidence ID 5 (clean stored file) via verify endpoint
v_res_5 = verify_evidence(5, req, db, admin)
assert v_res_5["status"] == "VALID"
print(f"  7.2 Legacy VALID Evidence ID 5 ({v_res_5['filename']}): VERIFIED VALID")

# Test 7.3: Protected files unchanged
from app.services.encryption_service import encrypt_data, decrypt_data, cipher

test_raw = b"SecureVault 2.0 Regression Cryptographic Verification Payload"
enc = encrypt_data(test_raw)
dec = cipher.decrypt(enc)
assert dec == test_raw
print("  7.3 Fernet Symmetric Encryption/Decryption Roundtrip: PASS")

# Clean up test evidence file created in test
from app.models.custody_event import CustodyEvent
db.query(CustodyEvent).filter(CustodyEvent.evidence_id == evidence_id).delete(synchronize_session=False)

test_ev_record = db.query(Evidence).filter(Evidence.id == evidence_id).first()
if test_ev_record:
    if os.path.exists(test_ev_record.storage_path):
        try:
            os.remove(test_ev_record.storage_path)
        except Exception:
            pass
    db.delete(test_ev_record)
    db.commit()

db.query(Case).filter(Case.id == test_case.id).delete(synchronize_session=False)

# Clean up test users created in test
db.query(User).filter(User.username.like("test_%")).delete()
db.commit()

db.close()

print("\n" + "=" * 70)
print("ALL SECTIONS COMPLETED: 100% OF TESTS PASSED")
print("=" * 70)
