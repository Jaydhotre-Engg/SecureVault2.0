import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const normalized = (status || '').toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let IconComponent = Clock;
  let label = status;

  switch (normalized) {
    case 'VALID':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      IconComponent = ShieldCheck;
      label = 'VALID';
      break;
    case 'PENDING':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      IconComponent = Clock;
      label = 'PENDING';
      break;
    case 'TAMPERED':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      IconComponent = ShieldAlert;
      label = 'TAMPERED';
      break;
    case 'ACTIVE':
    case 'TRUE':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      IconComponent = CheckCircle2;
      label = 'ACTIVE';
      break;
    case 'INACTIVE':
    case 'FALSE':
      colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
      IconComponent = AlertTriangle;
      label = 'INACTIVE';
      break;
    case 'ADMIN':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      IconComponent = ShieldCheck;
      label = 'ADMIN';
      break;
    case 'INVESTIGATOR':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      IconComponent = ShieldCheck;
      label = 'INVESTIGATOR';
      break;
    default:
      break;
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3 py-1.5 text-sm font-medium',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${sizeClasses} ${colorClasses}`}
    >
      {showIcon && <IconComponent className={iconSizes} />}
      <span>{label}</span>
    </span>
  );
};
