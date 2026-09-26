"""
Unified Evidence Verification Service for SecureVault 2.0.

Orchestrates all four security layers:
1. File Integrity Verification (Decrypted buffer vs stored SHA-256)
2. IPFS Decentralized Storage Verification (Pinata gateway retrieval + decryption + hash check)
3. Chain of Custody Verification (Cryptographic event chain integrity)
4. Blockchain Verification (Ethereum Sepolia smart contract proof query)

Computes a deterministic, real-time overall status:
- FULLY_VERIFIED: All 4 verification layers pass 100%.
- PARTIALLY_VERIFIED: Core integrity and custody valid, but evidence is not anchored on blockchain.
- VERIFICATION_FAILED: Security-critical tampering or mismatch detected in any layer.
- VERIFICATION_UNAVAILABLE: External dependency (IPFS gateway, Sepolia RPC) is temporarily unreachable.
"""

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.evidence import Evidence
from app.services.ipfs_service import download_from_ipfs
from app.services.encryption_service import decrypt_data
from app.services.custody_service import verify_custody_chain, get_custody_events
from app.services.blockchain_service import verify_evidence_onchain

logger = logging.getLogger("securevault.unified_verification")


def perform_unified_verification(db: Session, evidence: Evidence) -> Dict[str, Any]:
    """
    Executes a fresh, unified multi-layer verification for a given evidence record.
    Never caches or relies on stale verification state.
    """
    issues = []
    has_tamper_failure = False
    has_unavailable_dependency = False

    # -------------------------------------------------------------
    # LAYER 1: FILE INTEGRITY VERIFICATION
    # -------------------------------------------------------------
    file_integrity_result: Dict[str, Any] = {
        "status": "VALID",
        "hash_match": False,
        "stored_hash": evidence.file_hash,
        "calculated_hash": None,
        "error": None
    }

    try:
        if evidence.ipfs_cid:
            encrypted_data = download_from_ipfs(evidence.ipfs_cid)
        else:
            if not evidence.storage_path or evidence.storage_path == "DEPRECATED_LOCAL_STORAGE":
                raise FileNotFoundError("Artifact not present on IPFS and local storage deprecated")
            abs_path = os.path.abspath(evidence.storage_path)
            with open(abs_path, "rb") as f:
                encrypted_data = f.read()

        decrypted_payload = decrypt_data(encrypted_data)
        calculated_sha = hashlib.sha256(decrypted_payload).hexdigest()
        file_integrity_result["calculated_hash"] = calculated_sha

        if calculated_sha == evidence.file_hash:
            file_integrity_result["status"] = "VALID"
            file_integrity_result["hash_match"] = True
        else:
            file_integrity_result["status"] = "TAMPERED"
            file_integrity_result["hash_match"] = False
            has_tamper_failure = True
            issues.append(f"File integrity mismatch: stored SHA-256 does not match calculated hash.")
    except Exception as e:
        err_msg = str(e)
        logger.warning(f"File integrity check error for evidence #{evidence.id}: {err_msg}")
        if "Failed to retrieve CID" in err_msg or "Connection" in err_msg or "timeout" in err_msg.lower():
            file_integrity_result["status"] = "ERROR"
            file_integrity_result["error"] = "Storage retrieval unavailable"
            has_unavailable_dependency = True
            issues.append(f"File integrity check unavailable: {err_msg}")
        else:
            file_integrity_result["status"] = "TAMPERED"
            file_integrity_result["error"] = f"Payload decryption or verification failed: {err_msg}"
            has_tamper_failure = True
            issues.append(f"File integrity failed: payload corrupted or altered.")

    # -------------------------------------------------------------
    # LAYER 2: IPFS ARTIFACT VERIFICATION
    # -------------------------------------------------------------
    ipfs_result: Dict[str, Any] = {
        "status": "VALID",
        "artifact_available": False,
        "decryption_successful": False,
        "hash_match": False,
        "ipfs_cid": evidence.ipfs_cid,
        "error": None
    }

    if evidence.ipfs_cid:
        try:
            ipfs_encrypted_data = download_from_ipfs(evidence.ipfs_cid)
            ipfs_result["artifact_available"] = True

            try:
                ipfs_decrypted = decrypt_data(ipfs_encrypted_data)
                ipfs_result["decryption_successful"] = True

                ipfs_sha = hashlib.sha256(ipfs_decrypted).hexdigest()
                if ipfs_sha == evidence.file_hash:
                    ipfs_result["hash_match"] = True
                    ipfs_result["status"] = "VALID"
                else:
                    ipfs_result["hash_match"] = False
                    ipfs_result["status"] = "TAMPERED"
                    has_tamper_failure = True
                    issues.append("IPFS artifact hash does not match recorded evidence SHA-256 digest.")
            except Exception as dec_err:
                ipfs_result["decryption_successful"] = False
                ipfs_result["status"] = "TAMPERED"
                ipfs_result["error"] = f"Decryption failed: {str(dec_err)}"
                has_tamper_failure = True
                issues.append("IPFS artifact ciphertext cannot be decrypted with master key.")
        except Exception as ipfs_err:
            ipfs_result["artifact_available"] = False
            ipfs_result["status"] = "UNAVAILABLE"
            ipfs_result["error"] = f"IPFS gateway retrieval failed: {str(ipfs_err)}"
            has_unavailable_dependency = True
            issues.append("IPFS artifact gateway is temporarily unreachable.")
    else:
        ipfs_result["status"] = "NOT_CONFIGURED"
        ipfs_result["error"] = "Evidence record has no assigned IPFS CID (legacy artifact)."

    # -------------------------------------------------------------
    # LAYER 3: CHAIN OF CUSTODY VERIFICATION
    # -------------------------------------------------------------
    custody_events = get_custody_events(db, evidence.id)
    custody_verif = verify_custody_chain(db, evidence.id)
    latest_custody_hash = custody_events[-1].event_hash if custody_events else None
    anchored_custody_hash = custody_events[0].event_hash if custody_events else None

    custody_status = custody_verif.get("status", "INVALID")
    is_custody_valid = (custody_status == "VALID")

    custody_result: Dict[str, Any] = {
        "status": custody_status,
        "chain_valid": is_custody_valid,
        "event_count": len(custody_events),
        "latest_custody_hash": latest_custody_hash,
        "message": custody_verif.get("message", ""),
        "failed_event_id": custody_verif.get("failed_event_id")
    }

    if not is_custody_valid:
        has_tamper_failure = True
        issues.append(f"Chain of Custody validation failed: {custody_result['message']}")

    # -------------------------------------------------------------
    # LAYER 4: BLOCKCHAIN VERIFICATION
    # -------------------------------------------------------------
    blockchain_result: Dict[str, Any] = {
        "status": "NOT_ANCHORED",
        "onchain_exists": False,
        "evidence_hash_match": False,
        "ipfs_cid_match": False,
        "custody_hash_match": False,
        "transaction_hash": evidence.blockchain_tx,
        "block_number": None,
        "anchored_at": None,
        "anchored_by": None,
        "mismatches": [],
        "error": None
    }

    if not evidence.blockchain_tx:
        blockchain_result["status"] = "NOT_ANCHORED"
        blockchain_result["mismatches"].append("no_blockchain_tx")
    else:
        try:
            bc_verif = verify_evidence_onchain(
                evidence_id=evidence.id,
                file_hash=evidence.file_hash,
                ipfs_cid=evidence.ipfs_cid,
                current_custody_hash=anchored_custody_hash,
                blockchain_tx=evidence.blockchain_tx
            )

            blockchain_result["onchain_exists"] = bc_verif.get("onchain_exists", False)
            blockchain_result["evidence_hash_match"] = bc_verif.get("evidence_hash_match", False)
            blockchain_result["ipfs_cid_match"] = bc_verif.get("ipfs_cid_match", False)
            blockchain_result["custody_hash_match"] = bc_verif.get("custody_hash_match", False)
            blockchain_result["block_number"] = bc_verif.get("block_number")
            blockchain_result["anchored_at"] = bc_verif.get("anchored_at")
            blockchain_result["anchored_by"] = bc_verif.get("anchored_by")
            blockchain_result["mismatches"] = bc_verif.get("mismatches", [])

            if not bc_verif.get("onchain_exists"):
                blockchain_result["status"] = "NOT_ANCHORED"
            elif bc_verif.get("blockchain_verified"):
                blockchain_result["status"] = "VERIFIED"
            else:
                blockchain_result["status"] = "MISMATCH"
                has_tamper_failure = True
                issues.append(f"Blockchain proof mismatch detected in: {', '.join(blockchain_result['mismatches'])}")

        except ConnectionError as conn_err:
            blockchain_result["status"] = "UNAVAILABLE"
            blockchain_result["error"] = f"Ethereum Sepolia RPC connection error: {str(conn_err)}"
            has_unavailable_dependency = True
            issues.append("Ethereum Sepolia RPC node is temporarily unreachable.")
        except Exception as bc_err:
            blockchain_result["status"] = "UNAVAILABLE"
            blockchain_result["error"] = str(bc_err)
            has_unavailable_dependency = True
            issues.append(f"Blockchain verification service error: {str(bc_err)}")

    # -------------------------------------------------------------
    # CALCULATE OVERALL VERIFICATION STATUS
    # -------------------------------------------------------------
    if has_tamper_failure:
        overall_status = "VERIFICATION_FAILED"
    elif has_unavailable_dependency:
        overall_status = "VERIFICATION_UNAVAILABLE"
    elif (
        file_integrity_result["status"] == "VALID"
        and (ipfs_result["status"] in ("VALID", "NOT_CONFIGURED"))
        and custody_result["status"] == "VALID"
        and blockchain_result["status"] == "VERIFIED"
    ):
        overall_status = "FULLY_VERIFIED"
    elif (
        file_integrity_result["status"] == "VALID"
        and (ipfs_result["status"] in ("VALID", "NOT_CONFIGURED"))
        and custody_result["status"] == "VALID"
        and blockchain_result["status"] == "NOT_ANCHORED"
    ):
        overall_status = "PARTIALLY_VERIFIED"
        issues.append("Evidence integrity verified; blockchain proof is not anchored.")
    else:
        overall_status = "PARTIALLY_VERIFIED"

    verified_at_iso = datetime.now(timezone.utc).isoformat()

    return {
        "evidence_id": evidence.id,
        "overall_status": overall_status,
        "file_integrity": file_integrity_result,
        "ipfs": ipfs_result,
        "custody": custody_result,
        "blockchain": blockchain_result,
        "issues": issues,
        "verified_at": verified_at_iso
    }
