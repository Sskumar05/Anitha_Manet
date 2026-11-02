import React from 'react';
import { PerformanceCharts } from '../components/PerformanceCharts';
import { SimulationConfig } from '../types/simulation';

interface AnalysisPageProps {
  isBackendAvailable: boolean;
  studioConfig?: SimulationConfig;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  isBackendAvailable,
  studioConfig,
}) => {
  return (
    <div className="flex flex-col w-full">
      <PerformanceCharts
        isBackendAvailable={isBackendAvailable}
        studioConfig={studioConfig}
      />
    </div>
  );
};

