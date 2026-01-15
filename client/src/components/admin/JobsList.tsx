import { JobCard } from './JobCard';
import { EmptyState } from '../common/EmptyState';
import { SkeletonCard } from '../common/LoadingState';
import type { IngestionJob } from '@shared/types';

interface JobsListProps {
  jobs: IngestionJob[];
  isLoading?: boolean;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export function JobsList({ jobs, isLoading, onRetry, onCancel }: JobsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        type="data"
        title="No jobs found"
        description="Create a new ingestion job to get started."
      />
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onRetry={onRetry} onCancel={onCancel} />
      ))}
    </div>
  );
}
