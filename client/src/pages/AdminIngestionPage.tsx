import { useState } from 'react';
import { Plus } from 'lucide-react';
import { JobsList } from '../components/admin/JobsList';
import { NewJobForm } from '../components/admin/NewJobForm';
import { useJobs, useCreateJob, useRetryJob, useCancelJob } from '../hooks/useAdmin';

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

export default function AdminIngestionPage() {
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: jobs, isLoading } = useJobs(
    statusFilter === 'all' ? undefined : statusFilter
  );
  const createJob = useCreateJob();
  const retryJob = useRetryJob();
  const cancelJob = useCancelJob();

  const handleCreateJob = (params: Parameters<typeof createJob.mutate>[0]) => {
    createJob.mutate(params, {
      onSuccess: () => setShowNewJobForm(false),
    });
  };

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Ingestion</h1>
          <p className="text-gray-400">Manage component data import jobs</p>
        </div>
        <button
          onClick={() => setShowNewJobForm(!showNewJobForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Job
        </button>
      </div>

      {/* New job form */}
      {showNewJobForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Create New Job</h2>
          <NewJobForm
            onSubmit={handleCreateJob}
            isSubmitting={createJob.isPending}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-gray-700 pb-4">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              statusFilter === filter.value
                ? 'bg-bg-tertiary text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      <JobsList
        jobs={jobs || []}
        isLoading={isLoading}
        onRetry={(id) => retryJob.mutate(id)}
        onCancel={(id) => cancelJob.mutate(id)}
      />
    </div>
  );
}
