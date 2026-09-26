import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderOpen,
  Plus,
  ShieldCheck,
} from 'lucide-react';

import { casesApi } from '../api/cases';
import { Case } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const CasesPage: React.FC = () => {

  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [caseName, setCaseName] = useState('');
  const [description, setDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCases = async () => {
    try {
      setIsLoading(true);

      const data = await casesApi.list();

      setCases(data);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        'Unable to load cases.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const handleCreateCase = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!caseName.trim()) {
      setError('Case name is required.');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      await casesApi.create({
        case_name: caseName.trim(),
        description: description.trim() || undefined,
      });

      setCaseName('');
      setDescription('');
      setShowCreateForm(false);

      await loadCases();

    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        'Unable to create case.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex items-center justify-between">

        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Case Management
          </h1>

          <p className="text-xs text-slate-500 mt-1">
            Manage forensic cases and their associated evidence.
          </p>
        </div>

        <button
          onClick={() =>
            setShowCreateForm(!showCreateForm)
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
        >
          <Plus className="w-4 h-4" />
          New Case
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-xs">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateCase}
          className="bg-white rounded-xl border border-slate-200 p-6 space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-900">
            Create New Case
          </h2>

          <input
            value={caseName}
            onChange={(e) =>
              setCaseName(e.target.value)
            }
            placeholder="Case name"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
          />

          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            placeholder="Case description (optional)"
            rows={4}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setShowCreateForm(false)
              }
              className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              {isCreating
                ? 'Creating...'
                : 'Create Case'}
            </button>
          </div>
        </form>
      )}

      {/* Cases */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : cases.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FolderOpen className="w-10 h-10 mx-auto text-slate-300" />

          <p className="text-sm font-semibold text-slate-700 mt-4">
            No cases found
          </p>

          <p className="text-xs text-slate-500 mt-1">
            Create your first forensic case.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {cases.map((item) => (
            <Link
              key={item.id}
              to={`/cases/${item.id}`}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >

              <div className="flex items-start justify-between">

                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5" />
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded border ${
                    item.status === 'OPEN'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-slate-600 bg-slate-50 border-slate-200'
                  }`}
                >
                  {item.status}
                </span>

              </div>

              <p className="font-mono text-xs text-blue-600 font-bold mt-4">
                {item.case_number}
              </p>

              <h3 className="font-bold text-slate-900 mt-1">
                {item.case_name}
              </h3>

              {item.description && (
                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                  {item.description}
                </p>
              )}

              <div className="flex items-center gap-1.5 mt-5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                SecureVault case
              </div>

            </Link>
          ))}

        </div>
      )}

    </div>
  );
};