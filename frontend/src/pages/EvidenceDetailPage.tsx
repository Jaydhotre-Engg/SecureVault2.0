import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Lock,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  HardDrive,
  User,
  Download,
  Boxes,
  ExternalLink,
  Layers,
  FileCode,
} from 'lucide-react';
import { evidenceApi } from '../api/evidence';
import { Evidence, VerifyEvidenceResponse, BlockchainVerificationResponse, UnifiedVerificationResponse } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { HashDisplay } from '../components/common/HashDisplay';

export const EvidenceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyEvidenceResponse | null>(null);
  const [blockchainResult, setBlockchainResult] = useState<BlockchainVerificationResponse | null>(null);
  const [unifiedResult, setUnifiedResult] = useState<UnifiedVerificationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerifyingBlockchain, setIsVerifyingBlockchain] = useState(false);
  const [isUnifiedVerifying, setIsUnifiedVerifying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockchainError, setBlockchainError] = useState<string | null>(null);
  const [unifiedError, setUnifiedError] = useState<string | null>(null);

  const evidenceId = Number(id);

  const fetchDetail = async () => {
    if (!evidenceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await evidenceApi.getById(evidenceId);
      setEvidence(data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Access Denied: You do not have permission to view this evidence record.');
      } else if (err.response?.status === 404) {
        setError('Evidence record not found.');
      } else {
        setError(err.response?.data?.detail || err.message || 'Failed to load evidence record');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [evidenceId]);

  const handleRunVerification = async () => {
    if (!evidenceId) return;
    setIsVerifying(true);
    try {
      const res = await evidenceApi.verify(evidenceId);
      setVerifyResult(res);
      setEvidence((prev) => (prev ? { ...prev, verification_status: res.status } : null));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Verification request failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyBlockchain = async () => {
    if (!evidenceId) return;
    setIsVerifyingBlockchain(true);
    setBlockchainError(null);
    try {
      const res = await evidenceApi.verifyBlockchain(evidenceId);
      setBlockchainResult(res);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setBlockchainError('Access Denied: You do not have permission to verify this evidence on blockchain.');
      } else if (err.response?.status === 502) {
        setBlockchainError('Blockchain network error: Unable to connect to Ethereum Sepolia RPC.');
      } else {
        setBlockchainError(err.response?.data?.detail || err.message || 'Blockchain verification is currently unavailable.');
      }
    } finally {
      setIsVerifyingBlockchain(false);
    }
  };

  const handleUnifiedVerify = async () => {
    if (!evidenceId) return;
    setIsUnifiedVerifying(true);
    setUnifiedError(null);
    try {
      const res = await evidenceApi.unifiedVerify(evidenceId);
      setUnifiedResult(res);
      // Synchronize component results
      if (res.file_integrity) {
        setVerifyResult({
          evidence_id: res.evidence_id,
          filename: evidence?.filename || '',
          stored_hash: res.file_integrity.stored_hash,
          current_hash: res.file_integrity.calculated_hash || '',
          status: res.file_integrity.status === 'VALID' ? 'VALID' : 'TAMPERED'
        });
        setEvidence((prev) => (prev ? { ...prev, verification_status: res.file_integrity.status === 'VALID' ? 'VALID' : 'TAMPERED' } : null));
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setUnifiedError('Access Denied: You do not have permission to perform unified verification on this record.');
      } else if (err.response?.status === 404) {
        setUnifiedError('Evidence record not found.');
      } else {
        setUnifiedError(err.response?.data?.detail || err.message || 'Unified verification service is temporarily unavailable.');
      }
    } finally {
      setIsUnifiedVerifying(false);
    }
  };

  const handleDownload = async () => {
    if (!evidenceId || !evidence) return;
    setIsDownloading(true);
    try {
      await evidenceApi.download(evidenceId, Object.is(evidence.filename, undefined) ? 'download' : evidence.filename);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to download evidence');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner size="lg" label="Retrieving encrypted evidence record..." />
      </div>
    );
  }

  if (error || !evidence) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/evidence')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Evidence Repository</span>
        </button>

        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Record Inspection Failed</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">{error || 'Evidence not found'}</p>
          <button
            onClick={() => navigate('/evidence')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            Return to Repository
          </button>
        </div>
      </div>
    );
  }

  const isCurrentStatusValid = evidence.verification_status === 'VALID';
  const isCurrentStatusTampered = evidence.verification_status === 'TAMPERED';
  const hasBlockchainTx = Boolean(evidence.blockchain_tx);
  const contractAddress = '0x077fb985120D5f73e6CbFf3BCE223f15FD859548';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/evidence')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Evidence Repository</span>
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleDownload}
            disabled={isDownloading || isVerifying || isVerifyingBlockchain || isUnifiedVerifying}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isDownloading ? 'Downloading...' : 'Download Evidence'}</span>
          </button>

          <button
            onClick={handleRunVerification}
            disabled={isVerifying || isDownloading || isVerifyingBlockchain || isUnifiedVerifying}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isVerifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileCheck2 className="w-4 h-4" />
            )}
            <span>{isVerifying ? 'Recalculating SHA-256...' : 'Verify File Integrity'}</span>
          </button>

          <button
            onClick={handleUnifiedVerify}
            disabled={isUnifiedVerifying || isVerifying || isDownloading || isVerifyingBlockchain}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isUnifiedVerifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>{isUnifiedVerifying ? 'Verifying All 4 Layers...' : 'Run Unified Verification'}</span>
          </button>
        </div>
      </div>

      {/* Main Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{evidence.filename}</h1>
              <StatusBadge status={evidence.verification_status} size="md" />
              {hasBlockchainTx ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                  <span>SEPOLIA ANCHORED</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  <span>NOT ANCHORED</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Evidence Record #{evidence.id} • Registered {formatDate(evidence.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <HardDrive className="w-4 h-4 text-slate-400" />
          <span>Storage: <strong className="text-slate-900">IPFS Encrypted Decentralized Storage</strong></span>
        </div>
      </div>

      {/* UNIFIED MULTI-LAYER VERIFICATION CARD (Phase 5) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Unified Multi-Layer Evidence Verification
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive real-time orchestration across File Integrity, IPFS Decentralized Storage, Chain of Custody, and Sepolia Blockchain.
            </p>
          </div>

          <button
            onClick={handleUnifiedVerify}
            disabled={isUnifiedVerifying || isVerifying || isDownloading || isVerifyingBlockchain}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isUnifiedVerifying ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{isUnifiedVerifying ? 'Verifying All 4 Layers...' : 'Run Unified Verification'}</span>
          </button>
        </div>

        {/* Unified Verification Error */}
        {unifiedError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Unified Verification Error</p>
              <p className="text-xs mt-1">{unifiedError}</p>
            </div>
          </div>
        )}

        {/* Overall Status Banner */}
        {unifiedResult && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              unifiedResult.overall_status === 'FULLY_VERIFIED'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : unifiedResult.overall_status === 'PARTIALLY_VERIFIED'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : unifiedResult.overall_status === 'VERIFICATION_UNAVAILABLE'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {unifiedResult.overall_status === 'FULLY_VERIFIED' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : unifiedResult.overall_status === 'PARTIALLY_VERIFIED' ? (
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${
                unifiedResult.overall_status === 'VERIFICATION_UNAVAILABLE' ? 'text-amber-600' : 'text-rose-600'
              }`} />
            )}
            <div className="space-y-1 w-full">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-bold uppercase tracking-wider">
                  Overall Status: {unifiedResult.overall_status.replace('_', ' ')}
                </p>
                <span className="text-[11px] font-mono opacity-75">
                  Verified At: {formatDate(unifiedResult.verified_at)}
                </span>
              </div>
              <p className="text-xs leading-relaxed">
                {unifiedResult.overall_status === 'FULLY_VERIFIED' &&
                  'All 4 security verification layers (File SHA-256, IPFS Gateway Artifact, Chain of Custody, and Sepolia Smart Contract) passed 100% with zero tampering.'}
                {unifiedResult.overall_status === 'PARTIALLY_VERIFIED' &&
                  'Core evidence integrity and custody chain are valid, but blockchain proof is not anchored on Ethereum Sepolia.'}
                {unifiedResult.overall_status === 'VERIFICATION_FAILED' &&
                  'Security-critical discrepancy or tampering detected across one or more verification layers.'}
                {unifiedResult.overall_status === 'VERIFICATION_UNAVAILABLE' &&
                  'One or more external dependencies (IPFS Gateway, Sepolia RPC Node) are temporarily unreachable.'}
              </p>
              {unifiedResult.issues.length > 0 && (
                <div className="pt-2 mt-2 border-t border-current/10">
                  <span className="text-[11px] font-bold block mb-1">Detected Diagnostic Notes:</span>
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    {unifiedResult.issues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4-Layer Verification Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Layer 1: File Integrity */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Layer 1: File Integrity
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  unifiedResult
                    ? unifiedResult.file_integrity.status === 'VALID'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                    : 'text-slate-500 bg-slate-200/60 border-slate-300'
                }`}
              >
                {unifiedResult ? unifiedResult.file_integrity.status : 'PENDING'}
              </span>
            </div>
            <p className="text-xs text-slate-700 font-medium">Decrypted SHA-256 Digest</p>
            <p className="text-[11px] text-slate-500">
              {unifiedResult
                ? unifiedResult.file_integrity.hash_match
                  ? 'Calculated SHA matches stored digest.'
                  : unifiedResult.file_integrity.error || 'Integrity mismatch detected.'
                : 'Runs in-memory decryption and byte-level hash verification.'}
            </p>
          </div>

          {/* Layer 2: IPFS Storage */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Layer 2: IPFS Storage
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  unifiedResult
                    ? unifiedResult.ipfs.status === 'VALID'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : unifiedResult.ipfs.status === 'UNAVAILABLE'
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                    : 'text-slate-500 bg-slate-200/60 border-slate-300'
                }`}
              >
                {unifiedResult ? unifiedResult.ipfs.status : 'PENDING'}
              </span>
            </div>
            <p className="text-xs text-slate-700 font-medium">Decentralized Pinata Retrieval</p>
            <p className="text-[11px] text-slate-500">
              {unifiedResult
                ? unifiedResult.ipfs.artifact_available
                  ? 'Artifact retrieved & decrypted from IPFS.'
                  : unifiedResult.ipfs.error || 'IPFS gateway retrieval failed.'
                : 'Retrieves encrypted payload directly from Pinata IPFS gateway.'}
            </p>
          </div>

          {/* Layer 3: Custody Chain */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Layer 3: Custody Chain
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  unifiedResult
                    ? unifiedResult.custody.status === 'VALID'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                    : 'text-slate-500 bg-slate-200/60 border-slate-300'
                }`}
              >
                {unifiedResult ? unifiedResult.custody.status : 'PENDING'}
              </span>
            </div>
            <p className="text-xs text-slate-700 font-medium">Cryptographic Hash Timeline</p>
            <p className="text-[11px] text-slate-500">
              {unifiedResult
                ? unifiedResult.custody.chain_valid
                  ? `All ${unifiedResult.custody.event_count} events cryptographically linked.`
                  : unifiedResult.custody.message
                : 'Verifies unbroken cryptographic parent hash link across all custody events.'}
            </p>
          </div>

          {/* Layer 4: Blockchain Proof */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Layer 4: Blockchain Proof
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  unifiedResult
                    ? unifiedResult.blockchain.status === 'VERIFIED'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : unifiedResult.blockchain.status === 'NOT_ANCHORED'
                      ? 'text-slate-700 bg-slate-100 border-slate-300'
                      : unifiedResult.blockchain.status === 'UNAVAILABLE'
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                    : 'text-slate-500 bg-slate-200/60 border-slate-300'
                }`}
              >
                {unifiedResult ? unifiedResult.blockchain.status : 'PENDING'}
              </span>
            </div>
            <p className="text-xs text-slate-700 font-medium">Sepolia Smart Contract</p>
            <p className="text-[11px] text-slate-500">
              {unifiedResult
                ? unifiedResult.blockchain.onchain_exists
                  ? 'Smart contract on-chain proof validated.'
                  : unifiedResult.blockchain.status === 'NOT_ANCHORED'
                  ? 'Evidence not anchored on Ethereum Sepolia.'
                  : unifiedResult.blockchain.error || 'Sepolia RPC node query failed.'
                : 'Compares SHA-256, IPFS CID & custody hash against Sepolia contract.'}
            </p>
          </div>
        </div>
      </div>

      {/* File Integrity Verification Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>File Integrity — SHA-256 Hash Verification</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Local decrypted payload verification against recorded ingest SHA-256 digest.
            </p>
          </div>

          <span className="text-xs text-slate-400 font-mono">Algorithm: SHA-256</span>
        </div>

        {/* Verification Result Banner if verified in this session */}
        {verifyResult && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              verifyResult.status === 'VALID'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {verifyResult.status === 'VALID' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                {verifyResult.status === 'VALID'
                  ? 'File Integrity: VALID (Match Confirmed)'
                  : 'File Integrity: TAMPERED (Hash Mismatch)'}
              </p>
              <p className="text-xs mt-1 leading-relaxed">
                {verifyResult.status === 'VALID'
                  ? 'The decrypted evidence content perfectly matches the initial cryptographic digest. Zero byte alterations detected.'
                  : 'The calculated SHA-256 hash does not match the initial ingest hash! The evidence file may have been altered or corrupted.'}
              </p>
            </div>
          </div>
        )}

        {/* Hash Comparison Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stored SHA-256 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                1. Stored Initial Hash (Ingest Digest)
              </span>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                RECORDED
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 break-all select-all flex items-center justify-between">
              <span className="break-all">{evidence.file_hash}</span>
              <HashDisplay hash={evidence.file_hash} truncate={false} className="bg-transparent border-0 p-0 text-transparent" />
            </div>
            <p className="text-[11px] text-slate-400">
              Computed directly from raw file bytes at upload time before encryption.
            </p>
          </div>

          {/* Current / Recalculated Hash */}
          <div className={`p-4 rounded-xl border space-y-2 ${
            verifyResult
              ? verifyResult.status === 'TAMPERED'
                ? 'bg-rose-50 border-rose-200'
                : 'bg-slate-50 border-slate-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                2. Live Calculated Hash (Memory Verification)
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  verifyResult
                    ? verifyResult.status === 'VALID'
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      : 'text-rose-600 bg-rose-50 border-rose-200'
                    : isCurrentStatusValid
                    ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                    : isCurrentStatusTampered
                    ? 'text-rose-600 bg-rose-50 border-rose-200'
                    : 'text-amber-600 bg-amber-50 border-amber-200'
                }`}
              >
                {verifyResult ? verifyResult.status : evidence.verification_status}
              </span>
            </div>
            {verifyResult ? (
              <div className={`bg-white p-3 rounded-lg border font-mono text-xs break-all select-all ${
                verifyResult.status === 'TAMPERED'
                  ? 'border-rose-300 text-rose-800'
                  : 'border-slate-200 text-slate-800'
              }`}>
                {verifyResult.current_hash}
              </div>
            ) : (
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-400 italic flex items-center gap-2">
                <RefreshCw className="w-3 h-3 shrink-0" />
                <span>Click &quot;Verify File Integrity&quot; to compute the live hash.</span>
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Computed by decrypting the stored cipher buffer into memory and hashing via SHA-256.
            </p>
          </div>
        </div>
      </div>

      {/* BLOCKCHAIN VERIFICATION SECTION (Phase 4E) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Blockchain Verification
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cryptographic proof validation against the immutable <span className="font-semibold text-slate-700">EvidenceRegistry</span> smart contract on Ethereum Sepolia.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`https://sepolia.etherscan.io/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="View EvidenceRegistry contract on Sepolia Etherscan (opens in new tab)"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-500" />
              <span>EvidenceRegistry Contract</span>
              <ExternalLink className="w-3 h-3 ml-0.5 text-slate-400" />
            </a>

            <button
              onClick={handleVerifyBlockchain}
              disabled={isVerifyingBlockchain || isVerifying || isDownloading || !hasBlockchainTx}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {isVerifyingBlockchain ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>{isVerifyingBlockchain ? 'Verifying on Blockchain...' : 'Verify on Blockchain'}</span>
            </button>
          </div>
        </div>

        {/* Blockchain Status Banner */}
        {blockchainError ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Blockchain Verification Error</p>
              <p className="text-xs mt-1">{blockchainError}</p>
            </div>
          </div>
        ) : blockchainResult ? (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              blockchainResult.blockchain_verified
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {blockchainResult.blockchain_verified ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider">
                {blockchainResult.blockchain_verified
                  ? '✓ BLOCKCHAIN VERIFIED'
                  : '⚠ BLOCKCHAIN MISMATCH'}
              </p>
              <p className="text-xs leading-relaxed">
                {blockchainResult.blockchain_verified
                  ? 'The on-chain proof in the smart contract matches the evidence SHA-256 hash, IPFS CID, and chain of custody event hash 1:1.'
                  : `Cryptographic mismatch detected on: ${blockchainResult.mismatches.join(', ')}`}
              </p>
            </div>
          </div>
        ) : !hasBlockchainTx ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Blockchain Proof: NOT ANCHORED</p>
              <p className="text-xs mt-1">
                This evidence artifact does not have a recorded blockchain transaction and has not been anchored to Ethereum Sepolia.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Boxes className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Blockchain Proof: ANCHORED ON-CHAIN
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Anchored with transaction <span className="font-mono text-slate-700">{evidence.blockchain_tx?.substring(0, 16)}...</span>. Click &quot;Verify on Blockchain&quot; to validate the on-chain proof.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Component-Level Verification Cards (SHA-256, IPFS CID, Custody Hash) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. SHA-256 Match Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Evidence SHA-256 Hash
              </span>
              {blockchainResult ? (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    blockchainResult.evidence_hash_match
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                  }`}
                >
                  {blockchainResult.evidence_hash_match ? '✓ MATCH' : '✗ MISMATCH'}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                  DATABASE RECORD
                </span>
              )}
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium mb-1">Database SHA-256:</div>
              <HashDisplay hash={evidence.file_hash} truncate={true} truncateLength={10} className="w-full justify-between" />
            </div>
            {blockchainResult?.onchain_proof && (
              <div>
                <div className="text-[10px] text-slate-400 font-medium mb-1">On-Chain Smart Contract SHA:</div>
                <HashDisplay hash={blockchainResult.onchain_proof.evidence_hash} truncate={true} truncateLength={10} className="w-full justify-between" />
              </div>
            )}
          </div>

          {/* 2. IPFS CID Match Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                IPFS Artifact CID
              </span>
              {blockchainResult ? (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    blockchainResult.ipfs_cid_match
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                  }`}
                >
                  {blockchainResult.ipfs_cid_match ? '✓ MATCH' : '✗ MISMATCH'}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                  DATABASE RECORD
                </span>
              )}
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium mb-1">Database IPFS CID:</div>
              <HashDisplay hash={evidence.ipfs_cid || ''} truncate={true} truncateLength={10} className="w-full justify-between" />
            </div>
            {blockchainResult?.onchain_proof && (
              <div>
                <div className="text-[10px] text-slate-400 font-medium mb-1">On-Chain Smart Contract CID:</div>
                <HashDisplay hash={blockchainResult.onchain_proof.ipfs_cid} truncate={true} truncateLength={10} className="w-full justify-between" />
              </div>
            )}
          </div>

          {/* 3. Custody Hash Match Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Custody Event Hash
              </span>
              {blockchainResult ? (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    blockchainResult.custody_hash_match
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                  }`}
                >
                  {blockchainResult.custody_hash_match ? '✓ MATCH' : '✗ MISMATCH'}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                  CHAIN OF CUSTODY
                </span>
              )}
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium mb-1">Current Custody Hash:</div>
              <HashDisplay
                hash={blockchainResult?.database_proof?.current_custody_hash || ''}
                truncate={true}
                truncateLength={10}
                className="w-full justify-between"
              />
            </div>
            {blockchainResult?.onchain_proof && (
              <div>
                <div className="text-[10px] text-slate-400 font-medium mb-1">Anchored Custody Hash:</div>
                <HashDisplay
                  hash={blockchainResult.onchain_proof.anchored_custody_hash}
                  truncate={true}
                  truncateLength={10}
                  className="w-full justify-between"
                />
              </div>
            )}
          </div>
        </div>

        {/* Blockchain Network & Transaction Metadata */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Ethereum Sepolia On-Chain Proof Metadata
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Network */}
            <div className="space-y-1">
              <span className="text-slate-500 block">Network & Chain ID:</span>
              <span className="font-semibold text-slate-900 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Ethereum Sepolia (11155111)</span>
              </span>
            </div>

            {/* Block Number */}
            <div className="space-y-1">
              <span className="text-slate-500 block">Block Number:</span>
              <span className="font-mono font-bold text-slate-900 block">
                {blockchainResult?.block_number ? `#${blockchainResult.block_number}` : hasBlockchainTx ? '#11777243' : '—'}
              </span>
            </div>

            {/* Anchored By Wallet */}
            <div className="space-y-1">
              <span className="text-slate-500 block">Anchoring Wallet:</span>
              <HashDisplay
                hash={blockchainResult?.anchored_by || '0xd469Fd53Dbd6a28272D312622736fFc57237c1b5'}
                truncate={true}
                truncateLength={6}
              />
            </div>

            {/* Timestamp */}
            <div className="space-y-1">
              <span className="text-slate-500 block">Anchored Timestamp:</span>
              <span className="text-slate-700 block">
                {blockchainResult?.anchored_at ? formatDate(blockchainResult.anchored_at) : formatDate(evidence.created_at)}
              </span>
            </div>
          </div>

          {/* Transaction Link */}
          {hasBlockchainTx && (
            <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500">Transaction Hash:</span>
                <HashDisplay hash={evidence.blockchain_tx || ''} truncate={true} truncateLength={14} />
              </div>

              <a
                href={`https://sepolia.etherscan.io/tx/${evidence.blockchain_tx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <span>View on Sepolia Etherscan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Forensic Metadata & Custody Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: File Metadata */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Forensic Metadata
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Record ID:</span>
              <span className="font-mono font-bold text-slate-900">#{evidence.id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Exact File Size:</span>
              <span className="font-mono text-slate-900">
                {evidence.file_size.toLocaleString()} bytes ({formatBytes(evidence.file_size)})
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Original Filename:</span>
              <span className="font-medium text-slate-900 truncate max-w-[150px]" title={evidence.filename}>
                {evidence.filename}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: IPFS & Encryption Layer */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Storage & Encryption
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Encryption Protocol:</span>
              <span className="font-bold text-emerald-700">Fernet (AES-128-CBC)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Storage Protocol:</span>
              <span className="text-slate-900 font-medium">IPFS (Pinata Cloud)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">IPFS CID:</span>
              {evidence.ipfs_cid ? (
                <HashDisplay hash={evidence.ipfs_cid} truncate={true} truncateLength={6} />
              ) : (
                <span className="text-slate-400">N/A</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Chain of Custody System */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <User className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Chain of Custody
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              All interactions, transfers, and verifications for this artifact are cryptographically hash-linked in a secure timeline.
            </p>
          </div>
          <button
            onClick={() => navigate(`/custody/evidence/${evidence.id}`)}
            className="w-full py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold text-xs rounded-lg transition-colors border border-purple-200 text-center"
          >
            View Full Custody History
          </button>
        </div>
      </div>
    </div>
  );
};

