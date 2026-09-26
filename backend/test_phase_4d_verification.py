"""
Phase 4D Integration and Verification Tests for SecureVault 2.0
Validates read-only blockchain verification against Ethereum Sepolia EvidenceRegistry smart contract.
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
from app.services.blockchain_service import (
    get_blockchain_diagnostics,
    get_onchain_proof,
    verify_evidence_onchain
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("securevault.test_phase_4d")


def run_phase_4d_tests():
    print("=" * 70)
    print(" SecureVault 2.0 - Phase 4D Blockchain Verification Tests")
    print("=" * 70)

    client = TestClient(app)
    db = SessionLocal()

    try:
        # Ensure test users exist
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
        # TEST 1: Live Verification of Anchored Evidence (Evidence ID 19)
        # -------------------------------------------------------------
        print("\n--- TEST 1: Live Blockchain Verification for Evidence ID 19 ---")
        evidence_19 = db.query(Evidence).filter(Evidence.id == 19).first()
        assert evidence_19 is not None, "Evidence ID 19 not found in database. Run Phase 4C first."

        res = client.post("/api/evidence/19/blockchain/verify", headers=admin_headers)
        assert res.status_code == 200, f"Verification request failed: {res.text}"
        data = res.json()

        logger.info(f"Verification Result for Evidence #19:\n{data}")

        assert data["evidence_id"] == 19
        assert data["blockchain_verified"] is True
        assert data["evidence_hash_match"] is True
        assert data["ipfs_cid_match"] is True
        assert data["custody_hash_match"] is True
        assert data["onchain_exists"] is True
        assert data["transaction_hash"] == evidence_19.blockchain_tx
        assert data["block_number"] == 11777243
        assert data["anchored_by"].lower() == "0xd469fd53dbd6a28272d312622736ffc57237c1b5".lower()
        assert len(data["mismatches"]) == 0

        # Also test GET endpoint
        res_get = client.get("/api/evidence/19/blockchain/verify", headers=admin_headers)
        assert res_get.status_code == 200
        assert res_get.json()["blockchain_verified"] is True

        # Verify audit log was recorded
        audit = db.query(AuditLog).filter(
            AuditLog.resource_type == "evidence",
            AuditLog.resource_id == 19,
            AuditLog.action == "BLOCKCHAIN_VERIFIED"
        ).order_by(AuditLog.id.desc()).first()
        assert audit is not None, "BLOCKCHAIN_VERIFIED audit log was not recorded."
        print(" [PASS] TEST 1: Live on-chain verification passed with 100% cryptographic match.")

        # -------------------------------------------------------------
        # TEST 2: Non-Existent Evidence
        # -------------------------------------------------------------
        print("\n--- TEST 2: Non-Existent Evidence (ID 999999) ---")
        res_404 = client.post("/api/evidence/999999/blockchain/verify", headers=admin_headers)
        assert res_404.status_code == 404, f"Expected 404, got {res_404.status_code}"
        print(" [PASS] TEST 2: Non-existent evidence returned 404 Not Found.")

        # -------------------------------------------------------------
        # TEST 3: Non-Anchored Evidence
        # -------------------------------------------------------------
        print("\n--- TEST 3: Non-Anchored Evidence ---")
        # Create unanchored evidence in DB
        unanchored_evidence = Evidence(
            case_id=evidence_19.case_id,
            filename="unanchored_test_file.txt",
            file_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            file_size=0,
            storage_path="DEPRECATED_LOCAL_STORAGE",
            ipfs_cid="QmTestNonAnchoredCID12345",
            blockchain_tx=None,
            uploaded_by=admin.id
        )
        db.add(unanchored_evidence)
        db.commit()
        db.refresh(unanchored_evidence)

        res_unanchored = client.post(f"/api/evidence/{unanchored_evidence.id}/blockchain/verify", headers=admin_headers)
        assert res_unanchored.status_code == 200
        unanchored_data = res_unanchored.json()
        logger.info(f"Unanchored verification response: {unanchored_data}")
        assert unanchored_data["blockchain_verified"] is False
        assert unanchored_data["onchain_exists"] is False
        assert "not_anchored_onchain" in unanchored_data["mismatches"] or "no_blockchain_tx" in unanchored_data["mismatches"]

        audit_failed = db.query(AuditLog).filter(
            AuditLog.resource_type == "evidence",
            AuditLog.resource_id == unanchored_evidence.id,
            AuditLog.action == "BLOCKCHAIN_VERIFICATION_FAILED"
        ).first()
        assert audit_failed is not None, "BLOCKCHAIN_VERIFICATION_FAILED audit entry missing."
        print(" [PASS] TEST 3: Unanchored evidence correctly evaluated as blockchain_verified = False.")

        # -------------------------------------------------------------
        # TEST 4: Safe Tamper & Mismatch Simulation (Unit & Service Level)
        # -------------------------------------------------------------
        print("\n--- TEST 4: Safe Tamper & Mismatch Simulation ---")
        # 4a: Tampered SHA-256 Hash
        tampered_sha = verify_evidence_onchain(
            evidence_id=19,
            file_hash="0000000000000000000000000000000000000000000000000000000000tamper",
            ipfs_cid="QmVV8BLHS8wAb7HveMH37spEUwzskyesPGx57b9GKeqdqu",
            current_custody_hash="615cef58e85833655b437bd046f7020e29663b366f8a9fd424c7b67a2427dd82",
            blockchain_tx="0xa4da5e162d3165b5be71a7672e0d0a5ff8ed5b21bad33e3520d34b981f3bf860"
        )
        assert tampered_sha["blockchain_verified"] is False
        assert tampered_sha["evidence_hash_match"] is False
        assert "evidence_hash" in tampered_sha["mismatches"]
        assert tampered_sha["ipfs_cid_match"] is True
        assert tampered_sha["custody_hash_match"] is True
        logger.info(f"Tampered SHA test: mismatches = {tampered_sha['mismatches']}")

        # 4b: Tampered IPFS CID
        tampered_ipfs = verify_evidence_onchain(
            evidence_id=19,
            file_hash="88c8790821ab5d949f20b843b12589f510843218afcbf31fdace2e228ba6b010",
            ipfs_cid="QmTamperedIPFSCID99999999999999999999999999",
            current_custody_hash="615cef58e85833655b437bd046f7020e29663b366f8a9fd424c7b67a2427dd82",
            blockchain_tx="0xa4da5e162d3165b5be71a7672e0d0a5ff8ed5b21bad33e3520d34b981f3bf860"
        )
        assert tampered_ipfs["blockchain_verified"] is False
        assert tampered_ipfs["ipfs_cid_match"] is False
        assert "ipfs_cid" in tampered_ipfs["mismatches"]
        assert tampered_ipfs["evidence_hash_match"] is True
        logger.info(f"Tampered IPFS test: mismatches = {tampered_ipfs['mismatches']}")

        # 4c: Tampered / Legitimate New Custody Event (Custody Hash Mismatch)
        tampered_custody = verify_evidence_onchain(
            evidence_id=19,
            file_hash="88c8790821ab5d949f20b843b12589f510843218afcbf31fdace2e228ba6b010",
            ipfs_cid="QmVV8BLHS8wAb7HveMH37spEUwzskyesPGx57b9GKeqdqu",
            current_custody_hash="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            blockchain_tx="0xa4da5e162d3165b5be71a7672e0d0a5ff8ed5b21bad33e3520d34b981f3bf860"
        )
        assert tampered_custody["blockchain_verified"] is False
        assert tampered_custody["custody_hash_match"] is False
        assert "custody_hash" in tampered_custody["mismatches"]
        assert tampered_custody["evidence_hash_match"] is True
        assert tampered_custody["ipfs_cid_match"] is True
        logger.info(f"Tampered Custody test: mismatches = {tampered_custody['mismatches']}")
        print(" [PASS] TEST 4: Tamper simulations correctly caught specific mismatches.")

        # -------------------------------------------------------------
        # TEST 5: Role-Based Access Control (RBAC)
        # -------------------------------------------------------------
        print("\n--- TEST 5: RBAC Authorization ---")
        # Evidence 19 uploaded by admin/first user
        # Investigator 2 (who did not upload evidence 19) should get 403 Forbidden
        if evidence_19.uploaded_by != investigator_2.id:
            res_forbidden = client.post("/api/evidence/19/blockchain/verify", headers=inv2_headers)
            assert res_forbidden.status_code == 403, f"Expected 403 Forbidden, got {res_forbidden.status_code}"
            print(" [PASS] TEST 5: Investigator 2 unauthorized access correctly denied (403 Forbidden).")

        # Admin access permitted
        res_admin = client.post("/api/evidence/19/blockchain/verify", headers=admin_headers)
        assert res_admin.status_code == 200
        print(" [PASS] TEST 5: Admin access permitted.")

        print("\n" + "=" * 70)
        print(" ALL PHASE 4D TESTS PASSED (100% SUCCESS)")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    run_phase_4d_tests()
