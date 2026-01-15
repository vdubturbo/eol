import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'green' | 'cyan' | 'purple' | 'amber' | 'default';
}

const colorClasses = {
  green: {
    icon: 'bg-emerald-500/10 text-emerald-500',
    glow: 'hover:shadow-glow-green',
  },
  cyan: {
    icon: 'bg-cyan-500/10 text-cyan-500',
    glow: 'hover:shadow-glow-cyan',
  },
  purple: {
    icon: 'bg-purple-500/10 text-purple-500',
    glow: 'hover:shadow-glow-purple',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-500',
    glow: '',
  },
  default: {
    icon: 'bg-gray-500/10 text-gray-500',
    glow: '',
  },
};

export function StatsCard({
  title,
  value,
  icon,
  trend,
  color = 'default',
}: StatsCardProps) {
  const colors = colorClasses[color];

  return (
    <div
      className={`card transition-shadow ${colors.glow}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white font-mono">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value > 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : trend.value < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : (
                <Minus className="h-4 w-4 text-gray-500" />
              )}
              <span
                className={`text-xs ${
                  trend.value > 0
                    ? 'text-emerald-500'
                    : trend.value < 0
                    ? 'text-red-500'
                    : 'text-gray-500'
                }`}
              >
                {trend.value > 0 ? '+' : ''}
                {trend.value}% {trend.label}
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors.icon}`}>{icon}</div>
      </div>
    </div>
  );
}
