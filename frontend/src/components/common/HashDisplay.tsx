import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface HashDisplayProps {
  hash: string;
  truncate?: boolean;
  truncateLength?: number;
  className?: string;
  showCopy?: boolean;
}

export const HashDisplay: React.FC<HashDisplayProps> = ({
  hash,
  truncate = true,
  truncateLength = 12,
  className = '',
  showCopy = true,
}) => {
  const [copied, setCopied] = useState(false);

  if (!hash) {
    return <span className="text-slate-400 font-mono text-xs">N/A</span>;
  }

  const displayText = truncate && hash.length > truncateLength * 2
    ? `${hash.substring(0, truncateLength)}...${hash.substring(hash.length - truncateLength)}`
    : hash;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded border border-slate-200 transition-colors ${className}`}>
      <span title={hash} className="select-all">
        {displayText}
      </span>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="text-slate-400 hover:text-slate-600 focus:outline-none p-0.5"
          title="Copy SHA-256 hash"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </span>
  );
};
