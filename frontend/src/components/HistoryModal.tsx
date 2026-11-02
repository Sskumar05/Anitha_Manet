import React, { useEffect, useState } from 'react';
import { X, History, RefreshCw, Eye, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { SimulationHistoryItem } from '../types/simulation';
import { apiService } from '../services/api';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRun: (runId: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, onSelectRun }) => {
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await apiService.getSimulationHistory(40);
      setHistory(items);
    } catch (e: any) {
      setError(
        'Backend Disconnected: Unable to fetch history from http://127.0.0.1:8000. Start the backend server to access persistent simulation records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-primary">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy-900">Simulation Run History</h3>
              <p className="text-xs text-navy-500">Persistent database records from NS-3 executions</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-navy-900 hover:bg-slate-200/60 transition-colors"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-navy-900 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="p-4 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span>Loading historical simulation records...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No simulation runs found in database. Start a simulation from the dashboard to populate history.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Run ID</th>
                    <th className="py-3 px-3">Protocol</th>
                    <th className="py-3 px-3">Nodes / Speed</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">PDR (%)</th>
                    <th className="py-3 px-3">Delay (ms)</th>
                    <th className="py-3 px-3">Energy (J)</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {history.map((item) => (
                    <tr key={item.run_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-navy-900">{item.run_id}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.protocol === 'eAODV'
                              ? 'bg-blue-100 text-primary'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {item.protocol}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.node_count}n / {item.mobility_speed}m/s
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.status === 'running'
                              ? 'bg-blue-100 text-blue-700 animate-pulse'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-navy-900">
                        {item.pdr != null ? `${item.pdr}%` : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.delay_ms != null ? `${item.delay_ms} ms` : (item.status === 'completed' ? 'N/A' : '—')}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.energy_consumed_j != null ? `${item.energy_consumed_j}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            onSelectRun(item.run_id);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-primary font-sans font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Load</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
