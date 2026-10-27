import React, { useEffect, useRef } from 'react';
import { Info, AlertTriangle, Zap, ArrowLeftRight, Play, Terminal } from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  logs: string[];
  isRunning: boolean;
  protocol: string;
  onViewLogs: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  logs,
  isRunning,
  protocol,
  onViewLogs,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const recentLogs = logs.slice(-5).reverse();

  const getLogMeta = (raw: string) => {
    let tag = 'INFO';
    let body = raw;
    const match = raw.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
      tag = match[1];
      body = match[2];
    }

    if (tag.includes('WARN') || tag.includes('STOP')) {
      return {
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
        boxClass: 'bg-amber-50 text-amber-600 border border-amber-200',
        tagClass: 'bg-amber-100 text-amber-800',
        tag,
        body,
      };
    }
    if (tag.includes('DATA') || tag === 'eAODV' || tag.includes('SUCCESS')) {
      return {
        icon: <Zap className="w-3.5 h-3.5 text-emerald-600" />,
        boxClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
        tagClass: 'bg-emerald-100 text-emerald-800',
        tag,
        body,
      };
    }
    if (tag.includes('RREQ') || tag.includes('RREP') || tag === 'AODV') {
      return {
        icon: <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />,
        boxClass: 'bg-blue-50 text-blue-600 border border-blue-200',
        tagClass: 'bg-blue-100 text-blue-800',
        tag,
        body,
      };
    }
    if (tag.includes('READY') || tag.includes('INIT')) {
      return {
        icon: <Play className="w-3.5 h-3.5 text-indigo-600" />,
        boxClass: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
        tagClass: 'bg-indigo-100 text-indigo-800',
        tag,
        body,
      };
    }
    return {
      icon: <Info className="w-3.5 h-3.5 text-sky-600" />,
      boxClass: 'bg-sky-50 text-sky-600 border border-sky-200',
      tagClass: 'bg-sky-100 text-sky-800',
      tag,
      body,
    };
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-[calc(100%+10px)] right-0 sm:right-[-60px] w-[340px] sm:w-[380px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 overflow-hidden flex flex-col transition-all duration-200"
      role="dialog"
      aria-label="Simulation Events"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800 tracking-tight">Simulation Events</span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            {logs.length} Logs
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isRunning
              ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-blue-600' : 'bg-emerald-500'}`}></span>
          <span>{isRunning ? `Sim Active (${protocol})` : 'NS-3 Ready'}</span>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
        {recentLogs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">No simulation events recorded yet.</div>
        ) : (
          recentLogs.map((raw, idx) => {
            const meta = getLogMeta(raw);
            return (
              <div key={idx} className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5">
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${meta.boxClass}`}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${meta.tagClass}`}>
                      [{meta.tag}]
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {idx === 0 ? 'Latest' : `#${logs.length - idx}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{meta.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            onClose();
            onViewLogs();
          }}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>View Console Logs</span>
        </button>
      </div>
    </div>
  );
};
