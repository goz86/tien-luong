import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, Clock, Building2, Target, BarChart3 } from 'lucide-react';
import { calculateShiftPay, formatKrw } from '../lib/salary';
import type { Shift } from '../lib/salary';

interface AnalyticsProps {
  shifts: Shift[];
  t: any;
  lang: string;
}

export function Analytics({ shifts, t }: AnalyticsProps) {
  const copy = t || {};

  const stats = useMemo(() => {
    const workplaceData: Record<string, { total: number; hours: number; count: number }> = {};
    const monthlyData: Record<string, number> = {};
    const dayData: Record<string, number> = {};

    let totalIncome = 0;
    let totalHours = 0;

    if (!shifts || shifts.length === 0) {
      return {
        totalIncome: 0,
        totalHours: 0,
        avgHourly: 0,
        workplaceChart: [],
        monthlyChart: [],
        trendChart: []
      };
    }

    shifts.forEach((shift) => {
      try {
        const pay = calculateShiftPay(shift);
        totalIncome += pay.total;
        totalHours += pay.hours;

        const label = shift.label || 'Other';
        if (!workplaceData[label]) {
          workplaceData[label] = { total: 0, hours: 0, count: 0 };
        }
        workplaceData[label].total += pay.total;
        workplaceData[label].hours += pay.hours;
        workplaceData[label].count += 1;

        const month = (shift.date || '').slice(0, 7); 
        if (month) {
          monthlyData[month] = (monthlyData[month] || 0) + pay.total;
        }

        const date = shift.date || '';
        if (date) {
          dayData[date] = (dayData[date] || 0) + pay.total;
        }
      } catch (err) {
        console.error(err);
      }
    });

    const workplaceChart = Object.entries(workplaceData).map(([name, data]) => ({
      name,
      value: data.total
    }));

    const monthlyChart = Object.entries(monthlyData)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const trendChart = Object.entries(dayData)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    return {
      totalIncome,
      totalHours,
      avgHourly: totalHours > 0 ? totalIncome / totalHours : 0,
      workplaceChart,
      monthlyChart,
      trendChart
    };
  }, [shifts]);

  const COLORS = ['#2563eb', '#0f766e', '#d97706', '#dc2626', '#8b5cf6'];

  return (
    <div className="analytics-grid" style={{ opacity: 1, visibility: 'visible' }}>
      {/* Debug Header - To confirm rendering */}
      <div className="bento-card" style={{ background: 'var(--brand-primary)', color: '#fff', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BarChart3 size={24} />
          <div>
            <h3 style={{ margin: 0 }}>{copy.insights || 'Thống kê'}</h3>
            <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>
              {shifts.length} ca làm việc được ghi nhận
            </p>
          </div>
        </div>
      </div>

      {shifts.length === 0 ? (
        <div className="empty-analytics">
          <Target size={64} opacity={0.2} />
          <h3>{copy.noShiftToday || 'Chưa có dữ liệu'}</h3>
          <p>{copy.multiShiftHint || 'Hãy thêm ca làm để xem thống kê'}</p>
        </div>
      ) : (
        <>
          <div className="bento-row">
            <div className="bento-card stat-card primary">
              <div className="card-icon"><TrendingUp size={24} /></div>
              <div>
                <p>{copy.totalIncome || 'Tổng thu nhập'}</p>
                <h3>{formatKrw(stats.totalIncome)}</h3>
              </div>
            </div>

            <div className="bento-card stat-card">
              <div className="card-icon"><Clock size={24} /></div>
              <div>
                <p>{copy.hours || 'Số giờ làm'}</p>
                <h3>{stats.totalHours.toFixed(1)}h</h3>
              </div>
            </div>
          </div>

          <div className="bento-card chart-card large" style={{ minHeight: '300px' }}>
            <div className="card-header">
              <h4>{copy.incomeTrend || 'Xu hướng thu nhập'}</h4>
              <p>{copy.lastShifts || '14 ca gần nhất'}</p>
            </div>
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trendChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    tickFormatter={(val) => (val && typeof val === 'string' ? val.slice(-2) : '')}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    tickFormatter={(val) => (val >= 1000 ? (val / 1000) + 'k' : val)}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '12px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorIncome)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bento-row">
            <div className="bento-card chart-card" style={{ minHeight: '220px' }}>
              <div className="card-header">
                <h4>{copy.workplaceStats || 'Nơi làm'}</h4>
              </div>
              <div style={{ width: '100%', height: '160px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.workplaceChart}
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {stats.workplaceChart.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bento-card chart-card" style={{ minHeight: '220px' }}>
              <div className="card-header">
                <h4>{copy.monthlyIncome || 'Tháng'}</h4>
              </div>
              <div style={{ width: '100%', height: '160px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                      tickFormatter={(val) => (val && typeof val === 'string' ? val.slice(-2) : '')}
                    />
                    <YAxis hide />
                    <Tooltip />
                    <Bar dataKey="total" fill="#0f766e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
