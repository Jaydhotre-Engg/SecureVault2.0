import React from 'react';
import {
  LogIn,
  LogOut,
  UserPlus,
  UserX,
  UserCheck,
  UploadCloud,
  CheckSquare,
  Shield,
} from 'lucide-react';

interface ActionBadgeProps {
  action: string;
}

export const ActionBadge: React.FC<ActionBadgeProps> = ({ action }) => {
  const norm = (action || '').toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = Shield;
  let label = action;

  switch (norm) {
    case 'LOGIN_SUCCESS':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      Icon = LogIn;
      label = 'LOGIN SUCCESS';
      break;
    case 'LOGIN_FAILED':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      Icon = LogOut;
      label = 'LOGIN FAILED';
      break;
    case 'USER_REGISTERED':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      Icon = UserPlus;
      label = 'USER REGISTERED';
      break;
    case 'USER_DEACTIVATED':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      Icon = UserX;
      label = 'USER DEACTIVATED';
      break;
    case 'USER_REACTIVATED':
      colorClasses = 'bg-teal-50 text-teal-700 border-teal-200';
      Icon = UserCheck;
      label = 'USER REACTIVATED';
      break;
    case 'EVIDENCE_UPLOADED':
      colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      Icon = UploadCloud;
      label = 'EVIDENCE UPLOADED';
      break;
    case 'EVIDENCE_VERIFIED':
      colorClasses = 'bg-sky-50 text-sky-700 border-sky-200';
      Icon = CheckSquare;
      label = 'EVIDENCE VERIFIED';
      break;
    default:
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-mono font-medium border ${colorClasses}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </span>
  );
};
