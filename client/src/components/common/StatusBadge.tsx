import type { LifecycleStatus } from '@shared/types';

interface StatusBadgeProps {
  status: LifecycleStatus;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<LifecycleStatus, { label: string; color: string; dotColor: string }> = {
  Active: {
    label: 'Active',
    color: 'bg-emerald-900/50 text-emerald-400 border-emerald-700',
    dotColor: 'bg-emerald-400',
  },
  NRND: {
    label: 'NRND',
    color: 'bg-amber-900/50 text-amber-400 border-amber-700',
    dotColor: 'bg-amber-400',
  },
  Obsolete: {
    label: 'Obsolete',
    color: 'bg-red-900/50 text-red-400 border-red-700',
    dotColor: 'bg-red-400',
  },
  Unknown: {
    label: 'Unknown',
    color: 'bg-gray-800/50 text-gray-400 border-gray-600',
    dotColor: 'bg-gray-400',
  },
};

export function StatusBadge({ status, showDot = true, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.Unknown;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border ${config.color} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
      }`}
    >
      {showDot && (
        <span
          className={`${size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'} rounded-full ${config.dotColor} led-pulse`}
        />
      )}
      {config.label}
    </span>
  );
}
