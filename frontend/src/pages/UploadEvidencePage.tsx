import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { evidenceApi } from '../api/evidence';
import { UploadEvidenceResponse } from '../types';
import { Case } from '../types';
import { casesApi } from '../api/cases';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const UploadEvidencePage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadEvidenceResponse | null>(null);

  useEffect(() => {
    const loadCases = async () => {
      try {
        setCases(await casesApi.list());
      } catch (err: any) {
        setUploadError(err.response?.data?.detail || err.message || 'Unable to load cases.');
      } finally {
        setIsLoadingCases(false);
      }
    };

    loadCases();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadError(null);
      setUploadResult(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
      setUploadResult(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please choose or drag a file to upload.');
      return;
    }
    if (!selectedCaseId) {
      setUploadError('Please select an open case before uploading evidence.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await evidenceApi.upload(selectedCaseId, selectedFile);
      setUploadResult(result);
    } catch (err: any) {
      setUploadError(
        err.response?.data?.detail || err.message || 'Evidence upload and encryption failed.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setSelectedCaseId(null);
    setUploadResult(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">Secure Evidence Ingestion</h1>
        <p className="text-xs text-slate-500 mt-1">
          Ingest new forensic evidence artifacts into the encrypted vault with automated SHA-256 fingerprinting.
        </p>
      </div>

      {uploadResult ? (
        /* Success Card with real returned payload */
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-8 space-y-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Evidence Ingested & Encrypted Successfully
              </h2>
              <p className="text-xs text-slate-500">
                The artifact has been encrypted with Fernet symmetric cipher and linked to your investigator identity.
              </p>
            </div>
          </div>

          {/* Details Table */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Assigned Evidence ID:</span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                  #{uploadResult.evidence.id}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-medium">Artifact Filename:</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5 truncate">
                  {uploadResult.evidence.filename}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-medium">Raw Ingest Size:</span>
                <p className="font-mono text-slate-900 text-sm mt-0.5">
                  {uploadResult.evidence.size.toLocaleString()} bytes ({formatBytes(uploadResult.evidence.size)})
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-medium">Cipher & Storage Status:</span>
                <p className="font-semibold text-emerald-700 text-sm mt-0.5 flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  <span>Fernet Encrypted at Rest</span>
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <span className="text-slate-500 text-xs font-medium">Calculated SHA-256 Digest:</span>
              <div className="mt-1 bg-white p-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 break-all select-all">
                {uploadResult.evidence.sha256}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Ingest Another File
            </button>
            <Link
              to={`/evidence/${uploadResult.evidence.id}`}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Inspect Evidence Record</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        /* Ingestion Form */
        <form onSubmit={handleUploadSubmit} className="space-y-6">
          {uploadError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-bold">Upload Failed</p>
                <p className="mt-0.5">{uploadError}</p>
              </div>
            </div>
          )}

          {/* Interactive Drag & Drop Box */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
            <label htmlFor="case-select" className="block text-xs font-bold text-slate-700">
              Select Case
            </label>
            <select
              id="case-select"
              value={selectedCaseId ?? ''}
              onChange={(e) => setSelectedCaseId(e.target.value ? Number(e.target.value) : null)}
              disabled={isLoadingCases || isUploading}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-100"
            >
              <option value="">{isLoadingCases ? 'Loading cases...' : 'Choose an open case'}</option>
              {cases.filter((item) => item.status === 'OPEN').map((item) => (
                <option key={item.id} value={item.id}>
                  {item.case_number} - {item.case_name}
                </option>
              ))}
            </select>
            {!isLoadingCases && cases.every((item) => item.status !== 'OPEN') && (
              <p className="text-xs text-amber-700">Create an open case before uploading evidence.</p>
            )}
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/60'
                : selectedFile
                ? 'border-emerald-400 bg-emerald-50/20'
                : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="max-w-md mx-auto space-y-4">
              <div
                className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center transition-transform ${
                  selectedFile
                    ? 'bg-emerald-100 text-emerald-600 scale-105'
                    : 'bg-blue-50 text-blue-600'
                }`}
              >
                {selectedFile ? (
                  <FileText className="w-7 h-7" />
                ) : (
                  <UploadCloud className="w-7 h-7" />
                )}
              </div>

              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 truncate max-w-sm mx-auto">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {formatBytes(selectedFile.size)} • Click or drop to replace file
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-slate-800">
                    Drag and drop forensic artifact file here
                  </p>
                  <p className="text-xs text-slate-500">
                    or <span className="text-blue-600 font-semibold underline">browse from your computer</span>
                  </p>
                  <p className="text-[11px] text-slate-400 pt-2">
                    Accepts all file types (Disk images, logs, memory dumps, PCAP, binaries, documents)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Security Processing Protocol Note */}
          <div className="bg-slate-100/80 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Automated Ingestion Pipeline:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-500 text-[11px] leading-relaxed">
              <li>Calculates SHA-256 checksum of original raw bytes for tamper-detection.</li>
              <li>Encrypts byte stream in memory using AES-128 Fernet symmetric key.</li>
              <li>Stores strictly encrypted payload to secure vault storage.</li>
              <li>Attaches chain-of-custody metadata and records an audit log event.</li>
            </ol>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3">
            {selectedFile && (
              <button
                type="button"
                onClick={resetForm}
                disabled={isUploading}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors"
              >
                Clear Selection
              </button>
            )}

            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Encrypting & Ingesting...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Encrypt & Ingest Evidence</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
