import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  FolderLock,
  UploadCloud,
  Users,
  ScrollText,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Network
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();

  const navItems = [
    {
      label: 'Dashboard',
      to: '/dashboard',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'INVESTIGATOR'],
    },
    {
      label: 'Evidence Library',
      to: '/evidence',
      icon: FolderLock,
      roles: ['ADMIN', 'INVESTIGATOR'],
    },
    {
      label: 'Cases',
      to: '/cases',
      icon: FolderLock,
      roles: ['ADMIN', 'INVESTIGATOR'],
    },
    {
      label: 'Chain of Custody',
      to: '/custody',
      icon: Network,
      roles: ['ADMIN', 'INVESTIGATOR'],
    },
    {
      label: 'Upload Evidence',
      to: '/upload',
      icon: UploadCloud,
      roles: ['ADMIN', 'INVESTIGATOR'],
    },
  ];

  const adminNavItems = [
    {
      label: 'User Management',
      to: '/users',
      icon: Users,
      roles: ['ADMIN'],
    },
    {
      label: 'Audit Logs',
      to: '/audit-logs',
      icon: ScrollText,
      roles: ['ADMIN'],
    },
  ];

  return (
    <aside className="w-64 bg-navy-900 border-r border-navy-800 flex flex-col h-screen select-none text-slate-300">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-navy-800/80 bg-navy-950/40">
        <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base text-white tracking-tight">SecureVault</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white leading-none">2.0</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Digital Evidence System</p>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 px-3 py-6 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400/90 mb-2">
            Forensic Operations
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                        : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {isAdmin && (
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-purple-400/90 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Administration</span>
            </p>
            <nav className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                          : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Security Status Box */}
      <div className="px-3 py-2 mx-3 mb-3 rounded-lg bg-navy-950/60 border border-navy-800 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>Fernet Encryption:</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Active
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Hashing:</span>
          <span className="text-blue-400 font-mono">SHA-256</span>
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-navy-800/80 bg-navy-950/40">
        <div className="flex items-center justify-between p-2 rounded-lg bg-navy-800/40 border border-navy-700/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.username}</p>
              <div className="flex items-center gap-1">
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                    isAdmin
                      ? 'bg-purple-900/60 text-purple-300 border border-purple-700/40'
                      : 'bg-blue-900/60 text-blue-300 border border-blue-700/40'
                  }`}
                >
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
