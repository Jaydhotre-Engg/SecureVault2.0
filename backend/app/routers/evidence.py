import hashlib
import os
from typing import List
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    Depends,
    HTTPException,
    Request,
    status
)
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.evidence import Evidence
from app.models.user import User
from app.models.case import Case
from app.models.custody_event import CustodyEvent
from app.schemas.evidence import EvidenceResponse, BlockchainVerificationResponse, UnifiedVerificationResponse
# from app.services.file_service import save_encrypted_file # Deprecated in Phase 2D
from app.services.hash_service import calculate_sha256
from app.services.encryption_service import encrypt_data, decrypt_data
from app.services.ipfs_service import upload_to_pinata, download_from_ipfs
from app.services.audit_service import log_audit
from app.services.custody_service import create_custody_event
from app.services.blockchain_service import anchor_evidence, verify_evidence_onchain
from app.services.unified_verification_service import perform_unified_verification
from app.dependencies.auth import get_current_user

router = APIRouter()


@router.post("/upload")
async def upload_evidence(
    request: Request,
    case_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    
    
    """
    Upload and encrypt evidence.

    Security Rules:
    - Requires authenticated user.
    - Automatically links uploaded_by to current_user.id.
    - Encrypts file data using existing Fernet layer.
    - Calculates original SHA-256 hash before encryption.
    - Logs EVIDENCE_UPLOADED audit event.
    """
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="File name is required"
        )
        # Verify that the selected case exists
    case = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    # Verify authorized access to the case
    if current_user.role not in ("ADMIN", "INVESTIGATOR"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to add evidence to this case"
        )

    # Do not allow evidence upload into closed/archived cases
    if case.status != "OPEN":
        raise HTTPException(
            status_code=400,
            detail=f"Case is {case.status}. Evidence can only be added to OPEN cases."
        )
    # Read original evidence
    original_data = await file.read()

    if not original_data:
        raise HTTPException(
            status_code=400,
            detail="File is empty"
        )

    # Calculate SHA-256 of ORIGINAL evidence
    sha256 = hashlib.sha256(original_data).hexdigest()

    # Encrypt original evidence using existing Fernet service
    encrypted_data = encrypt_data(original_data)

    # Phase 2D: Local storage is deprecated.
    # We no longer save the encrypted file locally.
    file_path = "DEPRECATED_LOCAL_STORAGE"

    # Upload the ENCRYPTED artifact to IPFS via Pinata
    try:
        # We upload the ciphertext, appending .enc so Pinata sees it as encrypted
        ipfs_cid = upload_to_pinata(encrypted_data, f"{file.filename}.enc")
    except ValueError as val_err:
        raise HTTPException(
            status_code=500,
            detail=f"IPFS Configuration Error: {str(val_err)}"
        )
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=502,
            detail=f"IPFS Upload Failed: {str(run_err)}"
        )

    # Save metadata with ownership (now including ipfs_cid)
    evidence = Evidence(
        case_id=case.id,
        filename=file.filename,
        file_hash=sha256,
        file_size=len(original_data),
        storage_path=file_path,
        ipfs_cid=ipfs_cid,
        verification_status="PENDING",
        uploaded_by=current_user.id
    )

    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # Trigger Chain of Custody Event
    custody_event = create_custody_event(
        db,
        evidence_id=evidence.id,
        event_type="REGISTERED",
        user_id=current_user.id,
        description="Evidence uploaded and registered."
    )
    db.commit()

    # Log audit event for evidence upload
    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        action="EVIDENCE_UPLOADED",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="evidence",
        resource_id=evidence.id,
        detail=f"Uploaded evidence '{evidence.filename}' (size: {evidence.file_size} bytes, sha256: {evidence.file_hash[:16]}...)",
        ip_address=client_ip
    )

    # Phase 4C: Blockchain Anchoring on Ethereum Sepolia
    blockchain_tx = None
    blockchain_status = "PENDING"
    blockchain_error = None

    try:
        anchor_res = anchor_evidence(
            evidence_id=evidence.id,
            file_hash=evidence.file_hash,
            ipfs_cid=evidence.ipfs_cid,
            custody_hash=custody_event.event_hash
        )
        blockchain_tx = anchor_res["tx_hash"]
        blockchain_status = "ANCHORED"

        # Update evidence record with on-chain transaction hash
        evidence.blockchain_tx = blockchain_tx
        db.commit()
        db.refresh(evidence)

        # Record audit log for successful blockchain anchoring
        log_audit(
            db=db,
            action="BLOCKCHAIN_ANCHORED",
            user_id=current_user.id,
            username=current_user.username,
            resource_type="evidence",
            resource_id=evidence.id,
            detail=f"Evidence #{evidence.id} anchored to Ethereum Sepolia: Tx {blockchain_tx} in block {anchor_res['block_number']}",
            ip_address=client_ip
        )
    except Exception as bc_err:
        blockchain_status = "FAILED"
        blockchain_error = str(bc_err)
        # Log failure in audit trail without exposing private keys
        log_audit(
            db=db,
            action="BLOCKCHAIN_ANCHOR_FAILED",
            user_id=current_user.id,
            username=current_user.username,
            resource_type="evidence",
            resource_id=evidence.id,
            detail=f"Blockchain anchor failed for evidence #{evidence.id}: {blockchain_error}",
            ip_address=client_ip
        )

    return {
        "message": "Evidence uploaded and encrypted successfully",
        "case": {
            "id": case.id,
            "case_number": case.case_number,
            "case_name": case.case_name
        },
        "evidence": {
            "id": evidence.id,
            "case_id": evidence.case_id,
            "filename": evidence.filename,
            "size": evidence.file_size,
            "sha256": evidence.file_hash,
            "status": evidence.verification_status,
            "uploaded_by": evidence.uploaded_by,
            "ipfs_cid": evidence.ipfs_cid,
            "blockchain_tx": evidence.blockchain_tx,
            "blockchain_status": blockchain_status,
            "blockchain_error": blockchain_error,
            "encrypted": True
        }
    }


@router.get("", response_model=List[EvidenceResponse])
def list_evidence(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List evidence records.

    Access Rules:
    - ADMIN: Can view all evidence records.
    - INVESTIGATOR: Can view own evidence records (plus legacy unassigned records).
    """
    if current_user.role == "ADMIN":
        return db.query(Evidence).order_by(Evidence.id).all()

    # Investigator sees own records or unassigned legacy records
    return db.query(Evidence).filter(
        (Evidence.uploaded_by == current_user.id) | (Evidence.uploaded_by.is_(None))
    ).order_by(Evidence.id).all()


@router.get("/{evidence_id}", response_model=EvidenceResponse)
def get_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve single evidence record.

    Access Rules:
    - ADMIN: Can view any evidence record.
    - INVESTIGATOR: Can only view own or unassigned legacy evidence.
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    # Check authorization
    if current_user.role != "ADMIN" and evidence.uploaded_by is not None and evidence.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this evidence"
        )

    return evidence


@router.post("/{evidence_id}/verify")
def verify_evidence(
    evidence_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify evidence integrity by decrypting in memory and recalculating SHA-256 hash.

    Access Rules:
    - ADMIN: Can verify any evidence record.
    - INVESTIGATOR: Can only verify own or unassigned legacy evidence.
    """
    evidence = db.query(Evidence).filter(
        Evidence.id == evidence_id
    ).first()

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    # Check access permission
    if current_user.role != "ADMIN" and evidence.uploaded_by is not None and evidence.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to verify this evidence"
        )

    try:
        if evidence.ipfs_cid:
            try:
                # Phase 2B/2C: Retrieve encrypted artifact from IPFS
                encrypted_data = download_from_ipfs(evidence.ipfs_cid)
            except Exception as e:
                # Do not silently fall back. If IPFS fails, fail the request.
                raise HTTPException(
                    status_code=502,
                    detail=f"IPFS Retrieval Failed: {str(e)}"
                )
        else:
            # Phase 2D: Fallback for old legacy records that don't have IPFS CID
            if not evidence.storage_path or evidence.storage_path == "DEPRECATED_LOCAL_STORAGE":
                raise HTTPException(
                    status_code=404,
                    detail="Evidence not available on IPFS and local storage represents a deprecated artifact"
                )
            absolute_path = os.path.abspath(evidence.storage_path)
            with open(absolute_path, "rb") as file:
                encrypted_data = file.read()

        # Decrypt in memory using existing Fernet layer
        original_data = decrypt_data(encrypted_data)

        # Calculate hash of decrypted original evidence
        current_hash = hashlib.sha256(original_data).hexdigest()

    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Stored evidence file not found"
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt evidence"
        )

    if current_hash == evidence.file_hash:
        evidence.verification_status = "VALID"
        status_result = "VALID"
        event_type = "VERIFIED"
    else:
        evidence.verification_status = "TAMPERED"
        status_result = "TAMPERED"
        event_type = "INTEGRITY_FAILED"

    # Trigger Chain of Custody Event
    create_custody_event(
        db,
        evidence_id=evidence.id,
        event_type=event_type,
        user_id=current_user.id,
        description=f"Evidence verification resulted in {status_result}."
    )

    db.commit()

    # Record audit log
    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        action="EVIDENCE_VERIFIED",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="evidence",
        resource_id=evidence.id,
        detail=f"Verification status: {status_result} (stored hash: {evidence.file_hash[:16]}..., current: {current_hash[:16]}...)",
        ip_address=client_ip
    )

    return {
        "evidence_id": evidence.id,
        "filename": evidence.filename,
        "stored_hash": evidence.file_hash,
        "current_hash": current_hash,
        "status": status_result
    }

@router.get("/{evidence_id}/download")
def download_evidence(
    evidence_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download decrypted evidence file.
    Must retrieve from IPFS if ipfs_cid is present, without silent fallback to local storage.
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )
        
    # Check access permission
    if current_user.role != "ADMIN" and evidence.uploaded_by is not None and evidence.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to download this evidence"
        )
        
    try:
        if evidence.ipfs_cid:
            try:
                encrypted_data = download_from_ipfs(evidence.ipfs_cid)
            except Exception as e:
                # 9. Do NOT silently switch back to local storage if IPFS fails.
                # 10. If IPFS retrieval fails, return a clear error.
                raise HTTPException(
                    status_code=502,
                    detail=f"IPFS Retrieval Failed: {str(e)}"
                )
        else:
            # Phase 2D: Fallback for old legacy records that don't have IPFS CID
            if not evidence.storage_path or evidence.storage_path == "DEPRECATED_LOCAL_STORAGE":
                raise HTTPException(
                    status_code=404,
                    detail="Evidence not available on IPFS and local storage represents a deprecated artifact"
                )
            absolute_path = os.path.abspath(evidence.storage_path)
            with open(absolute_path, "rb") as file:
                encrypted_data = file.read()
                
        original_data = decrypt_data(encrypted_data)
        
        # Verify hash before returning (optional but good practice to ensure integrity upon download)
        current_hash = hashlib.sha256(original_data).hexdigest()
        if current_hash != evidence.file_hash:
            raise HTTPException(
                status_code=409,
                detail="Integrity check failed. Recorded hash does not match stored content."
            )
            
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Stored evidence file not found locally"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to decrypt evidence: {str(e)}"
        )

    # Trigger Chain of Custody Event
    create_custody_event(
        db,
        evidence_id=evidence.id,
        event_type="ACCESSED",
        user_id=current_user.id,
        description="Evidence successfully downloaded."
    )
    db.commit()

    # Log audit event
    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        action="EVIDENCE_DOWNLOADED",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="evidence",
        resource_id=evidence.id,
        detail=f"Downloaded evidence '{evidence.filename}'",
        ip_address=client_ip
    )
    
    return Response(
        content=original_data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{evidence.filename}"'}
    )


@router.post("/{evidence_id}/blockchain/verify", response_model=BlockchainVerificationResponse)
@router.get("/{evidence_id}/blockchain/verify", response_model=BlockchainVerificationResponse)
def verify_evidence_blockchain(
    evidence_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cryptographically verify evidence proof against the Ethereum Sepolia smart contract.

    Compares:
      - Database Evidence ID vs On-Chain Evidence ID
      - Database Original File SHA-256 vs On-Chain Evidence Hash
      - Database IPFS CID vs On-Chain IPFS CID
      - Latest Chain of Custody Event Hash vs On-Chain Anchored Custody Hash

    Access Rules:
      - ADMIN: Can verify any evidence record.
      - INVESTIGATOR: Can only verify own or unassigned legacy evidence.
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    # Check access permission
    if current_user.role != "ADMIN" and evidence.uploaded_by is not None and evidence.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to verify this evidence"
        )

    # Fetch initial registration custody event for on-chain anchoring verification
    anchored_custody = (
        db.query(CustodyEvent)
        .filter(CustodyEvent.evidence_id == evidence.id)
        .order_by(CustodyEvent.id.asc())
        .first()
    )
    current_custody_hash = anchored_custody.event_hash if anchored_custody else None

    # Perform on-chain verification
    try:
        verification_result = verify_evidence_onchain(
            evidence_id=evidence.id,
            file_hash=evidence.file_hash,
            ipfs_cid=evidence.ipfs_cid,
            current_custody_hash=current_custody_hash,
            blockchain_tx=evidence.blockchain_tx
        )
    except ConnectionError as conn_err:
        raise HTTPException(
            status_code=502,
            detail=f"Blockchain connection error: {str(conn_err)}"
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=400,
            detail=str(val_err)
        )
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Blockchain verification failed: {str(err)}"
        )

    # Record security audit log
    client_ip = request.client.host if request.client else None
    is_verified = verification_result.get("blockchain_verified", False)
    audit_action = "BLOCKCHAIN_VERIFIED" if is_verified else "BLOCKCHAIN_VERIFICATION_FAILED"

    log_audit(
        db=db,
        action=audit_action,
        user_id=current_user.id,
        username=current_user.username,
        resource_type="evidence",
        resource_id=evidence.id,
        detail=(
            f"Blockchain verification {'PASSED' if is_verified else 'FAILED'} for evidence #{evidence.id}. "
            f"Matches: SHA={verification_result.get('evidence_hash_match')}, "
            f"IPFS={verification_result.get('ipfs_cid_match')}, "
            f"Custody={verification_result.get('custody_hash_match')}. "
            f"Mismatches: {verification_result.get('mismatches')}"
        ),
        ip_address=client_ip
    )

    return verification_result


@router.post("/{evidence_id}/unified-verify", response_model=UnifiedVerificationResponse)
@router.get("/{evidence_id}/unified-verify", response_model=UnifiedVerificationResponse)
def unified_verify_evidence(
    evidence_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unified Evidence Verification Workflow (Phase 5).
    Combines:
      1. File Integrity Verification (Decrypted buffer vs stored SHA-256)
      2. IPFS Storage Verification (Decentralized storage retrieval & hash match)
      3. Chain of Custody Verification (Cryptographic event chain continuity)
      4. Blockchain Verification (Ethereum Sepolia smart contract proof query)

    Access Rules:
      - ADMIN: Can verify any evidence record.
      - INVESTIGATOR: Can only verify own or unassigned legacy evidence.
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    # Check authorization
    if current_user.role != "ADMIN" and evidence.uploaded_by is not None and evidence.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to verify this evidence"
        )

    # Run orchestration service
    result = perform_unified_verification(db, evidence)

    # Update database verification status based on file integrity / tamper result
    if result["file_integrity"]["status"] == "VALID":
        evidence.verification_status = "VALID"
    elif result["file_integrity"]["status"] == "TAMPERED":
        evidence.verification_status = "TAMPERED"

    db.commit()

    # Determine audit action
    overall = result.get("overall_status", "PARTIALLY_VERIFIED")
    if overall == "FULLY_VERIFIED":
        audit_action = "EVIDENCE_VERIFICATION_COMPLETED"
    elif overall == "VERIFICATION_FAILED":
        audit_action = "EVIDENCE_VERIFICATION_FAILED"
    elif overall == "VERIFICATION_UNAVAILABLE":
        audit_action = "EVIDENCE_VERIFICATION_UNAVAILABLE"
    else:
        audit_action = "EVIDENCE_PARTIALLY_VERIFIED"

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        action=audit_action,
        user_id=current_user.id,
        username=current_user.username,
        resource_type="evidence",
        resource_id=evidence.id,
        detail=(
            f"Unified verification: status={overall}, "
            f"File={result['file_integrity']['status']}, "
            f"IPFS={result['ipfs']['status']}, "
            f"Custody={result['custody']['status']}, "
            f"Blockchain={result['blockchain']['status']}"
        ),
        ip_address=client_ip
    )

    return result


