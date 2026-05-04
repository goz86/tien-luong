import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
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
  Smartphone,
  Bus,
  ShoppingBag,
  HeartPulse,
  Music,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { calculateShiftPay, formatKrw } from '../lib/salary';
import type { Expense, RateState, Shift, VenueColors } from '../lib/types';
import { DateWheelModal } from './shared/DateWheelModal';
import { getVenueColor, shiftMonth } from '../utils/helpers';

type AppLang = 'vi' | 'ko';
type IncomeTab = 'overview' | 'expenses' | 'workplaces';
type IconComponent = LucideIcon;

const incomeTabs: Array<{ id: IncomeTab; icon: IconComponent }> = [
  { id: 'overview', icon: BarChart3 },
  { id: 'expenses', icon: ReceiptText },
  { id: 'workplaces', icon: Building2 },
];

const categoryMeta: Record<Expense['category'], { label: string; icon: any; tone: string }> = {
  rent: { label: 'Tiền nhà', icon: Home, tone: 'blue' },
  phone: { label: 'Điện thoại', icon: Smartphone, tone: 'green' },
  food: { label: 'Ăn uống', icon: Utensils, tone: 'orange' },
  transport: { label: 'Di chuyển', icon: Bus, tone: 'purple' },
  shopping: { label: 'Mua sắm', icon: ShoppingBag, tone: 'pink' },
  health: { label: 'Sức khỏe', icon: HeartPulse, tone: 'red' },
  entertainment: { label: 'Giải trí', icon: Music, tone: 'cyan' },
  other: { label: 'Khác', icon: ReceiptText, tone: 'gray' },
};

const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function currentMonthIso() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`;
}

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
  lang = 'vi',
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
  lang?: AppLang;
}) {
  const isKo = lang === 'ko';
  const locale = isKo ? 'ko-KR' : 'vi-VN';
  const ui = isKo ? {
    tabs: { overview: '요약', expenses: '지출', workplaces: '근무지' },
    netIncome: '이번 달 순수입',
    grossIncome: '총 급여',
    expenses: '지출',
    totalHours: '총 시간',
    monthlyGoal: '월 목표',
    saveGoal: '목표 저장',
    editGoal: '목표 수정',
    needMore: (value: string) => `목표까지 ${value} 남았습니다.`,
    goalDone: '이번 달 목표를 달성했습니다.',
    incomeTabs: '수입 메뉴',
    weeklyRhythm: '주간 근무 흐름',
    weeklyIncome: '요일별 수입',
    monthOverview: '월간 요약',
    monthIncome: (days: number) => `${days}일 수입`,
    prevMonth: '이전 달',
    nextMonth: '다음 달',
    avgHourly: '평균 시급',
    shiftCount: '이번 달 근무 수',
    bestHours: '최대 근무 시간',
    bestDay: '최고 수입일',
    expenseManage: '지출 관리',
    expenseRecords: '기록된 지출',
    addExpense: '지출 추가',
    category: '카테고리',
    amount: '금액',
    expenseDate: '지출일',
    note: '메모',
    notePlaceholder: '예: 이번 주 식비',
    saveExpense: '지출 저장',
    noExpense: '지출 내역이 없습니다',
    noExpenseHint: '월세, 식비, 통신비를 기록하면 순수입을 더 정확히 볼 수 있어요.',
    workplace: '근무지',
    byIncome: '수입순 정렬',
    noWorkplace: '근무지가 없습니다',
    noWorkplaceHint: '캘린더에 근무를 추가하면 근무지별로 자동 집계됩니다.',
    deleteExpense: '지출 삭제',
    shifts: '회',
  } : {
    tabs: { overview: 'Tổng quan', expenses: 'Chi tiêu', workplaces: 'Nơi làm' },
    netIncome: 'Thu nhập ròng tháng này',
    grossIncome: 'Tổng lương',
    expenses: 'Chi tiêu',
    totalHours: 'Tổng giờ',
    monthlyGoal: 'Mục tiêu tháng',
    saveGoal: 'Lưu mục tiêu',
    editGoal: 'Sửa mục tiêu',
    needMore: (value: string) => `Cần ${value} để đạt mục tiêu.`,
    goalDone: 'Bạn đã vượt mục tiêu tháng này.',
    incomeTabs: 'Mục thu nhập',
    weeklyRhythm: 'Nhịp làm việc tuần',
    weeklyIncome: 'Thu theo ngày trong tuần',
    monthOverview: 'Tổng quan tháng',
    monthIncome: (days: number) => `Thu nhập ${days} ngày`,
    prevMonth: 'Tháng trước',
    nextMonth: 'Tháng sau',
    avgHourly: 'Lương TB/giờ',
    shiftCount: 'Số ca tháng',
    bestHours: 'Kỷ lục giờ làm',
    bestDay: 'Ngày bội thu',
    expenseManage: 'Quản lý chi tiêu',
    expenseRecords: 'Khoản đã ghi',
    addExpense: 'Thêm chi tiêu',
    category: 'Hạng mục',
    amount: 'Số tiền',
    expenseDate: 'Ngày chi',
    note: 'Ghi chú',
    notePlaceholder: 'Ví dụ: tiền ăn tuần này',
    saveExpense: 'Lưu chi tiêu',
    noExpense: 'Chưa có chi tiêu',
    noExpenseHint: 'Ghi tiền nhà, ăn uống và điện thoại để biết thu nhập ròng chính xác hơn.',
    workplace: 'Nơi làm',
    byIncome: 'Xếp theo thu nhập',
    noWorkplace: 'Chưa có nơi làm',
    noWorkplaceHint: 'Thêm ca làm trong lịch để app tự tổng hợp theo từng nơi.',
    deleteExpense: 'Xóa chi tiêu',
    shifts: 'ca',
  };
  const categoryLabels: Record<Expense['category'], string> = isKo ? {
    rent: '월세',
    phone: '통신비',
    food: '식비',
    transport: '교통비',
    shopping: '쇼핑',
    health: '건강',
    entertainment: '여가',
    other: '기타',
  } : {
    rent: 'Tiền nhà',
    phone: 'Điện thoại',
    food: 'Ăn uống',
    transport: 'Di chuyển',
    shopping: 'Mua sắm',
    health: 'Sức khỏe',
    entertainment: 'Giải trí',
    other: 'Khác',
  };
  const [activeTab, setActiveTab] = useState<IncomeTab>('overview');
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(target.toString());
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isVnd, setIsVnd] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [activeSelect, setActiveSelect] = useState<string | null>(null);
  const [chartMonth, setChartMonth] = useState(currentMonthIso);
  const [expenseForm, setExpenseForm] = useState<Omit<Expense, 'id'>>({
    category: 'food',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const prevTotalRef = useRef(monthlyTotal);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      if (activeSelect && !target.closest('.income-select-wrap')) {
        setActiveSelect(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeSelect]);

  const formatMoney = (val: number) => {
    if (isVnd) {
      return new Intl.DateTimeFormat(locale).format(new Date()) && `${Math.round(val * rate.value).toLocaleString(locale)}đ`;
    }
    return formatKrw(val);
  };

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
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date());
  const chartMonthDate = useMemo(() => new Date(`${chartMonth}T00:00:00`), [chartMonth]);
  const chartMonthNumber = chartMonthDate.getMonth() + 1;
  const chartMonthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(chartMonthDate);
  const chartDaysInMonth = new Date(chartMonthDate.getFullYear(), chartMonthDate.getMonth() + 1, 0).getDate();

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
      map.set(s.date, { total: current.total + pay.total, hours: current.hours + pay.hours });
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
    const results = Array(chartDaysInMonth).fill(0);
    const selectedMonthKey = chartMonth.slice(0, 7);
    shifts.forEach(s => {
      if (!s.date.startsWith(selectedMonthKey)) return;
      const d = new Date(`${s.date}T00:00:00`).getDate();
      if (d >= 1 && d <= chartDaysInMonth) {
        results[d - 1] += calculateShiftPay(s).total;
      }
    });
    return results;
  }, [chartDaysInMonth, chartMonth, shifts]);

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

      <section className="income-ledger-hero" onClick={() => setIsVnd(!isVnd)} style={{ cursor: 'pointer' }}>
        <div className="income-hero-top">
          <div>
            <span>{ui.netIncome} {isVnd ? '(VND)' : '(KRW)'}</span>
            <h2>{formatMoney(netBalance)}</h2>
          </div>
          <WalletCards size={28} />
        </div>
        <div className="income-hero-metrics">
          <article>
            <span>{ui.grossIncome}</span>
            <strong>{formatMoney(monthlyTotal)}</strong>
          </article>
          <article>
            <span>{ui.expenses}</span>
            <strong>{formatMoney(totalExpenses)}</strong>
          </article>
          <article>
            <span>{ui.totalHours}</span>
            <strong>{monthlyHours.toFixed(1)}h</strong>
          </article>
        </div>
      </section>

      <section className="income-goal-panel">
        <div className="income-goal-head">
          <div>
            <span>{ui.monthlyGoal}</span>
            {isEditingTarget ? (
              <div className="income-target-edit">
                <input type="number" value={tempTarget} onChange={(event) => setTempTarget(event.target.value)} autoFocus />
                <button type="button" onClick={handleSaveTarget} aria-label={ui.saveGoal}>
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <strong>{formatMoney(target)}</strong>
            )}
          </div>
          <button type="button" className="income-edit-button" onClick={() => setIsEditingTarget(true)} aria-label={ui.editGoal}>
            <Edit2 size={16} />
          </button>
        </div>
        <div className="income-progress-track" aria-label={isKo ? `목표의 ${progressPercentage.toFixed(0)}% 달성` : `Đã đạt ${progressPercentage.toFixed(0)}% mục tiêu`}>
          <span style={{ width: `${progressPercentage}%`, background: progressColor }} />
        </div>
        <p>{missingTarget > 0 ? ui.needMore(formatMoney(missingTarget)) : ui.goalDone}</p>
      </section>

      <div className="income-subtabs" role="tablist" aria-label={ui.incomeTabs}>
        {incomeTabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? 'active' : ''}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={16} />
            {ui.tabs[id]}
          </button>
        ))}
      </div>

      <div className="income-tab-body">
        {activeTab === 'overview' ? (
          <>
            <section className="income-chart-panel">
              <div className="income-section-head">
                <div>
                  <p>{ui.weeklyRhythm}</p>
                  <h2>{ui.weeklyIncome}</h2>
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
                  <p>{ui.monthOverview}</p>
                  <h2>{ui.monthIncome(chartDaysInMonth)}</h2>
                  <span className="income-month-caption">{chartMonthTitle}</span>
                </div>
                <div className="income-month-switcher" aria-label={isKo ? '차트 월 선택' : 'Chọn tháng biểu đồ'}>
                  <button type="button" onClick={() => setChartMonth((value) => shiftMonth(value, -1))} aria-label={ui.prevMonth}>
                    <ChevronLeft size={17} />
                  </button>
                  <strong>{chartMonthNumber}</strong>
                  <button type="button" onClick={() => setChartMonth((value) => shiftMonth(value, 1))} aria-label={ui.nextMonth}>
                    <ChevronRight size={17} />
                  </button>
                </div>
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
                <span>{ui.avgHourly}</span>
                <strong>{formatMoney(averageHourly)}</strong>
              </article>
              <article>
                <CalendarDays size={20} />
                <span>{ui.shiftCount}</span>
                <strong>{shifts.length} {ui.shifts}</strong>
              </article>
              <article>
                <Clock size={20} />
                <span>{ui.bestHours}</span>
                <strong>{maxHoursInDay.toFixed(1)}h</strong>
              </article>
              <article className="gold">
                <Trophy size={20} />
                <span>{ui.bestDay}</span>
                <strong>{bestDayData ? new Date(bestDayData[0]).getDate() + '/' + (new Date(bestDayData[0]).getMonth() + 1) : '--'}</strong>
              </article>
            </section>
          </>
        ) : null}

        {activeTab === 'expenses' ? (
          <section className="income-expense-panel">
            <div className="income-section-head">
              <div>
                <p>{ui.expenseManage}</p>
                <h2>{ui.expenseRecords}</h2>
              </div>
              <button type="button" className="income-mini-action" onClick={() => setIsAddingExpense((value) => !value)} aria-label={ui.addExpense}>
                <Plus size={18} />
              </button>
            </div>

            {isAddingExpense ? (
              <div className="income-expense-form">
                <label>
                  <span>{ui.category}</span>
                  <div className="income-select-wrap" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="income-category-trigger"
                      onClick={() => setActiveSelect(activeSelect === 'category' ? null : 'category')}
                    >
                      {categoryLabels[expenseForm.category]}
                      <ChevronDown size={16} className={activeSelect === 'category' ? 'open' : ''} />
                    </button>
                    {activeSelect === 'category' && (
                      <div className="settings-dropdown" style={{ top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 10 }}>
                        {Object.entries(categoryMeta).map(([value]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setExpenseForm({ ...expenseForm, category: value as Expense['category'] });
                              setActiveSelect(null);
                            }}
                          >
                            {categoryLabels[value as Expense['category']]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
                <label>
                  <span>{ui.amount}</span>
                  <input
                    type="number"
                    value={expenseForm.amount || ''}
                    placeholder="0"
                    onChange={(event) => setExpenseForm({ ...expenseForm, amount: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>{ui.expenseDate}</span>
                  <button
                    type="button"
                    className="income-date-trigger"
                    onClick={() => setIsDatePickerOpen(true)}
                  >
                    {new Date(expenseForm.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    <ChevronDown size={16} />
                  </button>
                </label>
                <label className="wide">
                  <span>{ui.note}</span>
                  <input
                    type="text"
                    value={expenseForm.note}
                    placeholder={ui.notePlaceholder}
                    onChange={(event) => setExpenseForm({ ...expenseForm, note: event.target.value })}
                  />
                </label>
                <button type="button" className="income-save-btn" onClick={handleAddExpense}>{ui.saveExpense}</button>
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
                        <strong>{expense.note || categoryLabels[expense.category]}</strong>
                        <span>{categoryLabels[expense.category]} • {new Date(expense.date).getDate()}/{new Date(expense.date).getMonth() + 1}</span>
                      </div>
                      <div className="income-expense-amount">
                        <b>{formatMoney(expense.amount)}</b>
                        <button type="button" onClick={() => onDeleteExpense(expense.id)} aria-label={ui.deleteExpense}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="income-empty">
                  <ReceiptText size={34} />
                  <strong>{ui.noExpense}</strong>
                  <p>{ui.noExpenseHint}</p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === 'workplaces' ? (
          <section className="income-workplace-panel">
            <div className="income-section-head">
              <div>
                <p>{ui.workplace}</p>
                <h2>{ui.byIncome}</h2>
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
                      <small>{workplace.count} {ui.shifts} • {workplace.hours.toFixed(1)}h • {workplace.share.toFixed(0)}%</small>
                      <div className="income-workplace-track">
                        <span style={{ width: `${Math.min(workplace.share, 100)}%`, background: getVenueColor(workplace.label, venueColors) }} />
                      </div>
                    </div>
                    <p>
                      <b>{formatMoney(workplace.total)}</b>
                      <span>{formatMoney(workplace.hourly)}/h</span>
                    </p>
                  </article>
                ))
              ) : (
                <div className="income-empty">
                  <Building2 size={34} />
                  <strong>{ui.noWorkplace}</strong>
                  <p>{ui.noWorkplaceHint}</p>
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
      {isDatePickerOpen && (
        <DateWheelModal
          title={ui.expenseDate}
          initialDate={expenseForm.date}
          onClose={() => setIsDatePickerOpen(false)}
          onConfirm={(date) => {
            setExpenseForm({ ...expenseForm, date });
            setIsDatePickerOpen(false);
          }}
        />
      )}
    </>
  );
}
