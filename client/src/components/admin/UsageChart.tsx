import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface UsageChartProps {
  data: Array<{
    date: string;
    [key: string]: string | number;
  }>;
  dataKey: string;
  title: string;
  color?: string;
}

export function UsageAreaChart({
  data,
  dataKey,
  title,
  color = '#10b981',
}: UsageChartProps) {
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-300 mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis stroke="#6b7280" fontSize={12} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#f9fafb' }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fillOpacity={1}
              fill={`url(#gradient-${dataKey})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface ApiBreakdownChartProps {
  data: Array<{
    api_name: string;
    total_requests: number;
    total_parts: number;
    total_cost: number;
  }>;
}

const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444'];

export function ApiBreakdownChart({ data }: ApiBreakdownChartProps) {
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-300 mb-4">API Usage Breakdown</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#6b7280" fontSize={12} />
            <YAxis
              type="category"
              dataKey="api_name"
              stroke="#6b7280"
              fontSize={12}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#f9fafb' }}
            />
            <Bar dataKey="total_requests" name="Requests" fill="#10b981" />
            <Bar dataKey="total_parts" name="Parts" fill="#06b6d4" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface CostPieChartProps {
  data: Array<{
    api_name: string;
    total_cost: number;
  }>;
}

export function CostPieChart({ data }: CostPieChartProps) {
  const filteredData = data.filter((d) => d.total_cost > 0);

  if (filteredData.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Cost by API</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No cost data available
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-300 mb-4">Cost by API</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="total_cost"
              nameKey="api_name"
              label={({ api_name, percent }) =>
                `${api_name}: ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {filteredData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
