import { Play, RotateCcw, XCircle, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { IngestionJob } from '@shared/types';

interface JobCardProps {
  job: IngestionJob;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const statusConfig: Record<
  IngestionJob['status'],
  { icon: React.ReactNode; color: string; label: string }
> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    color: 'text-gray-400',
    label: 'Pending',
  },
  processing: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: 'text-cyan-400',
    label: 'Processing',
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-emerald-400',
    label: 'Completed',
  },
  failed: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-red-400',
    label: 'Failed',
  },
  cancelled: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-gray-500',
    label: 'Cancelled',
  },
};

const jobTypeLabels: Record<IngestionJob['job_type'], string> = {
  api_fetch: 'API Fetch',
  pdf_extract: 'PDF Extraction',
  enrich: 'Data Enrichment',
  full_import: 'Full Import',
};

export function JobCard({ job, onRetry, onCancel }: JobCardProps) {
  const status = statusConfig[job.status];
  const progress =
    job.total_items > 0 ? Math.round((job.processed_items / job.total_items) * 100) : 0;

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={status.color}>{status.icon}</span>
            <span className="font-medium text-white">
              {jobTypeLabels[job.job_type]}
            </span>
            <span className={`text-xs ${status.color}`}>{status.label}</span>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-1">
            {job.id.slice(0, 8)}...
          </p>
        </div>

        <div className="flex items-center gap-2">
          {job.status === 'failed' && onRetry && (
            <button
              onClick={() => onRetry(job.id)}
              className="btn-ghost text-xs flex items-center gap-1"
              title="Retry"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
          {['pending', 'processing'].includes(job.status) && onCancel && (
            <button
              onClick={() => onCancel(job.id)}
              className="btn-ghost text-xs flex items-center gap-1 text-red-400 hover:text-red-300"
              title="Cancel"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {job.status === 'processing' && job.total_items > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>
              {job.processed_items} / {job.total_items}
            </span>
          </div>
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Job params */}
      {job.params && Object.keys(job.params).length > 0 && (
        <div className="text-xs text-gray-400 space-y-1">
          {job.params.source && (
            <div>
              Source: <span className="text-white">{job.params.source}</span>
            </div>
          )}
          {job.params.category && (
            <div>
              Category: <span className="text-white">{job.params.category}</span>
            </div>
          )}
          {job.params.part_numbers && (
            <div>
              Parts:{' '}
              <span className="text-white">{job.params.part_numbers.length} items</span>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {job.error_message && (
        <div className="mt-3 p-2 bg-red-900/20 border border-red-800 rounded text-xs text-red-400">
          {job.error_message}
        </div>
      )}

      {/* Timestamps */}
      <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500 flex justify-between">
        <span>
          Created: {new Date(job.created_at).toLocaleString()}
        </span>
        {job.completed_at && (
          <span>
            Completed: {new Date(job.completed_at).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
