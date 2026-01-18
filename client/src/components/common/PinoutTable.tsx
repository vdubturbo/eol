import type { Pinout, PinFunction } from '@shared/types';

interface PinoutTableProps {
  pinouts: Pinout[];
  compact?: boolean;
}

const pinFunctionColors: Record<PinFunction, string> = {
  INPUT_VOLTAGE: 'text-red-400',
  OUTPUT_VOLTAGE: 'text-orange-400',
  GROUND: 'text-gray-400',
  ENABLE: 'text-cyan-400',
  FEEDBACK: 'text-purple-400',
  BOOTSTRAP: 'text-blue-400',
  SWITCH_NODE: 'text-yellow-400',
  COMPENSATION: 'text-pink-400',
  SOFT_START: 'text-teal-400',
  POWER_GOOD: 'text-emerald-400',
  FREQUENCY: 'text-indigo-400',
  SYNC: 'text-violet-400',
  NC: 'text-gray-600',
  ADJUST: 'text-amber-400',
  OTHER: 'text-gray-400',
};

const pinFunctionLabels: Record<PinFunction, string> = {
  INPUT_VOLTAGE: 'VIN',
  OUTPUT_VOLTAGE: 'VOUT',
  GROUND: 'GND',
  ENABLE: 'EN',
  FEEDBACK: 'FB',
  BOOTSTRAP: 'BOOT',
  SWITCH_NODE: 'SW',
  COMPENSATION: 'COMP',
  SOFT_START: 'SS',
  POWER_GOOD: 'PG',
  FREQUENCY: 'FREQ',
  SYNC: 'SYNC',
  NC: 'NC',
  ADJUST: 'ADJ',
  OTHER: 'OTHER',
};

export function PinoutTable({ pinouts, compact = false }: PinoutTableProps) {
  const sortedPinouts = [...pinouts].sort((a, b) => a.pin_number - b.pin_number);

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-1 text-xs font-mono">
        {sortedPinouts.map((pin) => (
          <div
            key={pin.id}
            className="flex items-center gap-2 px-2 py-1 bg-bg-tertiary rounded"
          >
            <span className="text-gray-500 w-4">{pin.pin_number}</span>
            <span className={pinFunctionColors[pin.pin_function]}>
              {pin.pin_name || pinFunctionLabels[pin.pin_function]}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th className="w-16">Pin</th>
          <th>Name</th>
          <th>Function</th>
          {sortedPinouts.some((p) => p.pin_description) && <th>Description</th>}
        </tr>
      </thead>
      <tbody>
        {sortedPinouts.map((pin) => (
          <tr key={pin.id}>
            <td className="font-mono text-accent-secondary">{pin.pin_number}</td>
            <td className="font-mono font-medium">{pin.pin_name || '-'}</td>
            <td>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${pinFunctionColors[pin.pin_function]} bg-bg-tertiary`}
              >
                {pinFunctionLabels[pin.pin_function]}
              </span>
            </td>
            {sortedPinouts.some((p) => p.pin_description) && (
              <td className="text-gray-400 text-sm">{pin.pin_description || '-'}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
