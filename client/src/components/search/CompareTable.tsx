import { X } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { PackageBadge } from '../common/PackageBadge';
import { PinoutTable } from '../common/PinoutTable';
import { CompatibilityIndicator } from './CompatibilityIndicator';
import type { ComponentWithDetails } from '@shared/types';

interface CompareTableProps {
  components: ComponentWithDetails[];
  referenceId?: string;
  onRemove: (id: string) => void;
  onSetReference: (id: string) => void;
}

export function CompareTable({
  components,
  referenceId,
  onRemove,
  onSetReference,
}: CompareTableProps) {
  const reference = components.find((c) => c.id === referenceId);

  // Collect all spec keys
  const specKeys = new Set<string>();
  components.forEach((c) => {
    Object.keys(c.specs || {}).forEach((k) => specKeys.add(k));
  });

  // Find max pin count for pinout comparison
  const maxPins = Math.max(...components.map((c) => c.pinouts?.length || 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 w-40">
              Property
            </th>
            {components.map((component) => (
              <th
                key={component.id}
                className={`text-left py-3 px-4 min-w-[200px] ${
                  component.id === referenceId
                    ? 'bg-accent-primary/10 border-x border-accent-primary/30'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-accent-secondary font-semibold">
                      {component.mpn}
                    </div>
                    <div className="text-xs text-gray-400">
                      {component.manufacturer?.name}
                    </div>
                    {component.id === referenceId ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 text-xs bg-accent-primary/20 text-accent-primary rounded">
                        Reference
                      </span>
                    ) : (
                      <button
                        onClick={() => onSetReference(component.id)}
                        className="text-xs text-gray-500 hover:text-accent-primary mt-1"
                      >
                        Set as reference
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(component.id)}
                    className="text-gray-500 hover:text-red-400 p-1 -mr-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {/* Status */}
          <tr>
            <td className="py-3 px-4 text-sm text-gray-400">Status</td>
            {components.map((c) => (
              <td
                key={c.id}
                className={`py-3 px-4 ${
                  c.id === referenceId ? 'bg-accent-primary/5' : ''
                }`}
              >
                <StatusBadge status={c.lifecycle_status} />
              </td>
            ))}
          </tr>

          {/* Package */}
          <tr>
            <td className="py-3 px-4 text-sm text-gray-400">Package</td>
            {components.map((c) => (
              <td
                key={c.id}
                className={`py-3 px-4 ${
                  c.id === referenceId ? 'bg-accent-primary/5' : ''
                }`}
              >
                <PackageBadge
                  packageName={c.package_normalized}
                  pinCount={c.pin_count}
                  size="sm"
                />
                {reference && c.id !== referenceId && (
                  <div className="mt-1">
                    <CompatibilityIndicator
                      isCompatible={c.package_normalized === reference.package_normalized}
                      label={
                        c.package_normalized === reference.package_normalized
                          ? 'Match'
                          : 'Different'
                      }
                    />
                  </div>
                )}
              </td>
            ))}
          </tr>

          {/* Specs */}
          {Array.from(specKeys).map((key) => (
            <tr key={key}>
              <td className="py-3 px-4 text-sm text-gray-400 capitalize">
                {key.replace(/_/g, ' ')}
              </td>
              {components.map((c) => {
                const value = c.specs?.[key];
                const refValue = reference?.specs?.[key];
                return (
                  <td
                    key={c.id}
                    className={`py-3 px-4 font-mono text-sm ${
                      c.id === referenceId ? 'bg-accent-primary/5' : ''
                    }`}
                  >
                    {value !== undefined ? String(value) : '-'}
                    {reference && c.id !== referenceId && refValue !== undefined && (
                      <div className="mt-1">
                        <CompatibilityIndicator
                          isCompatible={
                            typeof value === 'number' && typeof refValue === 'number'
                              ? value >= refValue
                              : value === refValue
                          }
                        />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Pinouts */}
          {maxPins > 0 && (
            <tr>
              <td className="py-3 px-4 text-sm text-gray-400 align-top">Pinout</td>
              {components.map((c) => (
                <td
                  key={c.id}
                  className={`py-3 px-4 ${
                    c.id === referenceId ? 'bg-accent-primary/5' : ''
                  }`}
                >
                  {c.pinouts && c.pinouts.length > 0 ? (
                    <PinoutTable pinouts={c.pinouts} compact />
                  ) : (
                    <span className="text-gray-500 text-sm italic">No pinout data</span>
                  )}
                </td>
              ))}
            </tr>
          )}

          {/* Datasheet */}
          <tr>
            <td className="py-3 px-4 text-sm text-gray-400">Datasheet</td>
            {components.map((c) => (
              <td
                key={c.id}
                className={`py-3 px-4 ${
                  c.id === referenceId ? 'bg-accent-primary/5' : ''
                }`}
              >
                {c.datasheet_url ? (
                  <a
                    href={c.datasheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-secondary hover:text-accent-primary text-sm"
                  >
                    View PDF
                  </a>
                ) : (
                  <span className="text-gray-500 text-sm">-</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
