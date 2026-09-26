"""
Phase 4C Integration Test for SecureVault 2.0
Validates end-to-end Evidence Upload -> IPFS -> Custody Event -> Ethereum Sepolia Anchoring -> On-Chain Verification.
"""

import os
import sys
import io
import time
import logging
from pathlib import Path

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
from app.services.blockchain_service import (
    get_blockchain_diagnostics,
    get_onchain_proof,
    get_wallet_address
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("securevault.test_phase_4c")


def run_integration_test():
    print("=" * 70)
    print(" SecureVault 2.0 - Phase 4C End-to-End Blockchain Integration Test")
    print("=" * 70)

    # 1. Check Blockchain Configuration & Diagnostic
    diag = get_blockchain_diagnostics()
    logger.info(f"Connected to Sepolia   : {diag['connected']}")
    logger.info(f"Chain ID               : {diag['detected_chain_id']} (Matches: {diag['chain_id_matches']})")
    logger.info(f"Contract Address       : {diag['contract_address']}")
    logger.info(f"Contract Accessible    : {diag['contract_accessible']}")
    logger.info(f"Wallet Address         : {diag['wallet_address']}")
    logger.info(f"Wallet Balance         : {diag['balance_eth']:.6f} Sepolia ETH")

    assert diag['connected'], "Web3 is not connected to RPC."
    assert diag['contract_accessible'], "EvidenceRegistry contract is not accessible on-chain."
    assert diag['balance_eth'] > 0.001, "Insufficient balance for on-chain test."

    client = TestClient(app)
    db = SessionLocal()

    try:
        # 2. Setup or retrieve test user and case
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            from app.services.auth_service import get_password_hash
            admin_user = User(
                username="admin",
                email="admin@securevault.local",
                password_hash=get_password_hash("AdminPass123!"),
                role="ADMIN",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        # Generate token with user.id as sub
        first_user = db.query(User).filter(User.is_active == True).first()
        from app.services.auth_service import create_access_token
        token = create_access_token(data={"sub": str(first_user.id), "role": first_user.role})
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create or find an OPEN Case
        open_case = db.query(Case).filter(Case.status == "OPEN").first()
        if not open_case:
            case_number = f"CASE-P4C-{int(time.time())}"
            create_case_res = client.post(
                "/api/cases",
                headers=headers,
                json={
                    "case_number": case_number,
                    "case_name": "Phase 4C Blockchain Verification Case",
                    "description": "Integration test case for blockchain anchoring."
                }
            )
            assert create_case_res.status_code == 200, f"Failed to create case: {create_case_res.text}"
            case_id = create_case_res.json()["id"]
        else:
            case_id = open_case.id

        logger.info(f"Target Case ID: {case_id}")

        # 4. Perform Evidence Upload with Automated Blockchain Anchoring
        test_file_content = f"SecureVault Phase 4C Forensic Artifact Test - Timestamp {time.time()}".encode("utf-8")
        test_filename = f"forensic_artifact_{int(time.time())}.txt"

        logger.info(f"Uploading evidence: {test_filename} ({len(test_file_content)} bytes)...")
        upload_res = client.post(
            "/api/evidence/upload",
            headers=headers,
            data={"case_id": case_id},
            files={"file": (test_filename, io.BytesIO(test_file_content), "text/plain")}
        )

        assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
        res_data = upload_res.json()
        evidence_info = res_data["evidence"]

        evidence_id = evidence_info["id"]
        file_sha256 = evidence_info["sha256"]
        ipfs_cid = evidence_info["ipfs_cid"]
        blockchain_tx = evidence_info["blockchain_tx"]
        blockchain_status = evidence_info["blockchain_status"]

        logger.info("Evidence Upload Succeeded:")
        logger.info(f"  Evidence ID       : {evidence_id}")
        logger.info(f"  SHA-256           : {file_sha256}")
        logger.info(f"  IPFS CID          : {ipfs_cid}")
        logger.info(f"  Blockchain Status : {blockchain_status}")
        logger.info(f"  Blockchain TX     : {blockchain_tx}")

        assert blockchain_status == "ANCHORED", f"Blockchain anchoring failed: {evidence_info.get('blockchain_error')}"
        assert blockchain_tx is not None and blockchain_tx.startswith("0x"), "Invalid blockchain tx hash."

        # 5. Verify Custody Event
        custody_event = db.query(CustodyEvent).filter(
            CustodyEvent.evidence_id == evidence_id,
            CustodyEvent.event_type == "REGISTERED"
        ).first()

        assert custody_event is not None, "REGISTERED custody event was not created."
        custody_hash = custody_event.event_hash
        logger.info(f"  Custody Hash      : {custody_hash}")

        # 6. Verify Audit Trail
        audit_entry = db.query(AuditLog).filter(
            AuditLog.resource_type == "evidence",
            AuditLog.resource_id == evidence_id,
            AuditLog.action == "BLOCKCHAIN_ANCHORED"
        ).first()
        assert audit_entry is not None, "BLOCKCHAIN_ANCHORED audit entry was not recorded."
        logger.info(f"  Audit Action      : {audit_entry.action} logged successfully.")

        # 7. Query On-Chain Proof from Ethereum Sepolia EvidenceRegistry Contract
        logger.info("Querying on-chain proof from Ethereum Sepolia smart contract...")
        onchain_proof = get_onchain_proof(evidence_id)

        logger.info("Retrieved On-Chain Proof from Sepolia:")
        logger.info(f"  On-Chain Evidence ID   : {onchain_proof['evidence_id']}")
        logger.info(f"  On-Chain Evidence SHA  : {onchain_proof['evidence_hash']}")
        logger.info(f"  On-Chain IPFS CID      : {onchain_proof['ipfs_cid']}")
        logger.info(f"  On-Chain Custody Hash  : {onchain_proof['custody_hash']}")
        logger.info(f"  On-Chain Timestamp     : {onchain_proof['timestamp']}")
        logger.info(f"  On-Chain Anchored By   : {onchain_proof['anchored_by']}")
        logger.info(f"  On-Chain Exists        : {onchain_proof['exists']}")

        # Assert Exact 1:1 Match between Database and Ethereum Blockchain
        assert onchain_proof["exists"] is True, "Evidence proof does not exist on-chain."
        assert onchain_proof["evidence_id"] == evidence_id, "Evidence ID mismatch on-chain."
        assert onchain_proof["evidence_hash"] == file_sha256, "SHA-256 hash mismatch on-chain."
        assert onchain_proof["ipfs_cid"] == ipfs_cid, "IPFS CID mismatch on-chain."
        assert onchain_proof["custody_hash"] == custody_hash, "Custody hash mismatch on-chain."
        assert onchain_proof["anchored_by"].lower() == diag["wallet_address"].lower(), "Anchoring wallet mismatch."

        print("\n" + "=" * 70)
        print(" PHASE 4C VERIFICATION RESULT: PASS (100% MATCH)")
        print(f" Evidence ID     : {evidence_id}")
        print(f" SHA-256         : {file_sha256}")
        print(f" IPFS CID        : {ipfs_cid}")
        print(f" Custody Hash    : {custody_hash}")
        print(f" Blockchain TX   : {blockchain_tx}")
        print(f" Contract        : {diag['contract_address']}")
        print(f" Chain ID        : {diag['detected_chain_id']} (Ethereum Sepolia)")
        print(f" On-Chain Match  : PASS")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    run_integration_test()
