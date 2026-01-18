import type { ComponentSpecs } from '@shared/types';
import { Zap, Gauge, Thermometer, Activity } from 'lucide-react';

interface SpecsGridProps {
  specs: ComponentSpecs;
  compact?: boolean;
}

interface SpecItem {
  key: string;
  label: string;
  unit: string;
  icon: React.ReactNode;
  format?: (value: number) => string;
}

const specDefinitions: SpecItem[] = [
  {
    key: 'vin',
    label: 'Input Voltage',
    unit: 'V',
    icon: <Zap className="h-4 w-4 text-yellow-500" />,
  },
  {
    key: 'vout',
    label: 'Output Voltage',
    unit: 'V',
    icon: <Zap className="h-4 w-4 text-orange-500" />,
  },
  {
    key: 'iout_max',
    label: 'Output Current',
    unit: 'A',
    icon: <Gauge className="h-4 w-4 text-cyan-500" />,
  },
  {
    key: 'switching_freq',
    label: 'Switching Freq',
    unit: 'kHz',
    icon: <Activity className="h-4 w-4 text-purple-500" />,
    format: (v) => (v / 1000).toFixed(0),
  },
  {
    key: 'efficiency',
    label: 'Efficiency',
    unit: '%',
    icon: <Activity className="h-4 w-4 text-emerald-500" />,
    format: (v) => (v < 1 ? (v * 100).toFixed(0) : v.toFixed(0)),
  },
  {
    key: 'operating_temp',
    label: 'Operating Temp',
    unit: '°C',
    icon: <Thermometer className="h-4 w-4 text-red-500" />,
  },
];

export function SpecsGrid({ specs, compact = false }: SpecsGridProps) {
  const renderValue = (def: SpecItem) => {
    if (def.key === 'vin') {
      const min = specs.vin_min;
      const max = specs.vin_max;
      if (min !== undefined && max !== undefined) {
        return `${min} - ${max} ${def.unit}`;
      }
      if (max !== undefined) return `up to ${max} ${def.unit}`;
      return null;
    }

    if (def.key === 'vout') {
      const min = specs.vout_min;
      const max = specs.vout_max;
      const type = specs.vout_type;
      if (min !== undefined && max !== undefined) {
        return `${min} - ${max} ${def.unit} (${type || 'Adj'})`;
      }
      if (max !== undefined) return `up to ${max} ${def.unit}`;
      return null;
    }

    if (def.key === 'switching_freq') {
      const min = specs.switching_freq_min;
      const max = specs.switching_freq_max;
      if (min !== undefined && max !== undefined) {
        return `${(min / 1000).toFixed(0)} - ${(max / 1000).toFixed(0)} ${def.unit}`;
      }
      if (min !== undefined) return `${(min / 1000).toFixed(0)} ${def.unit}`;
      return null;
    }

    if (def.key === 'operating_temp') {
      const min = specs.operating_temp_min;
      const max = specs.operating_temp_max;
      if (min !== undefined && max !== undefined) {
        return `${min} to ${max} ${def.unit}`;
      }
      return null;
    }

    const value = specs[def.key] as number | undefined;
    if (value === undefined) return null;
    const formatted = def.format ? def.format(value) : value;
    return `${formatted} ${def.unit}`;
  };

  const visibleSpecs = specDefinitions
    .map((def) => ({ ...def, value: renderValue(def) }))
    .filter((s) => s.value !== null);

  // Collect keys that are handled by predefined specs
  const handledKeys = new Set([
    'vin_min', 'vin_max', 'vout_min', 'vout_max', 'vout_type',
    'iout_max', 'switching_freq_min', 'switching_freq_max',
    'efficiency', 'operating_temp_min', 'operating_temp_max'
  ]);

  // Find additional specs not in the predefined list
  const additionalSpecs = Object.entries(specs || {})
    .filter(([key, value]) => !handledKeys.has(key) && value !== undefined && value !== null)
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, ' '),
      value: String(value),
    }));

  if (visibleSpecs.length === 0 && additionalSpecs.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">No specifications available</div>
    );
  }

  if (compact) {
    const allSpecs = [
      ...visibleSpecs.map(s => ({ key: s.key, label: s.label, value: s.value, icon: s.icon })),
      ...additionalSpecs.map(s => ({ key: s.key, label: s.label, value: s.value, icon: null })),
    ];
    return (
      <div className="flex flex-wrap gap-2">
        {allSpecs.slice(0, 4).map((spec) => (
          <div
            key={spec.key}
            className="flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary rounded text-xs"
          >
            {spec.icon}
            <span className="text-gray-400">{spec.label}:</span>
            <span className="font-mono text-white">{spec.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Predefined specs with icons */}
      {visibleSpecs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {visibleSpecs.map((spec) => (
            <div key={spec.key} className="bg-bg-tertiary rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {spec.icon}
                <span className="text-xs text-gray-400 uppercase tracking-wider">
                  {spec.label}
                </span>
              </div>
              <div className="font-mono text-lg text-white">{spec.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Additional specs */}
      {additionalSpecs.length > 0 && (
        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Additional Specifications</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {additionalSpecs.map((spec) => (
              <div key={spec.key} className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span className="text-sm text-gray-400 capitalize">{spec.label}</span>
                <span className="font-mono text-sm text-white">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
