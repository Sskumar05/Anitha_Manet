import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface HeaderBarProps {
  onRunClick?: () => void;
  isRunning?: boolean;
  isStarting?: boolean;
  isBackendAvailable?: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Do not render on Overview / Dashboard page to avoid duplicate header and extra padding
  if (location.pathname === '/overview' || location.pathname === '/') {
    return null;
  }
  if (location.pathname === '/simulation' || location.pathname === '/') {
    return null;
  }
  if (location.pathname === '/analysis' || location.pathname === '/') {
    return null;
  }
  if (location.pathname === '/topology' || location.pathname === '/') {
    return null;
  }
  if (location.pathname === '/algorithm' || location.pathname === '/') {
    return null;
  }

  // Route-specific headers matching clean SaaS visual hierarchy
  const pageMeta: Record<string, { title: string; subtitle: string }> = {
    '/overview': {
      title: 'Research Overview',
      subtitle: 'Explore ad-hoc wireless routing metrics, energy longevity and protocol telemetry.',
    },
    '/simulation': {
      title: 'Live Simulation Studio',
      subtitle: 'Configure dynamic MANET topologies, mobility parameters and dispatch real NS-3 runs.',
    },
    '/analysis': {
      title: 'Comparative Analytics',
      subtitle: 'Evaluate Standard AODV vs eAODV-CEH performance across PDR, Delay, NRL and Energy.',
    },
    '/topology': {
      title: 'Network Topology',
      subtitle: 'Interactive playback of real NS-3 node coordinates, Wi-Fi PHY links and multi-hop packet hops.',
    },
    '/algorithm': {
      title: 'Algorithm Architecture',
      subtitle: 'Inspect eAODV-CEH Model C composite cost formulation and RFC 3561 loop-freedom invariants.',
    },
  };

  const currentMeta = pageMeta[location.pathname] || pageMeta['/overview'];

  const handleBack = () => {
    if (location.pathname !== '/overview') {
      navigate('/overview');
    }
  };

  return (
    <header className="px-6 sm:px-10 pt-6 pb-5 flex items-center justify-between border-b border-slate-100 w-full">
      {/* Left: Back button + Title + Subtitle */}
      <div className="flex items-center gap-4">
        {location.pathname !== '/overview' && (
          <button
            onClick={handleBack}
            title="Return to Overview"
            className="w-10 h-10 rounded-full border border-slate-200/80 bg-[#F4F5FA] hover:bg-slate-200/70 text-slate-700 flex items-center justify-center transition-all shadow-2xs hover:scale-105 active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
          </button>
        )}

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            {currentMeta.title}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
            {currentMeta.subtitle}
          </p>
        </div>
      </div>
    </header>
  );
};
