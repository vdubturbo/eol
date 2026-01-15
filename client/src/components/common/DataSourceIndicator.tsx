import type { DataSource } from '@shared/types';

interface DataSourceIndicatorProps {
  sources: DataSource[];
  showLabels?: boolean;
}

const sourceConfig: Record<DataSource, { label: string; color: string }> = {
  nexar: { label: 'Nexar', color: 'bg-blue-500' },
  digikey: { label: 'Digi-Key', color: 'bg-red-500' },
  mouser: { label: 'Mouser', color: 'bg-orange-500' },
  lcsc: { label: 'LCSC', color: 'bg-yellow-500' },
  pdf: { label: 'PDF', color: 'bg-purple-500' },
  manual: { label: 'Manual', color: 'bg-gray-500' },
};

const allSources: DataSource[] = ['nexar', 'digikey', 'mouser', 'lcsc', 'pdf', 'manual'];

export function DataSourceIndicator({ sources, showLabels = false }: DataSourceIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {allSources.map((source) => {
        const config = sourceConfig[source];
        const isActive = sources.includes(source);

        return (
          <div
            key={source}
            className={`flex items-center gap-1.5 ${isActive ? 'opacity-100' : 'opacity-30'}`}
            title={config.label}
          >
            <span
              className={`h-2 w-2 rounded-full ${config.color} ${isActive ? 'led-pulse' : ''}`}
            />
            {showLabels && (
              <span className="text-xs text-gray-400">{config.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ConfidenceIndicatorProps {
  score: number;
}

export function ConfidenceIndicator({ score }: ConfidenceIndicatorProps) {
  const percentage = Math.round(score * 100);
  const getColor = () => {
    if (score >= 0.9) return 'text-emerald-400';
    if (score >= 0.7) return 'text-cyan-400';
    if (score >= 0.5) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <span className={`font-mono text-sm ${getColor()}`}>
      {percentage}% confidence
    </span>
  );
}
