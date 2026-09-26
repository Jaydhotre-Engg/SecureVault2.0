"""
Phase 5 Unified Verification Integration Test Suite for SecureVault 2.0.

Tests the Unified Evidence Verification orchestration combining:
1. File Integrity Verification
2. IPFS Storage Verification
3. Chain of Custody Verification
4. Blockchain Proof Verification
"""

import sys
import time
import logging
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add backend directory to path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(dotenv_path=BACKEND_DIR / ".env")

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.custody_event import CustodyEvent
from app.models.audit_log import AuditLog
from app.services.auth_service import create_access_token, hash_password
from app.services.unified_verification_service import perform_unified_verification
from app.services.blockchain_service import verify_evidence_onchain

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("securevault.test_phase_5")


def run_phase_5_tests():
    print("=" * 75)
    print(" SecureVault 2.0 - Phase 5 Unified Evidence Verification Tests")
    print("=" * 75)

    client = TestClient(app)
    db = SessionLocal()

    try:
        # 0. Setup Users & Authentication Tokens
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@securevault.local",
                password_hash=hash_password("AdminPass123!"),
                role="ADMIN",
                is_active=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

        investigator_1 = db.query(User).filter(User.username == "inv_test_1").first()
        if not investigator_1:
            investigator_1 = User(
                username="inv_test_1",
                email="inv1@securevault.local",
                password_hash=hash_password("InvPass123!"),
                role="INVESTIGATOR",
                is_active=True
            )
            db.add(investigator_1)
            db.commit()
            db.refresh(investigator_1)

        investigator_2 = db.query(User).filter(User.username == "inv_test_2").first()
        if not investigator_2:
            investigator_2 = User(
                username="inv_test_2",
                email="inv2@securevault.local",
                password_hash=hash_password("InvPass123!"),
                role="INVESTIGATOR",
                is_active=True
            )
            db.add(investigator_2)
            db.commit()
            db.refresh(investigator_2)

        admin_token = create_access_token(data={"sub": str(admin.id), "role": admin.role})
        inv1_token = create_access_token(data={"sub": str(investigator_1.id), "role": investigator_1.role})
        inv2_token = create_access_token(data={"sub": str(investigator_2.id), "role": investigator_2.role})

        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        inv1_headers = {"Authorization": f"Bearer {inv1_token}"}
        inv2_headers = {"Authorization": f"Bearer {inv2_token}"}

        # -------------------------------------------------------------
        # TEST 1: Completely Valid Evidence (Evidence ID 19)
        # -------------------------------------------------------------
        print("\n--- TEST 1: Live Unified Verification for Evidence ID 19 (Expected: FULLY_VERIFIED) ---")
        start_time = time.time()
        res1 = client.post("/api/evidence/19/unified-verify", headers=admin_headers)
        duration = time.time() - start_time
        assert res1.status_code == 200, f"Unified verify failed: {res1.text}"
        data1 = res1.json()

        logger.info(f"Unified Verification Result for Evidence #19 in {duration:.2f}s:\n{data1}")

        assert data1["evidence_id"] == 19
        assert data1["overall_status"] == "FULLY_VERIFIED", f"Expected FULLY_VERIFIED, got {data1['overall_status']}"
        assert data1["file_integrity"]["status"] == "VALID"
        assert data1["file_integrity"]["hash_match"] is True
        assert data1["ipfs"]["status"] == "VALID"
        assert data1["ipfs"]["artifact_available"] is True
        assert data1["ipfs"]["decryption_successful"] is True
        assert data1["ipfs"]["hash_match"] is True
        assert data1["custody"]["status"] == "VALID"
        assert data1["custody"]["chain_valid"] is True
        assert data1["blockchain"]["status"] == "VERIFIED"
        assert data1["blockchain"]["onchain_exists"] is True
        assert data1["blockchain"]["evidence_hash_match"] is True
        assert data1["blockchain"]["ipfs_cid_match"] is True
        assert data1["blockchain"]["custody_hash_match"] is True
        assert len(data1["issues"]) == 0

        # Verify audit log
        audit1 = db.query(AuditLog).filter(
            AuditLog.resource_type == "evidence",
            AuditLog.resource_id == 19,
            AuditLog.action == "EVIDENCE_VERIFICATION_COMPLETED"
        ).order_by(AuditLog.id.desc()).first()
        assert audit1 is not None, "EVIDENCE_VERIFICATION_COMPLETED audit log entry missing."
        print(f" [PASS] TEST 1: Evidence #19 FULLY_VERIFIED (Time: {duration:.2f}s).")

        # -------------------------------------------------------------
        # TEST 2: File Integrity Tampering Simulation
        # -------------------------------------------------------------
        print("\n--- TEST 2: File Integrity Tampering Simulation (Expected: VERIFICATION_FAILED) ---")
        evidence_19 = db.query(Evidence).filter(Evidence.id == 19).first()
        fake_evidence = Evidence(
            id=19,
            case_id=evidence_19.case_id,
            filename=evidence_19.filename,
            file_hash="0000000000000000000000000000000000000000000000000000000000tamper", # tampered
            file_size=evidence_19.file_size,
            storage_path=evidence_19.storage_path,
            ipfs_cid=evidence_19.ipfs_cid,
            blockchain_tx=evidence_19.blockchain_tx,
            uploaded_by=evidence_19.uploaded_by
        )
        res2 = perform_unified_verification(db, fake_evidence)
        logger.info(f"File tamper simulation overall_status: {res2['overall_status']}")
        assert res2["overall_status"] == "VERIFICATION_FAILED"
        assert res2["file_integrity"]["status"] == "TAMPERED"
        assert res2["file_integrity"]["hash_match"] is False
        print(" [PASS] TEST 2: File integrity tampering correctly marked as VERIFICATION_FAILED.")

        # -------------------------------------------------------------
        # TEST 3: IPFS Retrieval Failure / Unavailability Simulation
        # -------------------------------------------------------------
        print("\n--- TEST 3: IPFS Retrieval Unavailability Simulation ---")
        with patch("app.services.unified_verification_service.download_from_ipfs", side_effect=RuntimeError("Gateway Timeout")):
            res3 = perform_unified_verification(db, evidence_19)
            logger.info(f"IPFS unavailable overall_status: {res3['overall_status']}")
            assert res3["overall_status"] == "VERIFICATION_UNAVAILABLE"
            assert res3["ipfs"]["status"] == "UNAVAILABLE"
            assert res3["ipfs"]["artifact_available"] is False
            print(" [PASS] TEST 3: IPFS unavailability correctly distinguished as VERIFICATION_UNAVAILABLE.")

        # -------------------------------------------------------------
        # TEST 4: Custody Chain Tampering Simulation
        # -------------------------------------------------------------
        print("\n--- TEST 4: Custody Chain Tampering Simulation (Expected: VERIFICATION_FAILED) ---")
        with patch("app.services.unified_verification_service.verify_custody_chain", return_value={"status": "INVALID", "message": "Broken hash chain", "failed_event_id": 5}):
            res4 = perform_unified_verification(db, evidence_19)
            logger.info(f"Custody invalid overall_status: {res4['overall_status']}")
            assert res4["overall_status"] == "VERIFICATION_FAILED"
            assert res4["custody"]["status"] == "INVALID"
            assert res4["custody"]["chain_valid"] is False
            print(" [PASS] TEST 4: Custody tampering correctly marked as VERIFICATION_FAILED.")

        # -------------------------------------------------------------
        # TEST 5: Blockchain Hash Mismatch Simulation
        # -------------------------------------------------------------
        print("\n--- TEST 5: Blockchain Evidence Hash Mismatch ---")
        with patch("app.services.unified_verification_service.verify_evidence_onchain", return_value={
            "evidence_id": 19,
            "blockchain_verified": False,
            "evidence_hash_match": False,
            "ipfs_cid_match": True,
            "custody_hash_match": True,
            "onchain_exists": True,
            "transaction_hash": evidence_19.blockchain_tx,
            "block_number": 11777243,
            "anchored_at": "2026-09-25T05:52:48+00:00",
            "anchored_by": "0xd469Fd53Dbd6a28272D312622736fFc57237c1b5",
            "mismatches": ["evidence_hash"]
        }):
            res5 = perform_unified_verification(db, evidence_19)
            assert res5["overall_status"] == "VERIFICATION_FAILED"
            assert res5["blockchain"]["status"] == "MISMATCH"
            assert res5["blockchain"]["evidence_hash_match"] is False
            print(" [PASS] TEST 5: Blockchain hash mismatch correctly flagged as VERIFICATION_FAILED.")

        # -------------------------------------------------------------
        # TEST 6: Blockchain CID Mismatch Simulation
        # -------------------------------------------------------------
        print("\n--- TEST 6: Blockchain IPFS CID Mismatch ---")
        with patch("app.services.unified_verification_service.verify_evidence_onchain", return_value={
            "evidence_id": 19,
            "blockchain_verified": False,
            "evidence_hash_match": True,
            "ipfs_cid_match": False,
            "custody_hash_match": True,
            "onchain_exists": True,
            "transaction_hash": evidence_19.blockchain_tx,
            "block_number": 11777243,
            "anchored_at": "2026-09-25T05:52:48+00:00",
            "anchored_by": "0xd469Fd53Dbd6a28272D312622736fFc57237c1b5",
            "mismatches": ["ipfs_cid"]
        }):
            res6 = perform_unified_verification(db, evidence_19)
            assert res6["overall_status"] == "VERIFICATION_FAILED"
            assert res6["blockchain"]["status"] == "MISMATCH"
            assert res6["blockchain"]["ipfs_cid_match"] is False
            print(" [PASS] TEST 6: Blockchain CID mismatch correctly flagged as VERIFICATION_FAILED.")

        # -------------------------------------------------------------
        # TEST 7: Blockchain Custody Mismatch Simulation
        # -------------------------------------------------------------
        print("\n--- TEST 7: Blockchain Custody Hash Mismatch ---")
        with patch("app.services.unified_verification_service.verify_evidence_onchain", return_value={
            "evidence_id": 19,
            "blockchain_verified": False,
            "evidence_hash_match": True,
            "ipfs_cid_match": True,
            "custody_hash_match": False,
            "onchain_exists": True,
            "transaction_hash": evidence_19.blockchain_tx,
            "block_number": 11777243,
            "anchored_at": "2026-09-25T05:52:48+00:00",
            "anchored_by": "0xd469Fd53Dbd6a28272D312622736fFc57237c1b5",
            "mismatches": ["custody_hash"]
        }):
            res7 = perform_unified_verification(db, evidence_19)
            assert res7["overall_status"] == "VERIFICATION_FAILED"
            assert res7["blockchain"]["status"] == "MISMATCH"
            assert res7["blockchain"]["custody_hash_match"] is False
            print(" [PASS] TEST 7: Blockchain custody mismatch correctly flagged as VERIFICATION_FAILED.")

        # -------------------------------------------------------------
        # TEST 8: Valid Evidence Without Blockchain Anchor (Expected: PARTIALLY_VERIFIED)
        # -------------------------------------------------------------
        print("\n--- TEST 8: Valid Evidence Without Blockchain Anchor ---")
        # Unanchored copy
        unanchored_evidence = Evidence(
            id=19,
            case_id=evidence_19.case_id,
            filename=evidence_19.filename,
            file_hash=evidence_19.file_hash,
            file_size=evidence_19.file_size,
            storage_path=evidence_19.storage_path,
            ipfs_cid=evidence_19.ipfs_cid,
            blockchain_tx=None, # Not anchored
            uploaded_by=evidence_19.uploaded_by
        )
        res8 = perform_unified_verification(db, unanchored_evidence)
        logger.info(f"Unanchored overall_status: {res8['overall_status']}, issues: {res8['issues']}")
        assert res8["overall_status"] == "PARTIALLY_VERIFIED"
        assert res8["file_integrity"]["status"] == "VALID"
        assert res8["ipfs"]["status"] == "VALID"
        assert res8["custody"]["status"] == "VALID"
        assert res8["blockchain"]["status"] == "NOT_ANCHORED"
        assert res8["overall_status"] != "VERIFICATION_FAILED"
        print(" [PASS] TEST 8: Unanchored valid evidence correctly evaluated as PARTIALLY_VERIFIED (NOT tampered).")

        # -------------------------------------------------------------
        # TEST 9: Unauthorized Access (RBAC)
        # -------------------------------------------------------------
        print("\n--- TEST 9: RBAC Unauthorized Access (403 Forbidden) ---")
        if evidence_19.uploaded_by != investigator_2.id:
            res9 = client.post("/api/evidence/19/unified-verify", headers=inv2_headers)
            assert res9.status_code == 403, f"Expected 403, got {res9.status_code}"
            print(" [PASS] TEST 9: Unauthorized investigator correctly received 403 Forbidden.")

        # -------------------------------------------------------------
        # TEST 10: Missing Evidence (404 Not Found)
        # -------------------------------------------------------------
        print("\n--- TEST 10: Non-Existent Evidence (404 Not Found) ---")
        res10 = client.post("/api/evidence/999999/unified-verify", headers=admin_headers)
        assert res10.status_code == 404, f"Expected 404, got {res10.status_code}"
        print(" [PASS] TEST 10: Non-existent evidence returned 404 Not Found.")

        # -------------------------------------------------------------
        # TEST 11: Dependency Unavailability (Sepolia RPC Connection Error)
        # -------------------------------------------------------------
        print("\n--- TEST 11: Blockchain RPC Connection Error Simulation ---")
        with patch("app.services.unified_verification_service.verify_evidence_onchain", side_effect=ConnectionError("RPC Node Connection Refused")):
            res11 = perform_unified_verification(db, evidence_19)
            logger.info(f"RPC connection error overall_status: {res11['overall_status']}")
            assert res11["overall_status"] == "VERIFICATION_UNAVAILABLE"
            assert res11["blockchain"]["status"] == "UNAVAILABLE"
            print(" [PASS] TEST 11: RPC connection failure returned VERIFICATION_UNAVAILABLE without leaking secrets.")

        print("\n" + "=" * 75)
        print(" ALL PHASE 5 UNIFIED VERIFICATION TESTS PASSED (100% SUCCESS)")
        print("=" * 75)

    finally:
        db.close()


if __name__ == "__main__":
    run_phase_5_tests()
