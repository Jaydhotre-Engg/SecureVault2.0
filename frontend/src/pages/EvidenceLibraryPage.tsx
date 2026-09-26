import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  FileText,
  Eye,
  CheckSquare,
  RefreshCw,
  UploadCloud,
  FolderLock,
  ArrowUpDown,
} from 'lucide-react';
import { evidenceApi } from '../api/evidence';
import { Evidence } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const EvidenceLibraryPage: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchEvidence = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await evidenceApi.list();
      setEvidenceList(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load evidence repository');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, []);

  const handleVerify = async (id: number) => {
    setVerifyingId(id);
    try {
      const res = await evidenceApi.verify(id);
      setEvidenceList((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, verification_status: res.status } : item
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Verification request failed');
    } finally {
      setVerifyingId(null);
    }
  };

  const filteredEvidence = useMemo(() => {
    return evidenceList
      .filter((item) => {
        const matchesSearch =
          item.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.file_hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.id.toString().includes(searchTerm);

        const matchesStatus =
          statusFilter === 'ALL' || item.verification_status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        return sortOrder === 'desc' ? b.id - a.id : a.id - b.id;
      });
  }, [evidenceList, searchTerm, statusFilter, sortOrder]);

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

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Evidence Repository</h1>
          <p className="text-xs text-slate-500 mt-1">
            Search, inspect, and verify cryptographically secured forensic artifacts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchEvidence}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh repository"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Evidence</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by filename, hash, or ID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter Buttons & Sort */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center rounded-lg bg-slate-100 p-1 text-xs">
            {['ALL', 'VALID', 'PENDING', 'TAMPERED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium"
            title="Toggle ID sorting order"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>ID: {sortOrder.toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Main Evidence Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" label="Loading repository records..." />
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <FolderLock className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600 text-sm">No evidence records matched your criteria</p>
            <p className="text-slate-400">Try adjusting your search query or status filter.</p>
            {(searchTerm || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                }}
                className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 w-16">ID</th>
                  <th className="px-5 py-3">Artifact Filename</th>
                  <th className="px-5 py-3">File Size</th>
                  <th className="px-5 py-3">SHA-256 Fingerprint</th>
                  <th className="px-5 py-3">Verification Status</th>
                  <th className="px-5 py-3">Uploaded By</th>
                  <th className="px-5 py-3">Ingested Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvidence.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-500">
                      #{item.id}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="truncate max-w-[220px]" title={item.filename}>
                          {item.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-mono">
                      {formatBytes(item.file_size)}
                    </td>
                    <td className="px-5 py-4">
                      <HashDisplay hash={item.file_hash} truncateLength={10} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.verification_status} size="sm" />
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {item.uploaded_by ? `User #${item.uploaded_by}` : 'Legacy (System)'}
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => handleVerify(item.id)}
                        disabled={verifyingId === item.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors disabled:opacity-50"
                        title="Recalculate SHA-256 and Verify Integrity"
                      >
                        {verifyingId === item.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        ) : (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>{verifyingId === item.id ? 'Checking...' : 'Verify'}</span>
                      </button>

                      <Link
                        to={`/evidence/${item.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition-colors"
                        title="View Complete Forensic Chain"
                      >
                        <Eye className="w-3.5 h-3.5" />
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
