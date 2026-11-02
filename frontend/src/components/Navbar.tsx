import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, History, Sparkles, User, Activity } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { BackendHealth } from '../types/simulation';
import logoImg from '../assets/logo.png';

interface NavbarProps {
  logs: string[];
  isRunning: boolean;
  protocol: string;
  backendHealth: BackendHealth | null;
  onOpenHistory: () => void;
  onViewLogs?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  logs,
  isRunning,
  protocol,
  backendHealth,
  onOpenHistory,
  onViewLogs,
  onTabChange,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { path: '/overview', label: 'Dashboard' },
    { path: '/simulation', label: 'Simulation' },
    { path: '/analysis', label: 'Analysis' },
    { path: '/topology', label: 'Topology' },
    { path: '/algorithm', label: 'Algorithm' },
  ];

  const currentPath = location.pathname === '/' ? '/overview' : location.pathname;

  const handleNavClick = (path: string) => {
    navigate(path);
    if (onTabChange) {
      onTabChange(path.replace('/', ''));
    }
  };

  const handleViewLogs = () => {
    navigate('/simulation');
    if (onViewLogs) {
      onViewLogs();
    }
  };

  return (
    <nav className="sticky top-1 z-10 flex items-center justify-between px-6 sm:px-10 py-0 bg-white/95 backdrop-blur-md border-b border-slate-100/90 transition-all gap-4 w-full">
      {/* Left: Brand Identity */}
      <div className="flex items-center shrink-0">
        <div
          onClick={() => handleNavClick('/overview')}
          className="flex items-center cursor-pointer group"
          title="MANET Research Lab"
        >
          <img
            src={logoImg}
            alt="MANET Research Lab"
            className="h-11 sm:h-[50px] md:h-[62px] lg:h-[120px] w-auto max-w-[160px] sm:max-w-[200px] md:max-w-[240px] lg:max-w-[300px] object-contain transition-transform group-hover:scale-[1.02]"
          />
        </div>
      </div>

      {/* Center: Signature FINNOVA Dark Pill Navigation */}
      <div className="flex items-center bg-[#13141F] p-1.5 rounded-full border border-slate-800/60 shadow-lg shadow-slate-900/10 gap-1 overflow-x-auto no-scrollbar max-w-[55vw] sm:max-w-none">
        {navLinks.map((link) => {
          const isActive = currentPath === link.path;
          return (
            <button
              key={link.path}
              onClick={() => handleNavClick(link.path)}
              className={`px-4 sm:px-5 py-2 rounded-full text-xs font-bold tracking-tight transition-all duration-200 shrink-0 flex items-center justify-center ${
                isActive
                  ? 'bg-[#635BFF] text-white shadow-md shadow-indigo-600/40 scale-100'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{link.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Refined Utility Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Backend Status Pill */}
        <div
          title={
            backendHealth?.ns3_engine.ns3_detected
              ? `Connected to FastAPI + NS-3 Engine (${backendHealth.ns3_engine.distro})`
              : backendHealth
              ? 'FastAPI connected (NS-3 engine directory not detected)'
              : 'Backend offline — simulations disabled until FastAPI is reachable'
          }
          className={`hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${
            backendHealth?.ns3_engine.ns3_detected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
              : backendHealth
              ? 'bg-blue-50 text-blue-700 border-blue-200/80'
              : 'bg-rose-50 text-rose-700 border-rose-200/80'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendHealth?.ns3_engine.ns3_detected
                ? 'bg-emerald-500 animate-pulse'
                : backendHealth
                ? 'bg-blue-500'
                : 'bg-rose-500'
            }`}
          ></span>
          <span>
            {backendHealth?.ns3_engine.ns3_detected
              ? 'NS-3 Active'
              : backendHealth
              ? 'FastAPI Up'
              : 'Disconnected'}
          </span>
        </div>

        {/* History Modal Trigger */}
        <button
          onClick={onOpenHistory}
          title="Simulation History"
          className="w-10 h-10 rounded-2xl border border-slate-200/70 bg-[#F4F5FA] hover:bg-slate-200/80 text-slate-700 flex items-center justify-center transition-all shadow-2xs hover:scale-105 active:scale-95"
        >
          <History className="w-4 h-4 text-slate-600" />
        </button>

        {/* Notifications Button */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            title="Simulation Notifications"
            aria-expanded={notifOpen}
            className="w-10 h-10 rounded-2xl border border-slate-200/70 bg-[#F4F5FA] hover:bg-slate-200/80 text-slate-700 flex items-center justify-center transition-all shadow-2xs hover:scale-105 active:scale-95 relative"
          >
            <Bell className="w-4 h-4 text-slate-600" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#635BFF] ring-2 ring-white"></span>
          </button>

          <NotificationDropdown
            isOpen={notifOpen}
            onClose={() => setNotifOpen(false)}
            logs={logs}
            isRunning={isRunning}
            protocol={protocol}
            onViewLogs={handleViewLogs}
          />
        </div>

        {/* Researcher Avatar Badge */}
        <div
          title="Researcher Workspace"
          className="w-10 h-10 rounded-2xl border border-indigo-100 bg-gradient-to-tr from-indigo-50 to-purple-50 text-[#635BFF] flex items-center justify-center font-black text-xs shadow-2xs cursor-default select-none"
        >
          <User className="w-4 h-4 text-[#635BFF]" />
        </div>
      </div>
    </nav>
  );
};
