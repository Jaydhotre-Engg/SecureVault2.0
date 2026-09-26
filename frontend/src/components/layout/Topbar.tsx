import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { PlusCircle, CheckCircle2, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export const Topbar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/dashboard') return { title: 'Forensic Overview', category: 'Analytics' };
    if (path === '/evidence') return { title: 'Evidence Repository', category: 'Evidence' };
    if (path.startsWith('/evidence/')) return { title: 'Evidence Verification & Chain of Custody', category: 'Evidence Record' };
    if (path === '/upload') return { title: 'Secure Evidence Ingestion', category: 'Ingestion' };
    if (path === '/users') return { title: 'User Access & Directory', category: 'Administration' };
    if (path === '/audit-logs') return { title: 'Forensic Audit Trail', category: 'Administration' };
    return { title: 'SecureVault 2.0', category: 'System' };
  };

  const { title, category } = getPageInfo();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Breadcrumb / Title */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span>{category}</span>
          <span>/</span>
          <span className="text-slate-600 font-semibold">{title}</span>
        </div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
      </div>

      {/* Security Status & Quick Actions */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
        {/* Security badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Evidence: Encrypted at Rest</span>
        </div>

        {/* Upload Action CTA */}
        {location.pathname !== '/upload' && (
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm hover:shadow transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Upload Evidence</span>
          </Link>
        )}

        {/* User Pill */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold uppercase">
            {user?.username?.[0] || 'U'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.username}</p>
            <p className="text-[10px] text-slate-500 font-medium">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
