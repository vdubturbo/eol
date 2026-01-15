interface MatchScoreBarProps {
  score: number; // 0-1
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function MatchScoreBar({
  score,
  showPercentage = true,
  size = 'md',
  label,
}: MatchScoreBarProps) {
  const percentage = Math.round(score * 100);

  // Color based on score
  const getBarColor = () => {
    if (score >= 0.9) return 'bg-emerald-500';
    if (score >= 0.7) return 'bg-cyan-500';
    if (score >= 0.5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getGlowColor = () => {
    if (score >= 0.9) return 'shadow-glow-green';
    if (score >= 0.7) return 'shadow-glow-cyan';
    return '';
  };

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
          <span>{label}</span>
          {showPercentage && <span className="font-mono">{percentage}%</span>}
        </div>
      )}
      <div className={`w-full ${heights[size]} rounded-full bg-bg-tertiary overflow-hidden`}>
        <div
          className={`${heights[size]} rounded-full ${getBarColor()} ${getGlowColor()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {!label && showPercentage && (
        <div className="mt-1 text-right text-xs font-mono text-gray-400">{percentage}%</div>
      )}
    </div>
  );
}
