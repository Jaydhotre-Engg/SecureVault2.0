import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollText,
  Search,
  RefreshCw,
  AlertCircle,
  User,
} from 'lucide-react';
import { auditApi } from '../api/audit';
import { AuditLog } from '../types';
import { ActionBadge } from '../components/common/ActionBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await auditApi.getLogs(150);
      setLogs(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to retrieve audit log repository');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const uniqueActions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return Array.from(set);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        (log.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.detail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.ip_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.resource_type || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Forensic Audit Trail & Chain of Custody</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 uppercase">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident, sanitized security audit log for all authentication, evidence, and administrative events.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by user, IP, or details..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Action Select */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Event Type:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">ALL EVENTS ({logs.length})</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act} ({logs.filter((l) => l.action === act).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" label="Retrieving security audit logs..." />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <ScrollText className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600 text-sm">No audit logs matched your query</p>
            <p className="text-slate-400">All recorded security events will appear here chronologically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 w-16">ID</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Security Action</th>
                  <th className="px-5 py-3.5">Resource Target</th>
                  <th className="px-5 py-3.5">Client IP</th>
                  <th className="px-5 py-3.5">Sanitized Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors font-sans">
                    <td className="px-5 py-3.5 font-mono text-slate-400 font-semibold text-xs">
                      #{log.id}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap text-xs">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-5 py-3.5">
                      {log.username ? (
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.username}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Anonymous</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {log.resource_type ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-xs font-mono">
                          {log.resource_type} {log.resource_id ? `#${log.resource_id}` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 text-xs font-sans max-w-md break-words">
                      {log.detail || '—'}
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
