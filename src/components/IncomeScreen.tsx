import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Coins,
  Edit2,
  Home,
  Landmark,
  Phone,
  PiggyBank,
  Plus,
  ReceiptText,
  Sparkles,
  Trophy,
  Trash2,
  TrendingUp,
  Utensils,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { calculateShiftPay, formatKrw } from '../lib/salary';
import type { Expense, RateState, Shift, VenueColors } from '../lib/types';
import { getVenueColor } from '../utils/helpers';

type IncomeTab = 'overview' | 'expenses' | 'workplaces';
type IconComponent = LucideIcon;

const incomeTabs: Array<{ id: IncomeTab; label: string; icon: IconComponent }> = [
  { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
  { id: 'expenses', label: 'Chi tiêu', icon: ReceiptText },
  { id: 'workplaces', label: 'Nơi làm', icon: Building2 },
];

const categoryMeta: Record<Expense['category'], { label: string; icon: IconComponent; tone: string }> = {
  rent: { label: 'Tiền nhà', icon: Home, tone: 'blue' },
  phone: { label: 'Điện thoại', icon: Phone, tone: 'green' },
  food: { label: 'Ăn uống', icon: Utensils, tone: 'amber' },
  other: { label: 'Chi phí khác', icon: ReceiptText, tone: 'coral' },
};

const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function IncomeScreen({
  monthlyTotal,
  monthlyHours,
  averageHourly,
  workplaces,
  rate,
  shifts,
  venueColors,
  minimumWage,
  expenses,
  onAddExpense,
  onDeleteExpense,
  target,
  onSetTarget,
}: {
  monthlyTotal: number;
  monthlyHours: number;
  averageHourly: number;
  workplaces: Array<{ label: string; total: number; count: number; hours: number }>;
  rate: RateState;
  shifts: Shift[];
  venueColors: VenueColors;
  minimumWage: number;
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  target: number;
  onSetTarget: (target: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<IncomeTab>('overview');
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(target.toString());
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState<Omit<Expense, 'id'>>({
    category: 'food',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const prevTotalRef = useRef(monthlyTotal);

  const weekdayTotals = useMemo(
    () =>
      weekdayLabels.map((_, index) =>
        shifts
          .filter((shift) => {
            const day = new Date(`${shift.date}T00:00:00`).getDay();
            return (day + 6) % 7 === index;
          })
          .reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0)
      ),
    [shifts]
  );

  const totalExpenses = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);
  const netBalance = monthlyTotal - totalExpenses;
  const maxWeekdayTotal = Math.max(...weekdayTotals, 1);
  const strongestDay = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const progressPercentage = Math.min((monthlyTotal / (target || 1)) * 100, 100);
  const progressColor = progressPercentage >= 100 ? '#0d9b72' : progressPercentage >= 55 ? '#f59e0b' : '#ff6b7a';
  const missingTarget = Math.max(target - monthlyTotal, 0);
  const monthLabel = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date());

  const workplaceInsights = useMemo(
    () =>
      workplaces.map((workplace) => ({
        ...workplace,
        hourly: workplace.hours ? workplace.total / workplace.hours : 0,
        share: monthlyTotal ? (workplace.total / monthlyTotal) * 100 : 0,
      })),
    [monthlyTotal, workplaces]
  );

  const dailyAggregated = useMemo(() => {
    const map = new Map<string, { total: number; hours: number }>();
    shifts.forEach((s) => {
      const current = map.get(s.date) || { total: 0, hours: 0 };
      const pay = calculateShiftPay(s);
      const h = Number(s.hours) || 0;
      map.set(s.date, { total: current.total + pay.total, hours: current.hours + h });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [shifts]);

  const maxHoursInDay = useMemo(() => {
    if (dailyAggregated.length === 0) return 0;
    const hours = dailyAggregated.map(([, data]) => data.hours);
    const max = Math.max(...hours);
    return isNaN(max) ? 0 : max;
  }, [dailyAggregated]);

  const bestDayData = useMemo(() => {
    if (dailyAggregated.length === 0) return null;
    return dailyAggregated.reduce((prev, curr) => (curr[1].total > prev[1].total ? curr : prev));
  }, [dailyAggregated]);

  // Monthly stats for the new chart (summarize by day of month)
  const monthlyChartData = useMemo(() => {
    const daysInMonth = 31; // Simplified, or use actual days
    const results = Array(daysInMonth).fill(0);
    shifts.forEach(s => {
      const d = new Date(`${s.date}T00:00:00`).getDate();
      if (d <= daysInMonth) {
        results[d - 1] += calculateShiftPay(s).total;
      }
    });
    return results;
  }, [shifts]);

  const maxMonthlyDay = Math.max(...monthlyChartData, 1);

  useEffect(() => {
    if (monthlyTotal >= target && prevTotalRef.current < target && target > 0) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#2752ff', '#0d9b72', '#ff6b7a', '#f59e0b'],
      });
    }
    prevTotalRef.current = monthlyTotal;
  }, [monthlyTotal, target]);

  function handleSaveTarget() {
    const value = Number(tempTarget);
    if (Number.isFinite(value) && value > 0) onSetTarget(value);
    setIsEditingTarget(false);
  }

  function handleAddExpense() {
    if (expenseForm.amount <= 0) return;
    onAddExpense(expenseForm);
    setExpenseForm({
      category: 'food',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      note: '',
    });
    setIsAddingExpense(false);
  }

  return (
    <>
      <header className="income-header">
        <span>{monthLabel}</span>
      </header>

      <section className="income-ledger-hero">
        <div className="income-hero-top">
          <div>
            <span>Thu nhập ròng tháng này</span>
            <h2>{formatKrw(netBalance)}</h2>
          </div>
          <WalletCards size={28} />
        </div>
        <div className="income-hero-metrics">
          <article>
            <span>Tổng lương</span>
            <strong>{formatKrw(monthlyTotal)}</strong>
          </article>
          <article>
            <span>Chi tiêu</span>
            <strong>{formatKrw(totalExpenses)}</strong>
          </article>
          <article>
            <span>Tổng giờ</span>
            <strong>{monthlyHours.toFixed(1)}h</strong>
          </article>
        </div>
      </section>

      <section className="income-goal-panel">
        <div className="income-goal-head">
          <div>
            <span>Mục tiêu tháng</span>
            {isEditingTarget ? (
              <div className="income-target-edit">
                <input type="number" value={tempTarget} onChange={(event) => setTempTarget(event.target.value)} autoFocus />
                <button type="button" onClick={handleSaveTarget} aria-label="Lưu mục tiêu">
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <strong>{formatKrw(target)}</strong>
            )}
          </div>
          <button type="button" className="income-edit-button" onClick={() => setIsEditingTarget(true)} aria-label="Sửa mục tiêu">
            <Edit2 size={16} />
          </button>
        </div>
        <div className="income-progress-track" aria-label={`Đã đạt ${progressPercentage.toFixed(0)}% mục tiêu`}>
          <span style={{ width: `${progressPercentage}%`, background: progressColor }} />
        </div>
        <p>{missingTarget > 0 ? `Cần ${formatKrw(missingTarget)} để đạt mục tiêu.` : 'Bạn đã vượt mục tiêu tháng này.'}</p>
      </section>

      <div className="income-subtabs" role="tablist" aria-label="Mục thu nhập">
        {incomeTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? 'active' : ''}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="income-tab-body">
        {activeTab === 'overview' ? (
          <>
            <section className="income-chart-panel">
              <div className="income-section-head">
                <div>
                  <p>Nhịp làm việc tuần</p>
                  <h2>Thu theo ngày trong tuần</h2>
                </div>
                <TrendingUp size={22} />
              </div>
              <div className="income-week-bars">
                {weekdayTotals.map((value, index) => (
                  <div key={weekdayLabels[index]} className={index === strongestDay && value > 0 ? 'hot' : ''}>
                    <span style={{ height: `${Math.max(4, (value / maxWeekdayTotal) * 80)}px` }} />
                    <small>{weekdayLabels[index]}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="income-chart-panel monthly">
              <div className="income-section-head">
                <div>
                  <p>Tổng quan tháng</p>
                  <h2>Thu nhập 31 ngày qua</h2>
                </div>
                <BarChart3 size={22} />
              </div>
              <div className="income-month-bars">
                {monthlyChartData.map((value, idx) => (
                  <div key={idx} className={value === maxMonthlyDay && value > 0 ? 'top-day' : ''}>
                    <span style={{ height: `${Math.max(2, (value / maxMonthlyDay) * 50)}px` }} />
                  </div>
                ))}
              </div>
            </section>

            <section className="income-snapshot-grid">
              <article>
                <Coins size={20} />
                <span>Lương TB/giờ</span>
                <strong>{formatKrw(averageHourly)}</strong>
              </article>
              <article>
                <CalendarDays size={20} />
                <span>Số ca tháng</span>
                <strong>{shifts.length} ca</strong>
              </article>
              <article>
                <Clock size={20} />
                <span>Kỷ lục giờ làm</span>
                <strong>{maxHoursInDay.toFixed(1)}h</strong>
              </article>
              <article className="gold">
                <Trophy size={20} />
                <span>Ngày bội thu</span>
                <strong>{bestDayData ? new Date(bestDayData[0]).getDate() + '/' + (new Date(bestDayData[0]).getMonth() + 1) : '--'}</strong>
              </article>
            </section>
          </>
        ) : null}

        {activeTab === 'expenses' ? (
          <section className="income-expense-panel">
            <div className="income-section-head">
              <div>
                <p>Quản lý chi tiêu</p>
                <h2>Khoản đã ghi</h2>
              </div>
              <button type="button" className="income-mini-action" onClick={() => setIsAddingExpense((value) => !value)} aria-label="Thêm chi tiêu">
                <Plus size={18} />
              </button>
            </div>

            {isAddingExpense ? (
              <div className="income-expense-form">
                <label>
                  <span>Hạng mục</span>
                  <select
                    value={expenseForm.category}
                    onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value as Expense['category'] })}
                  >
                    {Object.entries(categoryMeta).map(([value, meta]) => (
                      <option key={value} value={value}>{meta.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Số tiền</span>
                  <input
                    type="number"
                    value={expenseForm.amount || ''}
                    placeholder="0"
                    onChange={(event) => setExpenseForm({ ...expenseForm, amount: Number(event.target.value) })}
                  />
                </label>
                <label className="wide">
                  <span>Ghi chú</span>
                  <input
                    type="text"
                    value={expenseForm.note}
                    placeholder="Ví dụ: tiền ăn tuần này"
                    onChange={(event) => setExpenseForm({ ...expenseForm, note: event.target.value })}
                  />
                </label>
                <button type="button" onClick={handleAddExpense}>Lưu chi tiêu</button>
              </div>
            ) : null}

            <div className="income-expense-list">
              {expenses.length ? (
                expenses.map((expense) => {
                  const meta = categoryMeta[expense.category];
                  const Icon = meta.icon;
                  return (
                    <article key={expense.id} className="income-expense-row">
                      <div className={`income-expense-icon ${meta.tone}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <strong>{expense.note || meta.label}</strong>
                        <span>{meta.label}</span>
                      </div>
                      <div className="income-expense-amount">
                        <b>{formatKrw(expense.amount)}</b>
                        <button type="button" onClick={() => onDeleteExpense(expense.id)} aria-label="Xóa chi tiêu">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="income-empty">
                  <ReceiptText size={34} />
                  <strong>Chưa có chi tiêu</strong>
                  <p>Ghi tiền nhà, ăn uống và điện thoại để biết thu nhập ròng chính xác hơn.</p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === 'workplaces' ? (
          <section className="income-workplace-panel">
            <div className="income-section-head">
              <div>
                <p>Nơi làm</p>
                <h2>Xếp theo thu nhập</h2>
              </div>
              <Building2 size={22} />
            </div>
            <div className="income-workplace-list">
              {workplaceInsights.length ? (
                workplaceInsights.map((workplace) => (
                  <article key={workplace.label} className="income-workplace-row">
                    <span className="income-venue-dot" style={{ background: getVenueColor(workplace.label, venueColors) }} />
                    <div>
                      <strong>{workplace.label}</strong>
                      <small>{workplace.count} ca • {workplace.hours.toFixed(1)}h • {workplace.share.toFixed(0)}%</small>
                      <div className="income-workplace-track">
                        <span style={{ width: `${Math.min(workplace.share, 100)}%`, background: getVenueColor(workplace.label, venueColors) }} />
                      </div>
                    </div>
                    <p>
                      <b>{formatKrw(workplace.total)}</b>
                      <span>{formatKrw(workplace.hourly)}/h</span>
                    </p>
                  </article>
                ))
              ) : (
                <div className="income-empty">
                  <Building2 size={34} />
                  <strong>Chưa có nơi làm</strong>
                  <p>Thêm ca làm trong lịch để app tự tổng hợp theo từng nơi.</p>
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
