import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Network, FileText, ArrowRight, CheckCircle2, AlertTriangle, UserPlus, RefreshCw } from 'lucide-react';
import { custodyApi, CustodyEvent, CustodyChainVerificationResponse } from '../api/custody';
import { evidenceApi } from '../api/evidence';
import { Evidence } from '../types';
import { usersApi } from '../api/users';
import { User } from '../types';

export const CustodyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const evidenceId = Number(id);

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [events, setEvents] = useState<CustodyEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [verifyResult, setVerifyResult] = useState<CustodyChainVerificationResponse | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Transfer State
  const [selectedUser, setSelectedUser] = useState<number | ''>('');
  const [transferDesc, setTransferDesc] = useState('');

  const loadData = async () => {
    try {
      const [ev, evs, usrList] = await Promise.all([
        evidenceApi.getById(evidenceId),
        custodyApi.getEvents(evidenceId),
        usersApi.list(),
      ]);
      setEvidence(ev);
      setEvents(evs);
      setUsers(usrList);
    } catch (e: any) {
      alert("Failed to load custody data: " + e.message);
    }
  };

  useEffect(() => {
    if (evidenceId) loadData();
  }, [evidenceId]);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await custodyApi.verifyChain(evidenceId);
      setVerifyResult(result);
    } catch (e: any) {
      alert("Verification requested failed: " + e.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedUser) return;
    try {
      await custodyApi.transferCustody(evidenceId, Number(selectedUser), transferDesc);
      setIsTransferModalOpen(false);
      setSelectedUser('');
      setTransferDesc('');
      loadData();
    } catch (e: any) {
      alert("Transfer failed: " + e.message);
    }
  };

  const getUserName = (uid?: number) => {
    if (!uid) return 'System';
    const u = users.find(x => x.id === uid);
    return u ? u.username : `User #${uid}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/custody')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Custody List</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-lg text-xs font-semibold shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            Transfer Custody
          </button>
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
          >
            {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
            Verify Chain
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Custody Chain: {evidence?.filename}</h1>
            <p className="text-xs text-slate-500 font-mono mt-1">Evidence #{evidence?.id} • {events.length} Events Logged</p>
          </div>
        </div>
      </div>

      {verifyResult && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${verifyResult.status === 'VALID' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {verifyResult.status === 'VALID' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
          <div>
            <p className="text-sm font-bold uppercase tracking-wider">{verifyResult.status === 'VALID' ? 'CUSTODY CHAIN VALID' : 'CUSTODY CHAIN INVALID'}</p>
            <p className="text-xs mt-1">{verifyResult.message}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider">Cryptographic Timeline</h2>
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
          {events.map((event) => (
            <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-200 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <FileText className="w-4 h-4" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-purple-700 bg-purple-100 px-2 py-1 rounded inline-block">{event.event_type}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{new Date(event.timestamp).toLocaleString()}</span>
                </div>
                {event.description && <p className="text-xs text-slate-700">{event.description}</p>}

                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-white p-2 rounded border border-slate-100 mt-1">
                  <span className="text-slate-400">Action by:</span> <span className="font-bold">{getUserName(event.user_id)}</span>
                  {event.event_type === 'TRANSFERRED' && event.to_user_id && (
                    <>
                      <ArrowRight className="w-3 h-3 mx-1 text-slate-400" />
                      <span className="font-bold">{getUserName(event.to_user_id)}</span>
                    </>
                  )}
                </div>

                <div className="text-[10px] font-mono text-slate-400 bg-slate-100 p-2 rounded flex flex-col gap-1 overflow-hidden mt-1">
                  <div className="flex bg-white px-1 border border-slate-200 rounded">
                    <span className="shrink-0 font-bold text-slate-500 mr-2">Prev:</span>
                    <span className="truncate">{event.previous_event_hash || 'NULL'}</span>
                  </div>
                  <div className="flex bg-white px-1 border border-slate-200 rounded text-slate-600">
                    <span className="shrink-0 font-bold text-slate-700 mr-2">This:</span>
                    <span className="truncate">{event.event_hash}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">Transfer Evidence Custody</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer To</label>
                <select value={selectedUser} onChange={(e) => setSelectedUser(Number(e.target.value))} className="w-full text-sm border-slate-300 rounded-lg p-2 bg-slate-50 border">
                  <option value="">Select Investigator...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Authorization Details</label>
                <textarea value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} className="w-full text-sm border-slate-300 rounded-lg p-2 bg-slate-50 border h-24" placeholder="Reason for transfer..."></textarea>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button onClick={() => setIsTransferModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
              <button onClick={handleTransfer} disabled={!selectedUser} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50">Transfer Custody</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
