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
type ChartViewMode = 'day' | 'week' | 'month';
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

function dateToIso(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function currentWeekRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const mondayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayIndex);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    startIso: dateToIso(start),
    endIso: dateToIso(end),
  };
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function IncomeScreen({
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
    netIncome: '월 순수입',
    grossIncome: '총 급여',
    expenses: '지출',
    totalHours: '총 시간',
    monthlyGoal: '월 목표',
    saveGoal: '목표 저장',
    editGoal: '목표 수정',
    needMore: (value: string) => `목표까지 ${value} 남았습니다.`,
    goalDone: '이번 달 목표를 달성했습니다.',
    incomeTabs: '수입 메뉴',
    weeklyRhythm: '이번 주 근무 흐름',
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
    netIncome: 'Thu nhập ròng / tháng',
    grossIncome: 'Tổng lương',
    expenses: 'Chi tiêu',
    totalHours: 'Tổng giờ',
    monthlyGoal: 'Mục tiêu tháng',
    saveGoal: 'Lưu mục tiêu',
    editGoal: 'Sửa mục tiêu',
    needMore: (value: string) => `Cần ${value} để đạt mục tiêu.`,
    goalDone: 'Bạn đã vượt mục tiêu tháng này.',
    incomeTabs: 'Mục thu nhập',
    weeklyRhythm: 'Nhịp làm việc tuần này',
    weeklyIncome: 'Thu nhập theo ngày trong tuần',
    monthOverview: 'Tổng quan tháng',
    monthIncome: (days: number) => `Thu nhập ${days} ngày`,
    prevMonth: 'Tháng trước',
    nextMonth: 'Tháng sau',
    avgHourly: 'Lương TB/giờ',
    shiftCount: 'Số ca làm',
    bestHours: 'Kỷ lục giờ làm',
    bestDay: 'Ngày làm nhiều nhất',
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
  const [chartView, setChartView] = useState<ChartViewMode>('day');
  const [showCelebration, setShowCelebration] = useState(false);
  const [expenseForm, setExpenseForm] = useState<Omit<Expense, 'id'>>({
    category: 'food',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const prevTotalRef = useRef<number | null>(null);

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

  const selectedMonthKey = chartMonth.slice(0, 7);
  const chartMonthDate = useMemo(() => new Date(`${chartMonth}T00:00:00`), [chartMonth]);
  const chartMonthNumber = chartMonthDate.getMonth() + 1;
  const chartMonthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(chartMonthDate);
  const chartDaysInMonth = new Date(chartMonthDate.getFullYear(), chartMonthDate.getMonth() + 1, 0).getDate();

  const todayNow = new Date();
  const todayMonthKey = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentViewMonth = selectedMonthKey === todayMonthKey;
  const todayDayNumber = todayNow.getDate();

  const monthShifts = useMemo(
    () => shifts.filter((shift) => shift.date.startsWith(selectedMonthKey)),
    [selectedMonthKey, shifts]
  );

  const monthExpenses = useMemo(
    () => expenses.filter((expense) => expense.date.startsWith(selectedMonthKey)),
    [expenses, selectedMonthKey]
  );

  const monthlyTotal = useMemo(
    () => monthShifts.reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0),
    [monthShifts]
  );

  const monthlyHours = useMemo(
    () => monthShifts.reduce((sum, shift) => sum + calculateShiftPay(shift).hours, 0),
    [monthShifts]
  );

  const averageHourly = monthlyHours ? monthlyTotal / monthlyHours : 0;

  const workplaces = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number; hours: number }>();
    monthShifts.forEach((shift) => {
      const current = map.get(shift.label) ?? { label: shift.label, total: 0, count: 0, hours: 0 };
      const pay = calculateShiftPay(shift);
      map.set(shift.label, {
        label: shift.label,
        total: current.total + pay.total,
        count: current.count + 1,
        hours: current.hours + pay.hours,
      });
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [monthShifts]);

  const weekRange = useMemo(currentWeekRange, []);
  const currentWeekShifts = useMemo(
    () => shifts.filter((shift) => shift.date >= weekRange.startIso && shift.date <= weekRange.endIso),
    [shifts, weekRange.endIso, weekRange.startIso]
  );

  const weekdayTotals = useMemo(
    () =>
      weekdayLabels.map((_, index) =>
        currentWeekShifts
          .filter((shift) => {
            const day = new Date(`${shift.date}T00:00:00`).getDay();
            return (day + 6) % 7 === index;
          })
          .reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0)
      ),
    [currentWeekShifts]
  );

  const totalExpenses = useMemo(() => monthExpenses.reduce((sum, expense) => sum + expense.amount, 0), [monthExpenses]);
  const netBalance = monthlyTotal - totalExpenses;
  const maxWeekdayTotal = Math.max(...weekdayTotals, 1);
  const strongestDay = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const progressPercentage = Math.min((monthlyTotal / (target || 1)) * 100, 100);
  const progressColor = progressPercentage >= 100 ? '#0d9b72' : progressPercentage >= 55 ? '#f59e0b' : '#ff6b7a';
  const missingTarget = Math.max(target - monthlyTotal, 0);
  const monthLabel = chartMonthTitle;

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
    monthShifts.forEach((s) => {
      const current = map.get(s.date) || { total: 0, hours: 0 };
      const pay = calculateShiftPay(s);
      map.set(s.date, { total: current.total + pay.total, hours: current.hours + pay.hours });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [monthShifts]);

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
    monthShifts.forEach(s => {
      const d = new Date(`${s.date}T00:00:00`).getDate();
      if (d >= 1 && d <= chartDaysInMonth) {
        results[d - 1] += calculateShiftPay(s).total;
      }
    });
    return results;
  }, [chartDaysInMonth, monthShifts]);

  const maxMonthlyDay = Math.max(...monthlyChartData, 1);

  // ── 6-month grouped chart ──────────────────────────────────────────────
  const sixMonthsData = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(chartMonthDate.getFullYear(), chartMonthDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = shifts
        .filter(s => s.date.startsWith(key))
        .reduce((sum, s) => sum + calculateShiftPay(s).total, 0);
      result.push({ total, label: isKo ? `${d.getMonth() + 1}월` : `Th${d.getMonth() + 1}`, isCurrent: i === 0 });
    }
    return result;
  }, [chartMonthDate, shifts, isKo]);

  // ── 6-week grouped chart ───────────────────────────────────────────────
  const sixWeeksData = useMemo(() => {
    const result = [];
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
    for (let i = 5; i >= 0; i--) {
      const start = new Date(monday);
      start.setDate(monday.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startStr = dateToIso(start);
      const endStr   = dateToIso(end);
      const total = shifts
        .filter(s => s.date >= startStr && s.date <= endStr)
        .reduce((sum, s) => sum + calculateShiftPay(s).total, 0);
      result.push({ total, label: `${start.getDate()}/${start.getMonth() + 1}`, isCurrent: i === 0 });
    }
    return result;
  }, [shifts]);

  const maxGrouped = useMemo(() => {
    const src = chartView === 'month' ? sixMonthsData : sixWeeksData;
    return Math.max(...src.map(d => d.total), 1);
  }, [chartView, sixMonthsData, sixWeeksData]);

  // Compact money label for bars
  const fmtBar = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000)     return `${Math.round(val / 1000)}K`;
    return val > 0 ? val.toString() : '';
  };

  useEffect(() => {
    if (prevTotalRef.current !== null && monthlyTotal >= target && prevTotalRef.current < target && target > 0) {
      confetti({
        particleCount: 200,
        spread: 90,
        origin: { y: 0.55 },
        colors: ['#2752ff', '#0d9b72', '#ff6b7a', '#f59e0b', '#a855f7'],
      });
      setTimeout(() => confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors: ['#fbbf24', '#34d399', '#60a5fa'],
      }), 250);
      setTimeout(() => confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors: ['#f472b6', '#a78bfa', '#fb923c'],
      }), 400);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5000);
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
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={tempTarget ? Number(tempTarget).toLocaleString('en-US') : ''} 
                  onChange={(event) => {
                    const val = event.target.value.replace(/\D/g, '');
                    setTempTarget(val);
                  }} 
                  autoFocus 
                />
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

        {missingTarget > 0 ? (
          <p>{ui.needMore(formatMoney(missingTarget))}</p>
        ) : (
          <div className={`income-goal-achieved${showCelebration ? ' burst' : ''}`}>
            <div className="iga-particles" aria-hidden="true">
              {['🎉','⭐','✨','🎊','💫','🌟','🎈','🏆'].map((e, i) => (
                <span key={i} className={`iga-p iga-p${i}`}>{e}</span>
              ))}
            </div>
            <span>{ui.goalDone}</span>
          </div>
        )}
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
                  <h2>
                    {chartView === 'day'
                      ? ui.monthIncome(chartDaysInMonth)
                      : chartView === 'week'
                      ? (isKo ? '주간 수입 흐름' : 'Thu nhập theo tuần')
                      : (isKo ? '월별 수입 흐름' : 'Thu nhập theo tháng')}
                  </h2>
                  {/* Always rendered — visibility:hidden keeps header height stable when not in day mode */}
                  <span className={`income-month-caption${chartView !== 'day' ? ' income-month-caption--ghost' : ''}`}>
                    {chartMonthTitle}
                  </span>
                </div>
                {/* Always rendered — keeps section-head height same across all views */}
                <div
                  className={`income-month-switcher${chartView !== 'day' ? ' income-month-switcher--ghost' : ''}`}
                  aria-label={isKo ? '차트 월 선택' : 'Chọn tháng biểu đồ'}
                  aria-hidden={chartView !== 'day'}
                >
                  <button type="button" onClick={() => setChartMonth((value) => shiftMonth(value, -1))} aria-label={ui.prevMonth} tabIndex={chartView !== 'day' ? -1 : 0}>
                    <ChevronLeft size={17} />
                  </button>
                  <strong>{chartMonthNumber}</strong>
                  <button type="button" onClick={() => setChartMonth((value) => shiftMonth(value, 1))} aria-label={ui.nextMonth} tabIndex={chartView !== 'day' ? -1 : 0}>
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>

              {/* ── Bar chart area — fixed height wrapper prevents layout jump ── */}
              <div className="income-chart-area">
                {chartView === 'day' ? (
                  <div className="income-day-view">
                    <div className="income-month-bars">
                      {monthlyChartData.map((value, idx) => {
                        const day = idx + 1;
                        const isToday = isCurrentViewMonth && day === todayDayNumber;
                        const isTop = value === maxMonthlyDay && value > 0;
                        const weekBand = Math.floor(idx / 7) % 2 === 1 ? 'week-odd' : '';
                        const cls = [isTop && !isToday ? 'top-day' : '', isToday ? 'today-day' : '', weekBand].filter(Boolean).join(' ');
                        return (
                          <div key={idx} className={cls || undefined}>
                            <span style={{ height: `${Math.max(2, (value / maxMonthlyDay) * 72)}px` }} />
                          </div>
                        );
                      })}
                    </div>
                    {/* Day milestone markers */}
                    <div className="income-day-ticks">
                      {monthlyChartData.map((_, idx) => {
                        const day = idx + 1;
                        const isMilestone = [5, 10, 15, 20, 25, 30].includes(day);
                        const isToday = isCurrentViewMonth && day === todayDayNumber;
                        const cls = [isMilestone ? 'tick-show' : '', isToday ? 'tick-today' : ''].filter(Boolean).join(' ');
                        return (
                          <span key={idx} className={cls || undefined}>
                            {isMilestone ? day : ''}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="income-grouped-bars">
                    {(chartView === 'month' ? sixMonthsData : sixWeeksData).map((item, idx) => (
                      <div key={idx} className={`igb-col${item.isCurrent ? ' current' : ''}`}>
                        <span className="igb-value">{fmtBar(item.total)}</span>
                        <div className="igb-bar-wrap">
                          <div
                            className="igb-bar-fill"
                            style={{ height: `${Math.max(4, (item.total / maxGrouped) * 74)}px` }}
                          />
                        </div>
                        {/* Fixed-height bottom area keeps ALL columns same total height */}
                        <div className="igb-bottom">
                          <span className="igb-label">{item.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── View switcher tabs ── */}
              <div className="income-chart-view-tabs">
                {(['month', 'week', 'day'] as ChartViewMode[]).map(v => (
                  <button
                    key={v}
                    type="button"
                    className={chartView === v ? 'active' : ''}
                    onClick={() => setChartView(v)}
                  >
                    {v === 'month' ? (isKo ? '월별' : 'Tháng') : v === 'week' ? (isKo ? '주별' : 'Tuần') : (isKo ? '일별' : 'Ngày')}
                  </button>
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
                <strong>{monthShifts.length} {ui.shifts}</strong>
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
                    type="text"
                    inputMode="numeric"
                    value={expenseForm.amount ? expenseForm.amount.toLocaleString('en-US') : ''}
                    placeholder="0"
                    onChange={(event) => {
                      const val = event.target.value.replace(/\D/g, '');
                      setExpenseForm({ ...expenseForm, amount: val ? Number(val) : 0 });
                    }}
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
              {monthExpenses.length ? (
                monthExpenses.map((expense) => {
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
