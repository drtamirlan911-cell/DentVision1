import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const COLORS = ['#C9A96E', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

interface ChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  formatter?: (value: number) => string;
}

export function AreaChartComponent({ data, xKey, yKey, height = 300, color = '#C9A96E', showGrid = true, showTooltip = true, showLegend = false, formatter }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />}
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: '#7A8899' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#7A8899' }} axisLine={false} tickLine={false} tickFormatter={formatter} />
        {showTooltip && <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#E5E7EB' }} />}
        {showLegend && <Legend />}
        <Area type="monotone" dataKey={yKey} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineChartComponent({ data, xKey, yKey, height = 300, color = '#C9A96E', showGrid = true, showTooltip = true, showLegend = false, formatter }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />}
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: '#7A8899' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#7A8899' }} axisLine={false} tickLine={false} tickFormatter={formatter} />
        {showTooltip && <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#E5E7EB' }} />}
        {showLegend && <Legend />}
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarChartComponent({ data, xKey, yKey, height = 300, color = '#C9A96E', showGrid = true, showTooltip = true, showLegend = false, formatter }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />}
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: '#7A8899' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#7A8899' }} axisLine={false} tickLine={false} tickFormatter={formatter} />
        {showTooltip && <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#E5E7EB' }} />}
        {showLegend && <Legend />}
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PieChartProps {
  data: { name: string; value: number }[];
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

export function DonutChartComponent({ data, height = 300, showLegend = true, innerRadius = 60, outerRadius = 100 }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={3} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#E5E7EB' }} />
        {showLegend && <Legend wrapperStyle={{ color: '#7A8899', fontSize: 12 }} />}
      </PieChart>
    </ResponsiveContainer>
  );
}

interface MultiLineProps {
  data: any[];
  xKey: string;
  lines: { key: string; color: string; name: string }[];
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  formatter?: (value: number) => string;
}

export function MultiLineChart({ data, xKey, lines, height = 300, showGrid = true, showTooltip = true, showLegend = true, formatter }: MultiLineProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />}
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: '#7A8899' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#7A8899' }} axisLine={false} tickLine={false} tickFormatter={formatter} />
        {showTooltip && <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#E5E7EB' }} />}
        {showLegend && <Legend />}
        {lines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} name={l.name} strokeWidth={2} dot={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
