from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class EvidenceResponse(BaseModel):

    id: int

    case_id: int | None = None

    filename: str
    file_hash: str
    file_size: int
    storage_path: str

    blockchain_tx: str | None

    ipfs_cid: str | None = None

    verification_status: str

    uploaded_by: int | None = None

    created_at: datetime

    class Config:
        from_attributes = True


class DatabaseProofSchema(BaseModel):
    evidence_id: int
    file_hash: str
    ipfs_cid: Optional[str] = None
    current_custody_hash: Optional[str] = None
    blockchain_tx: Optional[str] = None


class OnChainProofSchema(BaseModel):
    evidence_id: int
    evidence_hash: str
    ipfs_cid: str
    anchored_custody_hash: str
    timestamp: int
    anchored_by: str
    exists: bool


class BlockchainVerificationResponse(BaseModel):
    evidence_id: int
    blockchain_verified: bool
    evidence_hash_match: bool
    ipfs_cid_match: bool
    custody_hash_match: bool
    onchain_exists: bool
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    anchored_at: Optional[str] = None
    anchored_by: Optional[str] = None
    database_proof: Optional[DatabaseProofSchema] = None
    onchain_proof: Optional[OnChainProofSchema] = None
    mismatches: List[str] = []


class FileIntegrityResultSchema(BaseModel):
    status: str  # "VALID" | "TAMPERED" | "ERROR"
    hash_match: bool
    stored_hash: str
    calculated_hash: Optional[str] = None
    error: Optional[str] = None


class IPFSResultSchema(BaseModel):
    status: str  # "VALID" | "TAMPERED" | "UNAVAILABLE" | "NOT_CONFIGURED"
    artifact_available: bool
    decryption_successful: bool
    hash_match: bool
    ipfs_cid: Optional[str] = None
    error: Optional[str] = None


class CustodyResultSchema(BaseModel):
    status: str  # "VALID" | "INVALID"
    chain_valid: bool
    event_count: int
    latest_custody_hash: Optional[str] = None
    message: str
    failed_event_id: Optional[int] = None


class BlockchainResultSchema(BaseModel):
    status: str  # "VERIFIED" | "NOT_ANCHORED" | "MISMATCH" | "UNAVAILABLE"
    onchain_exists: bool
    evidence_hash_match: bool
    ipfs_cid_match: bool
    custody_hash_match: bool
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    anchored_at: Optional[str] = None
    anchored_by: Optional[str] = None
    mismatches: List[str] = []
    error: Optional[str] = None


class UnifiedVerificationResponse(BaseModel):
    evidence_id: int
    overall_status: str  # "FULLY_VERIFIED" | "PARTIALLY_VERIFIED" | "VERIFICATION_FAILED" | "VERIFICATION_UNAVAILABLE"
    file_integrity: FileIntegrityResultSchema
    ipfs: IPFSResultSchema
    custody: CustodyResultSchema
    blockchain: BlockchainResultSchema
    issues: List[str] = []
    verified_at: str

