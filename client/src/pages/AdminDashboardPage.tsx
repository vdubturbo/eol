import { Link } from 'react-router-dom';
import {
  Database,
  Cpu,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { StatsCard } from '../components/admin/StatsCard';
import { JobsList } from '../components/admin/JobsList';
import { useDashboardStats, useJobs, useRetryJob, useCancelJob } from '../hooks/useAdmin';
import { LoadingState } from '../components/common/LoadingState';

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentJobs, isLoading: jobsLoading } = useJobs();
  const retryJob = useRetryJob();
  const cancelJob = useCancelJob();

  if (statsLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400">Overview of component database status</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Components"
          value={stats?.total_components.toLocaleString() || '0'}
          icon={<Cpu className="h-6 w-6" />}
          color="cyan"
        />
        <StatsCard
          title="With Pinout Data"
          value={stats?.components_with_pinouts.toLocaleString() || '0'}
          icon={<CheckCircle2 className="h-6 w-6" />}
          color="green"
        />
        <StatsCard
          title="Extraction Rate"
          value={`${stats?.extraction_success_rate || 0}%`}
          icon={<TrendingUp className="h-6 w-6" />}
          color="purple"
        />
        <StatsCard
          title="MTD API Cost"
          value={`$${stats?.mtd_api_cost.toFixed(2) || '0.00'}`}
          icon={<DollarSign className="h-6 w-6" />}
          color="amber"
        />
      </div>

      {/* Pending jobs */}
      {stats && stats.pending_jobs > 0 && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500" />
            <span className="text-amber-400">
              {stats.pending_jobs} job{stats.pending_jobs > 1 ? 's' : ''} pending or
              in progress
            </span>
            <Link to="/admin/ingestion" className="text-sm text-amber-400 hover:text-amber-300 ml-auto">
              View Jobs →
            </Link>
          </div>
        </div>
      )}

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Jobs</h2>
          <Link
            to="/admin/ingestion"
            className="text-sm text-accent-primary hover:text-emerald-400"
          >
            View All →
          </Link>
        </div>
        <JobsList
          jobs={(recentJobs || []).slice(0, 5)}
          isLoading={jobsLoading}
          onRetry={(id) => retryJob.mutate(id)}
          onCancel={(id) => cancelJob.mutate(id)}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/admin/ingestion"
            className="card-hover flex items-center gap-4"
          >
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-medium text-white">New Ingestion Job</h3>
              <p className="text-sm text-gray-400">Import component data</p>
            </div>
          </Link>
          <Link
            to="/admin/data"
            className="card-hover flex items-center gap-4"
          >
            <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-500">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-medium text-white">Browse Data</h3>
              <p className="text-sm text-gray-400">View all components</p>
            </div>
          </Link>
          <Link
            to="/admin/api-usage"
            className="card-hover flex items-center gap-4"
          >
            <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-medium text-white">API Usage</h3>
              <p className="text-sm text-gray-400">Monitor API costs</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
