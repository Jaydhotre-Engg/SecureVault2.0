import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileLock2, FolderOpen } from 'lucide-react';
import { casesApi } from '../api/cases';
import { evidenceApi } from '../api/evidence';
import { Case, Evidence } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatusBadge } from '../components/common/StatusBadge';

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const caseId = Number(id);
  const [caseRecord, setCaseRecord] = useState<Case | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(caseId) || caseId < 1) {
      setError('Case not found.');
      setIsLoading(false);
      return;
    }

    const loadCase = async () => {
      try {
        const [caseData, evidenceData] = await Promise.all([
          casesApi.getById(caseId),
          evidenceApi.list(),
        ]);
        setCaseRecord(caseData);
        setEvidence(evidenceData.filter((item) => item.case_id === caseId));
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Unable to load case.');
      } finally {
        setIsLoading(false);
      }
    };

    loadCase();
  }, [caseId]);

  if (isLoading) {
    return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  }

  if (error || !caseRecord) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-rose-200 p-10 text-center">
        <p className="text-sm font-semibold text-rose-700">{error || 'Case not found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/cases')}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to cases
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link to="/cases" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600">
        <ArrowLeft className="w-4 h-4" />
        Back to cases
      </Link>

      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="font-mono text-xs font-bold text-blue-600">{caseRecord.case_number}</p>
              <h1 className="text-xl font-bold text-slate-900 mt-1">{caseRecord.case_name}</h1>
              {caseRecord.description && <p className="text-sm text-slate-500 mt-2">{caseRecord.description}</p>}
            </div>
          </div>
          <StatusBadge status={caseRecord.status} />
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Case evidence</h2>
          <Link to="/upload" className="text-xs font-semibold text-blue-600 hover:text-blue-700">Upload evidence</Link>
        </div>
        {evidence.length === 0 ? (
          <p className="text-xs text-slate-500">No evidence is linked to this case yet.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {evidence.map((item) => (
              <Link key={item.id} to={`/evidence/${item.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <FileLock2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-800 truncate">#{item.id} {item.filename}</span>
                </div>
                <StatusBadge status={item.verification_status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
