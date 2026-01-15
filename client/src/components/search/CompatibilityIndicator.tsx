import { Check, X, AlertTriangle } from 'lucide-react';

interface CompatibilityIndicatorProps {
  isCompatible: boolean;
  isWarning?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}

export function CompatibilityIndicator({
  isCompatible,
  isWarning = false,
  label,
  size = 'sm',
}: CompatibilityIndicatorProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  if (isWarning) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-400">
        <AlertTriangle className={iconSize} />
        {label && <span className="text-xs">{label}</span>}
      </span>
    );
  }

  if (isCompatible) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <Check className={iconSize} />
        {label && <span className="text-xs">{label}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-red-400">
      <X className={iconSize} />
      {label && <span className="text-xs">{label}</span>}
    </span>
  );
}

interface CompatibilityBadgeProps {
  type: 'compatible' | 'warning' | 'incompatible';
  label: string;
}

export function CompatibilityBadge({ type, label }: CompatibilityBadgeProps) {
  const config = {
    compatible: {
      icon: Check,
      className: 'bg-emerald-900/50 text-emerald-400 border-emerald-700',
    },
    warning: {
      icon: AlertTriangle,
      className: 'bg-amber-900/50 text-amber-400 border-amber-700',
    },
    incompatible: {
      icon: X,
      className: 'bg-red-900/50 text-red-400 border-red-700',
    },
  };

  const { icon: Icon, className } = config[type];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
