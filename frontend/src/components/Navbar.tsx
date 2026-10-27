import React, { useState } from 'react';
import { Network, Bell, Settings, History, CheckCircle2, AlertCircle } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { BackendHealth } from '../types/simulation';

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  logs: string[];
  isRunning: boolean;
  protocol: string;
  backendHealth: BackendHealth | null;
  onOpenHistory: () => void;
  onViewLogs: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  logs,
  isRunning,
  protocol,
  backendHealth,
  onOpenHistory,
  onViewLogs,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);

  const navLinks = [
    { id: 'overview', label: 'Overview' },
    { id: 'simulation', label: 'Simulation' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'topology', label: 'Topology' },
    { id: 'algorithm', label: 'Algorithm' },
  ];

  const handleScroll = (id: string) => {
    onTabChange(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-9 py-4 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform">
          <Network className="w-5 h-5" />
        </div>
        <div>
          <span className="block font-bold text-base text-navy-900 tracking-tight leading-snug">
            MANET Research Lab
          </span>
          <span className="block text-xs font-medium text-navy-500 tracking-normal">
            CS2708 · Energy-Aware AODV Protocol
          </span>
        </div>
      </div>

      {/* Segmented Pill Navigation */}
      <div className="hidden md:flex items-center bg-[#F3F5FA] p-1 rounded-full border border-slate-200/70 gap-0.5">
        {navLinks.map((link) => (
          <button
            key={link.id}
            onClick={() => handleScroll(link.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all ${
              activeTab === link.id
                ? 'bg-primary text-white shadow-sm shadow-blue-500/30 font-bold'
                : 'text-navy-500 hover:text-navy-900 hover:bg-slate-200/60'
            }`}
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* Right Nav Actions */}
      <div className="flex items-center gap-2.5">
        {/* Backend Connectivity Status */}
        <div
          title={
            backendHealth?.ns3_engine.ns3_detected
              ? `Connected to FastAPI + NS-3 (${backendHealth.ns3_engine.distro})`
              : backendHealth
              ? 'FastAPI connected (Demo fallback active)'
              : 'Backend offline (Client demo mode)'
          }
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            backendHealth?.ns3_engine.ns3_detected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : backendHealth
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendHealth?.ns3_engine.ns3_detected
                ? 'bg-emerald-500 animate-pulse'
                : backendHealth
                ? 'bg-blue-500'
                : 'bg-amber-500'
            }`}
          ></span>
          <span>
            {backendHealth?.ns3_engine.ns3_detected
              ? 'NS-3 Connected'
              : backendHealth
              ? 'FastAPI Active'
              : 'Demo Mode'}
          </span>
        </div>

        {/* History Modal Trigger */}
        <button
          onClick={onOpenHistory}
          title="Simulation History"
          className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-navy-500 hover:text-navy-900 flex items-center justify-center transition-colors shadow-sm"
        >
          <History className="w-4 h-4" />
        </button>

        {/* Notifications Button */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            title="Simulation Notifications"
            aria-expanded={notifOpen}
            className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-navy-500 hover:text-navy-900 flex items-center justify-center transition-colors shadow-sm relative"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-white"></span>
          </button>

          <NotificationDropdown
            isOpen={notifOpen}
            onClose={() => setNotifOpen(false)}
            logs={logs}
            isRunning={isRunning}
            protocol={protocol}
            onViewLogs={onViewLogs}
          />
        </div>

        {/* Settings button */}
        <button
          onClick={() => handleScroll('simulation')}
          title="System Settings"
          className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-navy-500 hover:text-navy-900 flex items-center justify-center transition-colors shadow-sm"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
