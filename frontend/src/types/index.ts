export type UserRole = 'ADMIN' | 'INVESTIGATOR';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export type CaseStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED';

export interface Case {
  id: number;
  case_number: string;
  case_name: string;
  description: string | null;
  status: CaseStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCaseRequest {
  case_name: string;
  description?: string;
}

export interface UpdateCaseRequest {
  case_name?: string;
  description?: string;
  status?: CaseStatus;
}

export interface Evidence {
  id: number;
  case_id: number | null;
  filename: string;
  file_hash: string;
  file_size: number;
  storage_path: string;
  blockchain_tx?: string | null;
  ipfs_cid?: string | null;
  verification_status: 'VALID' | 'PENDING' | 'TAMPERED';
  uploaded_by: number | null;
  created_at: string;
}

export interface UploadEvidenceResponse {
  message: string;
  case?: {
    id: number;
    case_number: string;
    case_name: string;
  };
  evidence: {
    id: number;
    case_id: number | null;
    filename: string;
    size: number;
    sha256: string;
    status: string;
    uploaded_by: number | null;
    ipfs_cid?: string | null;
    encrypted: boolean;
  };
}

export interface VerifyEvidenceResponse {
  evidence_id: number;
  filename: string;
  stored_hash: string;
  current_hash: string;
  status: 'VALID' | 'TAMPERED';
}

export interface DatabaseProof {
  evidence_id: number;
  file_hash: string;
  ipfs_cid?: string | null;
  current_custody_hash?: string | null;
  blockchain_tx?: string | null;
}

export interface OnChainProof {
  evidence_id: number;
  evidence_hash: string;
  ipfs_cid: string;
  anchored_custody_hash: string;
  timestamp: number;
  anchored_by: string;
  exists: boolean;
}

export interface BlockchainVerificationResponse {
  evidence_id: number;
  blockchain_verified: boolean;
  evidence_hash_match: boolean;
  ipfs_cid_match: boolean;
  custody_hash_match: boolean;
  onchain_exists: boolean;
  transaction_hash?: string | null;
  block_number?: number | null;
  anchored_at?: string | null;
  anchored_by?: string | null;
  database_proof?: DatabaseProof | null;
  onchain_proof?: OnChainProof | null;
  mismatches: string[];
}

export interface FileIntegrityResult {
  status: 'VALID' | 'TAMPERED' | 'ERROR';
  hash_match: boolean;
  stored_hash: string;
  calculated_hash?: string | null;
  error?: string | null;
}

export interface IPFSResult {
  status: 'VALID' | 'TAMPERED' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
  artifact_available: boolean;
  decryption_successful: boolean;
  hash_match: boolean;
  ipfs_cid?: string | null;
  error?: string | null;
}

export interface CustodyResult {
  status: 'VALID' | 'INVALID';
  chain_valid: boolean;
  event_count: number;
  latest_custody_hash?: string | null;
  message: string;
  failed_event_id?: number | null;
}

export interface BlockchainResult {
  status: 'VERIFIED' | 'NOT_ANCHORED' | 'MISMATCH' | 'UNAVAILABLE';
  onchain_exists: boolean;
  evidence_hash_match: boolean;
  ipfs_cid_match: boolean;
  custody_hash_match: boolean;
  transaction_hash?: string | null;
  block_number?: number | null;
  anchored_at?: string | null;
  anchored_by?: string | null;
  mismatches: string[];
  error?: string | null;
}

export type UnifiedOverallStatus = 'FULLY_VERIFIED' | 'PARTIALLY_VERIFIED' | 'VERIFICATION_FAILED' | 'VERIFICATION_UNAVAILABLE';

export interface UnifiedVerificationResponse {
  evidence_id: number;
  overall_status: UnifiedOverallStatus;
  file_integrity: FileIntegrityResult;
  ipfs: IPFSResult;
  custody: CustodyResult;
  blockchain: BlockchainResult;
  issues: string[];
  verified_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  detail: string | null;
  ip_address: string | null;
  timestamp: string;
}

export interface ApiError {
  detail?: string;
  message?: string;
}
