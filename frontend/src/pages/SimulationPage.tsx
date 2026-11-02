import React from 'react';
import { SimulationStudio } from '../components/SimulationStudio';
import { SimulationConfig, SimulationResult } from '../types/simulation';

interface SimulationPageProps {
  config: SimulationConfig;
  onConfigChange: (newConfig: Partial<SimulationConfig>) => void;
  isRunning: boolean;
  isStarting: boolean;
  activeRunId: string | null;
  onToggleRun: () => void;
  logs: string[];
  onAddLog: (msg: string) => void;
  isBackendAvailable: boolean;
  latestResult?: SimulationResult | null;
}

export const SimulationPage: React.FC<SimulationPageProps> = ({
  config,
  onConfigChange,
  isRunning,
  isStarting,
  activeRunId,
  onToggleRun,
  logs,
  onAddLog,
  isBackendAvailable,
  latestResult,
}) => {
  return (
    <div className="flex flex-col">
      <SimulationStudio
        config={config}
        onConfigChange={onConfigChange}
        isRunning={isRunning}
        isStarting={isStarting}
        activeRunId={activeRunId}
        onToggleRun={onToggleRun}
        logs={logs}
        onAddLog={onAddLog}
        isBackendAvailable={isBackendAvailable}
        latestResult={latestResult}
      />
    </div>
  );
};

