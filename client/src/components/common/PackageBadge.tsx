import { Cpu } from 'lucide-react';

interface PackageBadgeProps {
  packageName: string | null;
  pinCount?: number | null;
  mountingStyle?: 'SMD' | 'THT' | null;
  size?: 'sm' | 'md';
}

export function PackageBadge({
  packageName,
  pinCount,
  mountingStyle,
  size = 'md',
}: PackageBadgeProps) {
  if (!packageName) {
    return (
      <span className="text-gray-500 text-sm italic">Unknown package</span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-bg-tertiary border border-gray-700 font-mono text-accent-secondary">
        <Cpu className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        {packageName}
      </span>
      {pinCount && (
        <span className="text-gray-500">
          {pinCount} pins
        </span>
      )}
      {mountingStyle && (
        <span
          className={`px-1.5 py-0.5 rounded text-xs ${
            mountingStyle === 'SMD'
              ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800'
              : 'bg-amber-900/30 text-amber-400 border border-amber-800'
          }`}
        >
          {mountingStyle}
        </span>
      )}
    </div>
  );
}
