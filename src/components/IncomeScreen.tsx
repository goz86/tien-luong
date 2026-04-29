import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Coins,
  Edit2,
  Home,
  Landmark,
  LineChart,
  Phone,
  PiggyBank,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
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

type IncomeTab = 'overview' | 'expenses' | 'workplaces' | 'investment' | 'analysis';
type IconComponent = LucideIcon;

const incomeTabs: Array<{ id: IncomeTab; label: string; icon: IconComponent }> = [
  { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
  { id: 'expenses', label: 'Chi tiêu', icon: ReceiptText },
  { id: 'workplaces', label: 'Nơi làm', icon: Building2 },
  { id: 'investment', label: 'Đầu tư', icon: LineChart },
  { id: 'analysis', label: 'Kiểm tra', icon: ShieldCheck },
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

  const analysis = useMemo(() => {
    const underMinimum = shifts.filter((shift) => shift.hourlyWage < minimumWage);
    const nightShifts = shifts.filter((shift) => shift.nightShift);
    const holidayPay = shifts.reduce((sum, shift) => sum + (shift.holidayAllowance ?? 0), 0);
    const taxTotal = shifts.reduce((sum, shift) => sum + calculateShiftPay(shift).taxAmount, 0);

    return { underMinimum, nightShifts, holidayPay, taxTotal };
  }, [minimumWage, shifts]);

  const investmentPlan = useMemo(() => {
    const monthlyCapacity = Math.max(Math.floor(netBalance * 0.18), 0);
    const reserveTarget = Math.max(Math.floor(target * 0.35), 500000);
    const emergencyFund = Math.min(Math.max(netBalance, 0), reserveTarget);
    const positions = [
      {
        symbol: 'SAFE',
        name: 'Quỹ dự phòng KRW',
        kind: 'Tiền mặt',
        invested: emergencyFund,
        value: emergencyFund,
        change: 0,
        note: 'Ưu tiên trước mọi khoản đầu tư rủi ro',
      },
      {
        symbol: 'ETF',
        name: 'ETF chỉ số toàn cầu',
        kind: 'Theo dõi',
        invested: 250000,
        value: 267500,
        change: 7,
        note: 'Phù hợp tích lũy nhỏ, đều theo tháng',
      },
      {
        symbol: '005930',
        name: 'Samsung Electronics',
        kind: 'Cổ phiếu Hàn',
        invested: 180000,
        value: 171000,
        change: -5,
        note: 'Theo dõi biến động, không dùng tiền sinh hoạt',
      },
    ];
    const invested = positions.reduce((sum, item) => sum + item.invested, 0);
    const value = positions.reduce((sum, item) => sum + item.value, 0);
    const gain = value - invested;

    return { monthlyCapacity, reserveTarget, positions, invested, value, gain };
  }, [netBalance, target]);

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
            <strong>-{formatKrw(totalExpenses)}</strong>
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
                  <p>Nhịp làm việc</p>
                  <h2>Thu theo ngày trong tuần</h2>
                </div>
                <TrendingUp size={22} />
              </div>
              <div className="income-week-bars">
                {weekdayTotals.map((value, index) => (
                  <div key={weekdayLabels[index]} className={index === strongestDay && value > 0 ? 'hot' : ''}>
                    <span style={{ height: `${Math.max(10, (value / maxWeekdayTotal) * 92)}px` }} />
                    <small>{weekdayLabels[index]}</small>
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
                <span>Số ca</span>
                <strong>{shifts.length} ca</strong>
              </article>
              <article>
                <PiggyBank size={20} />
                <span>Tỷ giá KRW/VND</span>
                <strong>{rate.value.toFixed(1)}</strong>
              </article>
              <article>
                <Sparkles size={20} />
                <span>Ngày mạnh nhất</span>
                <strong>{weekdayLabels[strongestDay]}</strong>
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
                        <b>-{formatKrw(expense.amount)}</b>
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

        {activeTab === 'investment' ? (
          <section className="income-invest-panel">
            <div className="income-section-head">
              <div>
                <p>Kỷ luật tài chính</p>
                <h2>Đầu tư sau khi đã rõ dòng tiền</h2>
              </div>
              <Landmark size={22} />
            </div>

            <div className="income-invest-summary">
              <article>
                <span>Giá trị theo dõi</span>
                <strong>{formatKrw(investmentPlan.value)}</strong>
              </article>
              <article className={investmentPlan.gain >= 0 ? 'positive' : 'negative'}>
                <span>Lãi/lỗ tạm tính</span>
                <strong>{formatKrw(investmentPlan.gain)}</strong>
              </article>
              <article>
                <span>Có thể tích lũy/tháng</span>
                <strong>{formatKrw(investmentPlan.monthlyCapacity)}</strong>
              </article>
            </div>

            <div className="income-invest-guideline">
              <ShieldCheck size={18} />
              <p>Ưu tiên quỹ dự phòng khoảng {formatKrw(investmentPlan.reserveTarget)} trước khi mua tài sản rủi ro. Không dùng tiền học phí, tiền nhà hoặc tiền sinh hoạt để đầu tư.</p>
            </div>

            <div className="income-invest-list">
              {investmentPlan.positions.map((position) => (
                <article key={position.symbol} className="income-invest-row">
                  <div className="income-invest-symbol">{position.symbol}</div>
                  <div>
                    <strong>{position.name}</strong>
                    <span>{position.kind} • {position.note}</span>
                    <div className="income-invest-track">
                      <span style={{ width: `${Math.min((position.value / Math.max(investmentPlan.value, 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                  <p>
                    <b>{formatKrw(position.value)}</b>
                    <small className={position.change >= 0 ? 'positive' : 'negative'}>{formatPercent(position.change)}</small>
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'analysis' ? (
          <section className="income-analysis-panel">
            <article className={analysis.underMinimum.length ? 'income-alert-card warning' : 'income-alert-card success'}>
              {analysis.underMinimum.length ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}
              <div>
                <strong>{analysis.underMinimum.length ? 'Có ca dưới lương tối thiểu' : 'Lương giờ đang ổn'}</strong>
                <p>
                  {analysis.underMinimum.length
                    ? `${analysis.underMinimum.length} ca thấp hơn ${formatKrw(minimumWage)}/h. Nên kiểm tra lại hợp đồng, break time và cách tính phụ cấp.`
                    : `Không có ca nào thấp hơn ${formatKrw(minimumWage)}/h trong tháng này.`}
                </p>
              </div>
              <ChevronRight size={20} />
            </article>

            <div className="income-analysis-grid">
              <article>
                <span>Ca đêm</span>
                <strong>{analysis.nightShifts.length}</strong>
                <p>Ca có tick phụ cấp</p>
              </article>
              <article>
                <span>Phụ cấp lễ</span>
                <strong>{formatKrw(analysis.holidayPay)}</strong>
                <p>Tổng phụ cấp đã nhập</p>
              </article>
              <article>
                <span>Thuế 3.3%</span>
                <strong>{formatKrw(analysis.taxTotal)}</strong>
                <p>Ước tính đã trừ</p>
              </article>
              <article>
                <span>Tỷ giá</span>
                <strong>{rate.source === 'live' ? 'Live' : 'Cache'}</strong>
                <p>{rate.value.toFixed(2)} VND/KRW</p>
              </article>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
