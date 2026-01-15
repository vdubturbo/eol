import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Loader2 className={`${sizes[size]} text-accent-primary animate-spin mb-4`} />
      <span className="text-gray-400 text-sm">{message}</span>
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 className={`${sizes[size]} text-accent-primary animate-spin ${className}`} />
  );
}

// Skeleton components for loading states
export function SkeletonText({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton h-4 rounded ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div>
          <SkeletonText className="w-32 mb-2" />
          <SkeletonText className="w-24 h-3" />
        </div>
        <SkeletonText className="w-16 h-6" />
      </div>
      <SkeletonText className="w-full mb-2" />
      <SkeletonText className="w-3/4" />
      <div className="flex items-center gap-4 mt-4">
        <SkeletonText className="w-20" />
        <SkeletonText className="w-16" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-700">
      {/* Header */}
      <div className="bg-bg-tertiary px-4 py-3 flex gap-4">
        <SkeletonText className="w-24" />
        <SkeletonText className="w-32" />
        <SkeletonText className="w-20" />
        <SkeletonText className="w-24" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-t border-gray-800 flex gap-4">
          <SkeletonText className="w-24" />
          <SkeletonText className="w-32" />
          <SkeletonText className="w-20" />
          <SkeletonText className="w-24" />
        </div>
      ))}
    </div>
  );
}
