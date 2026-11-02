import React from 'react';
import { TopologyVisualizer } from '../components/TopologyVisualizer';
import { SimulationResult } from '../types/simulation';

interface TopologyPageProps {
  latestResult: SimulationResult | null;
  isBackendAvailable: boolean;
  onSelectRun: (runId: string) => void;
}

export const TopologyPage: React.FC<TopologyPageProps> = ({
  latestResult,
  isBackendAvailable,
  onSelectRun,
}) => {
  return (
    <div className="flex flex-col w-full">
      <TopologyVisualizer
        latestResult={latestResult}
        isBackendAvailable={isBackendAvailable}
        onSelectRun={onSelectRun}
      />
    </div>
  );
};

