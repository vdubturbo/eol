import { useState, useMemo } from 'react';
import { useApiUsage, useApiUsageSummary } from '../hooks/useAdmin';
import {
  UsageAreaChart,
  ApiBreakdownChart,
  CostPieChart,
} from '../components/admin/UsageChart';
import { StatsCard } from '../components/admin/StatsCard';
import { LoadingState } from '../components/common/LoadingState';
import { DollarSign, Activity, Database, TrendingUp } from 'lucide-react';

export default function AdminApiUsagePage() {
  const [days, setDays] = useState(30);

  const { data: usageData, isLoading: usageLoading } = useApiUsage(days);
  const { data: summary, isLoading: summaryLoading } = useApiUsageSummary(days);

  // Aggregate usage by day for chart
  const dailyUsage = useMemo(() => {
    if (!usageData) return [];

    const byDay: Record<string, { requests: number; parts: number; cost: number }> = {};

    usageData.forEach((record) => {
      const date = new Date(record.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (!byDay[date]) {
        byDay[date] = { requests: 0, parts: 0, cost: 0 };
      }
      byDay[date].requests += record.request_count;
      byDay[date].parts += record.parts_returned;
      byDay[date].cost += record.estimated_cost;
    });

    return Object.entries(byDay)
      .map(([date, data]) => ({ date, ...data }))
      .reverse();
  }, [usageData]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!summary) return { requests: 0, parts: 0, cost: 0 };

    return summary.reduce(
      (acc, item) => ({
        requests: acc.requests + item.total_requests,
        parts: acc.parts + item.total_parts,
        cost: acc.cost + item.total_cost,
      }),
      { requests: 0, parts: 0, cost: 0 }
    );
  }, [summary]);

  if (usageLoading || summaryLoading) {
    return <LoadingState message="Loading API usage data..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Usage</h1>
          <p className="text-gray-400">Monitor API requests and costs</p>
        </div>

        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="select w-40"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Requests"
          value={totals.requests.toLocaleString()}
          icon={<Activity className="h-6 w-6" />}
          color="cyan"
        />
        <StatsCard
          title="Parts Retrieved"
          value={totals.parts.toLocaleString()}
          icon={<Database className="h-6 w-6" />}
          color="green"
        />
        <StatsCard
          title="Total Cost"
          value={`$${totals.cost.toFixed(2)}`}
          icon={<DollarSign className="h-6 w-6" />}
          color="amber"
        />
        <StatsCard
          title="Avg Cost/Request"
          value={`$${totals.requests > 0 ? (totals.cost / totals.requests).toFixed(4) : '0.00'}`}
          icon={<TrendingUp className="h-6 w-6" />}
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsageAreaChart
          data={dailyUsage}
          dataKey="requests"
          title="API Requests Over Time"
          color="#06b6d4"
        />
        <UsageAreaChart
          data={dailyUsage}
          dataKey="cost"
          title="Cost Over Time"
          color="#f59e0b"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {summary && <ApiBreakdownChart data={summary} />}
        {summary && <CostPieChart data={summary} />}
      </div>

      {/* Usage table */}
      {summary && summary.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Usage by API</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>API</th>
                  <th className="text-right">Requests</th>
                  <th className="text-right">Parts</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((item) => (
                  <tr key={item.api_name}>
                    <td className="font-medium text-white capitalize">
                      {item.api_name}
                    </td>
                    <td className="text-right font-mono">
                      {item.total_requests.toLocaleString()}
                    </td>
                    <td className="text-right font-mono">
                      {item.total_parts.toLocaleString()}
                    </td>
                    <td className="text-right font-mono">
                      ${item.total_cost.toFixed(2)}
                    </td>
                    <td className="text-right font-mono text-gray-400">
                      {totals.cost > 0
                        ? `${((item.total_cost / totals.cost) * 100).toFixed(1)}%`
                        : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
