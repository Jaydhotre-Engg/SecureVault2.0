import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, Search, Filter } from 'lucide-react';
import { evidenceApi } from '../api/evidence';
import { Evidence } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const CustodyListPage: React.FC = () => {
  const navigate = useNavigate();
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    evidenceApi.list().then(setEvidenceList).catch(console.error);
  }, []);

  const filtered = evidenceList.filter(
    (e) =>
      e.filename.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toString().includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Network className="w-6 h-6 text-purple-600" />
            Chain of Custody
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track and verify the cryptographically linked lifecycle of all evidence artifacts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Artifacts</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{evidenceList.length}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-xs">
          <p className="text-xs text-emerald-600 font-semibold uppercase">Secured Chains</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{evidenceList.length}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-xs">
          <p className="text-xs text-amber-600 font-semibold uppercase">Pending Verification</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">0</p>
        </div>
        <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 shadow-xs">
          <p className="text-xs text-rose-600 font-semibold uppercase">Broken Chains</p>
          <p className="text-2xl font-bold text-rose-900 mt-1">0</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by filename or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition-all"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Evidence</th>
                <th className="px-6 py-4 font-semibold">Case ID</th>
                <th className="px-6 py-4 font-semibold">Artifact Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">#{item.id} - {item.filename}</div>
                    <div className="text-xs text-slate-400 mt-1 truncate max-w-xs">{item.file_hash}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500">{item.case_id || '—'}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.verification_status} size="sm" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => navigate(`/custody/evidence/${item.id}`)}
                      className="px-3 py-1.5 object-contain bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded text-xs font-semibold"
                    >
                      View Chain
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                    No evidence items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
