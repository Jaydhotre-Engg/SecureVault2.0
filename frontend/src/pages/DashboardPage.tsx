import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderLock,
  ShieldCheck,
  Clock,
  ShieldAlert,
  UploadCloud,
  FileText,
  Lock,
  FileCheck2,
  Eye,
  CheckSquare,
  ArrowRight,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { evidenceApi } from '../api/evidence';
import { Evidence } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await evidenceApi.list();
      setEvidenceList(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load evidence data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleQuickVerify = async (id: number) => {
    setVerifyingId(id);
    try {
      const result = await evidenceApi.verify(id);
      // Update local item status
      setEvidenceList((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, verification_status: result.status } : item
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Verification failed');
    } finally {
      setVerifyingId(null);
    }
  };

  // Safe metrics derived directly from real backend records
  const totalEvidence = evidenceList.length;
  const myEvidence = evidenceList.filter((e) => e.uploaded_by === user?.id).length;
  const validCount = evidenceList.filter((e) => e.verification_status === 'VALID').length;
  const pendingCount = evidenceList.filter((e) => e.verification_status === 'PENDING').length;
  const tamperedCount = evidenceList.filter((e) => e.verification_status === 'TAMPERED').length;

  const recentEvidence = [...evidenceList].reverse().slice(0, 5);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner size="lg" label="Loading forensic metrics and evidence records..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              Welcome back, {user?.username}
            </h1>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
                user?.role === 'ADMIN'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {user?.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Forensic workstation connected to SecureVault 2.0 cryptographically verified repository.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload New Evidence</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Metrics Row (Derived exclusively from real backend data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Accessible Evidence */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Accessible Evidence
            </p>
            <p className="text-2xl font-extrabold text-slate-900">{totalEvidence}</p>
            <p className="text-[11px] text-slate-400">
              {user?.role === 'ADMIN' ? 'All repository files' : `${myEvidence} uploaded by you`}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <FolderLock className="w-6 h-6" />
          </div>
        </div>

        {/* Validated Evidence */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Verified Valid
            </p>
            <p className="text-2xl font-extrabold text-emerald-600">{validCount}</p>
            <p className="text-[11px] text-slate-400">SHA-256 match confirmed</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Verification */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Verification
            </p>
            <p className="text-2xl font-extrabold text-amber-600">{pendingCount}</p>
            <p className="text-[11px] text-slate-400">Requires integrity run</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Tampered Alerts */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Integrity Violations
            </p>
            <p className="text-2xl font-extrabold text-rose-600">{tamperedCount}</p>
            <p className="text-[11px] text-slate-400">Hash mismatch detected</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Cryptographic Controls Banner */}
      <div className="bg-gradient-to-r from-navy-950 to-navy-900 rounded-xl p-6 text-white border border-navy-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              Active Cryptographic Integrity Pipeline
            </h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            All stored evidence artifacts are encrypted at rest using authenticated Fernet symmetric ciphers. Verification recalculates the SHA-256 checksum dynamically from decrypted memory buffers to ensure byte-level chain-of-custody integrity.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="px-3.5 py-2 rounded-lg bg-navy-800/80 border border-navy-700 flex items-center gap-2 text-xs">
            <Lock className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[10px] text-slate-400">Cipher Layer</p>
              <p className="font-semibold text-emerald-300">Fernet AES-128</p>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-navy-800/80 border border-navy-700 flex items-center gap-2 text-xs">
            <FileCheck2 className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-[10px] text-slate-400">Hash Algorithm</p>
              <p className="font-semibold text-blue-300">SHA-256 Digest</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Evidence Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Forensic Evidence</h2>
            <p className="text-xs text-slate-500">Latest ingested evidence records in the vault</p>
          </div>
          <Link
            to="/evidence"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
          >
            <span>View all in repository</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentEvidence.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No evidence records found in repository.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Filename</th>
                  <th className="px-5 py-3">Size</th>
                  <th className="px-5 py-3">SHA-256 Digest</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentEvidence.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-500 font-semibold">
                      #{item.id}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="truncate max-w-[180px]" title={item.filename}>
                        {item.filename}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-mono">
                      {formatBytes(item.file_size)}
                    </td>
                    <td className="px-5 py-3.5">
                      <HashDisplay hash={item.file_hash} truncateLength={8} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={item.verification_status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => handleQuickVerify(item.id)}
                        disabled={verifyingId === item.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors disabled:opacity-50"
                        title="Verify Integrity Now"
                      >
                        {verifyingId === item.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                        ) : (
                          <CheckSquare className="w-3 h-3 text-emerald-600" />
                        )}
                        <span>{verifyingId === item.id ? 'Checking...' : 'Verify'}</span>
                      </button>
                      <Link
                        to={`/evidence/${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs transition-colors"
                        title="Inspect Full Details"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
