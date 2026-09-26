import React, { useState, useEffect, useMemo } from 'react';
import {
  UserX,
  UserCheck,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { usersApi } from '../api/users';
import { authApi } from '../api/auth';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const UsersManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [showCreateInvestigatorForm, setShowCreateInvestigatorForm] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal State
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [modalAction, setModalAction] = useState<'deactivate' | 'reactivate' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch user directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateInvestigator = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsCreating(true);

    try {
      const newUser = await authApi.register({
        username: createUsername.trim(),
        email: createEmail.trim(),
        password: createPassword,
      });

      setUsers((prevUsers) => [newUser, ...prevUsers]);
      setCreateUsername('');
      setCreateEmail('');
      setCreatePassword('');
      setShowCreateInvestigatorForm(false);
      setSuccessMsg(`Investigator '${newUser.username}' created successfully.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to create investigator.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!targetUser || !modalAction) return;

    setIsProcessing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (modalAction === 'deactivate') {
        const updated = await usersApi.deactivate(targetUser.id);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setSuccessMsg(`User '${targetUser.username}' has been deactivated.`);
      } else {
        const updated = await usersApi.reactivate(targetUser.id);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setSuccessMsg(`User '${targetUser.username}' has been reactivated.`);
      }
      setTargetUser(null);
      setModalAction(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to update user status.');
      setTargetUser(null);
      setModalAction(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.id.toString().includes(searchTerm);

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.is_active).length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const investigatorCount = users.filter((u) => u.role === 'INVESTIGATOR').length;

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
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
            <h1 className="text-xl font-bold text-slate-900">User Access Management</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 uppercase">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage investigator accounts, active directory status, and authentication access.
          </p>
        </div>

        <button
          onClick={() => setShowCreateInvestigatorForm(!showCreateInvestigatorForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Investigator</span>
        </button>

        <button
          onClick={fetchUsers}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Users</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {showCreateInvestigatorForm && (
        <form
          onSubmit={handleCreateInvestigator}
          className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Create Investigator</h2>
              <p className="text-xs text-slate-500 mt-1">
                A new account will be created with the INVESTIGATOR role.
              </p>
            </div>
            <StatusBadge status="INVESTIGATOR" size="sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="investigator-username">
              Username
            </label>
            <input
              id="investigator-username"
              type="text"
              required
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9_.-]+"
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              placeholder="e.g. investigator_doe"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="investigator-email">
              Official Email Address
            </label>
            <input
              id="investigator-email"
              type="email"
              required
              minLength={5}
              maxLength={100}
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="investigator@agency.gov"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="investigator-password">
              Password
            </label>
            <input
              id="investigator-password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isCreating}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
          >
            {isCreating ? (
              <LoadingSpinner size="sm" />
            ) : (
              'Create Investigator'
            )}
          </button>
        </form>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Accounts</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalUsers}</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Users</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{activeUsers}</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Investigators</p>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">{investigatorCount}</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Administrators</p>
          <p className="text-2xl font-extrabold text-purple-600 mt-1">{adminCount}</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by username, email, ID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
          {['ALL', 'ADMIN', 'INVESTIGATOR'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                roleFilter === r
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" label="Loading user directory..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Email Address</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Created At</th>
                  <th className="px-5 py-3.5 text-right">Access Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase">
                          {u.username[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{u.username}</span>
                            {u.id === currentUser?.id && (
                              <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-semibold">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">User ID #{u.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-medium">
                      {u.email}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={u.role} size="sm" />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        status={u.is_active ? 'ACTIVE' : 'INACTIVE'}
                        size="sm"
                      />
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {u.is_active ? (
                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setModalAction('deactivate');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Deactivate</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setModalAction('reactivate');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Reactivate</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!targetUser && !!modalAction}
        title={
          modalAction === 'deactivate'
            ? `Deactivate User '${targetUser?.username}'`
            : `Reactivate User '${targetUser?.username}'`
        }
        message={
          modalAction === 'deactivate'
            ? `Are you sure you want to deactivate ${targetUser?.username}? This user will be immediately barred from logging in or making API requests.`
            : `Are you sure you want to restore access for ${targetUser?.username}? They will be able to log in again.`
        }
        confirmText={modalAction === 'deactivate' ? 'Yes, Deactivate' : 'Yes, Reactivate'}
        confirmVariant={modalAction === 'deactivate' ? 'danger' : 'primary'}
        isLoading={isProcessing}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setTargetUser(null);
          setModalAction(null);
        }}
      />
    </div>
  );
};
