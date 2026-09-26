import asyncio
import os
import sys
from io import BytesIO

from dotenv import load_dotenv

load_dotenv()

from app.database import SessionLocal
from app.models.user import User
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.custody_event import CustodyEvent
from app.routers.auth import register_user
from app.routers.evidence import upload_evidence, verify_evidence, download_evidence
from app.routers.custody import transfer_custody, add_manual_custody_event, verify_chain
from app.schemas.user import UserRegisterRequest
from app.schemas.custody_event import CustodyEventCreate, TransferCustodyRequest
from fastapi import UploadFile

class DummyClient:
    def __init__(self, host="127.0.0.1"):
        self.host = host

class DummyRequest:
    def __init__(self, host="127.0.0.1"):
        self.client = DummyClient(host)

req = DummyRequest()
db = SessionLocal()

print("=" * 70)
print("SECUREVAULT 2.0 — PHASE 3 (CHAIN OF CUSTODY) TEST SUITE")
print("=" * 70)

# Setup Test Users
db.query(CustodyEvent).filter(CustodyEvent.evidence.has(Evidence.filename == "custody_test.txt")).delete(synchronize_session=False)
db.query(Evidence).filter(Evidence.filename == "custody_test.txt").delete(synchronize_session=False)
db.query(User).filter(User.username.like("cust_test_%")).delete(synchronize_session=False)
db.commit()

db.query(Case).filter(Case.case_name == "Custody Test Case").delete(synchronize_session=False)

inv1 = User(username="cust_test_inv1", email="c1@sv.com", password_hash="hash", role="INVESTIGATOR", is_active=True)
inv2 = User(username="cust_test_inv2", email="c2@sv.com", password_hash="hash", role="INVESTIGATOR", is_active=True)
db.add_all([inv1, inv2])
db.commit()
db.refresh(inv1)
db.refresh(inv2)

test_case = Case(case_number="CASE-TEST-1234", case_name="Custody Test Case", status="OPEN", created_by=inv1.id)
db.add(test_case)
db.commit()
db.refresh(test_case)

# 1. Upload => REGISTERED
print("\n--- 1. Testing Upload (REGISTERED) ---")
async def do_upload():
    f = UploadFile(filename="custody_test.txt", file=BytesIO(b"Custody payload"))
    return await upload_evidence(request=req, case_id=test_case.id, file=f, db=db, current_user=inv1)
upl_res = asyncio.run(do_upload())
evidence_id = upl_res["evidence"]["id"]
events = db.query(CustodyEvent).filter_by(evidence_id=evidence_id).order_by(CustodyEvent.id).all()
assert len(events) == 1
assert events[0].event_type == "REGISTERED"
print(f"PASS: Upload instantiated REGISTERED event (Event ID: {events[0].id}, Hash: {events[0].event_hash[:8]}...)")

# 2. Download => ACCESSED
print("\n--- 2. Testing Download (ACCESSED) ---")
download_evidence(evidence_id, req, db, inv1)
events = db.query(CustodyEvent).filter_by(evidence_id=evidence_id).order_by(CustodyEvent.id).all()
assert len(events) == 2
assert events[1].event_type == "ACCESSED"
assert events[1].previous_event_hash == events[0].event_hash
print(f"PASS: Download logged ACCESSED event (Event ID: {events[1].id}, Prev Hash matched)")

# 3. Verify => VERIFIED
print("\n--- 3. Testing Verify (VERIFIED) ---")
verify_evidence(evidence_id, req, db, inv1)
events = db.query(CustodyEvent).filter_by(evidence_id=evidence_id).order_by(CustodyEvent.id).all()
assert len(events) == 3
assert events[2].event_type == "VERIFIED"
assert events[2].previous_event_hash == events[1].event_hash
print(f"PASS: Verify logged VERIFIED event")

# 4. Transfer => TRANSFERRED
print("\n--- 4. Testing Custody Transfer (TRANSFERRED) ---")
t_req = TransferCustodyRequest(to_user_id=inv2.id, description="Handing over case")
transfer_custody(evidence_id, t_req, db, inv1)
events = db.query(CustodyEvent).filter_by(evidence_id=evidence_id).order_by(CustodyEvent.id).all()
assert len(events) == 4
assert events[3].event_type == "TRANSFERRED"
assert events[3].from_user_id == inv1.id
assert events[3].to_user_id == inv2.id
print(f"PASS: Transfer logged TRANSFERRED event from Inv1 to Inv2")

# 5. Manual Event => EXAMINED
print("\n--- 5. Testing Manual Event (EXAMINED) ---")
m_req = CustodyEventCreate(event_type="EXAMINED", description="Analyzed file headers")
add_manual_custody_event(evidence_id, m_req, db, inv2)
events = db.query(CustodyEvent).filter_by(evidence_id=evidence_id).order_by(CustodyEvent.id).all()
assert len(events) == 5
assert events[4].event_type == "EXAMINED"
assert events[4].user_id == inv2.id
print(f"PASS: Exmained event logged by Inv2")

# 6. Verify Full Chain (VALID)
print("\n--- 6. Testing Full Cryptographic Link verification ---")
chain_verify = verify_chain(evidence_id, db, inv2)
assert chain_verify["status"] == "VALID"
print(f"PASS: Cryptographic Chain is VALID")

# 7. Tamper with the chain => INVALID
print("\n--- 7. Tampering with Chain (INVALID) ---")
events[2].description = "Tampered verified event!"
db.commit()
chain_verify_tampered = verify_chain(evidence_id, db, inv2)
assert chain_verify_tampered["status"] == "INVALID"
print("MESSAGE:", chain_verify_tampered["message"])
print(f"PASS: Cryptographic Chain detected Tampering (status={chain_verify_tampered['status']})")

print("\n" + "=" * 70)
print("ALL PHASE 3 END-TO-END TESTS PASSED SUCCESSFULLY!")
print("=" * 70)

# Cleanup
db.query(CustodyEvent).filter_by(evidence_id=evidence_id).delete()
db.query(Evidence).filter_by(id=evidence_id).delete()
db.query(User).filter(User.username.like("cust_test_%")).delete()
db.commit()
db.close()
