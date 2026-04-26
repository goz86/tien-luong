import { useState, useEffect, useRef } from 'react';
import { WalletCards, Edit2, Check, Plus, Trash2, Home, Phone, Utensils, ReceiptText } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatKrw, calculateShiftPay } from '../lib/salary';
import { RateState, Shift, VenueColors, Expense } from '../lib/types';
import { getVenueColor } from '../utils/helpers';

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
  onSetTarget
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
  const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const weekdayTotals = weekdayLabels.map((_, index) =>
    shifts
      .filter((shift) => {
        const day = new Date(`${shift.date}T00:00:00`).getDay();
        return (day + 6) % 7 === index;
      })
      .reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0)
  );
  const maxWeekdayTotal = Math.max(...weekdayTotals, 1);
  const strongestDay = weekdayTotals.indexOf(Math.max(...weekdayTotals));

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(target.toString());
  const prevTotalRef = useRef(monthlyTotal);

  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState<Omit<Expense, 'id'>>({
    category: 'food',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    note: ''
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netBalance = monthlyTotal - totalExpenses;

  useEffect(() => {
    if (monthlyTotal >= target && prevTotalRef.current < target && target > 0) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#2752ff', '#0d9b72', '#ff6b7a', '#f59e0b']
      });
    }
    prevTotalRef.current = monthlyTotal;
  }, [monthlyTotal, target]);

  function handleSaveTarget() {
    const val = Number(tempTarget);
    if (!isNaN(val) && val > 0) {
      onSetTarget(val);
    }
    setIsEditingTarget(false);
  }

  function handleAddExpense() {
    if (expenseForm.amount <= 0) return;
    onAddExpense(expenseForm);
    setExpenseForm({
      category: 'food',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      note: ''
    });
    setIsAddingExpense(false);
  }

  const getCategoryIcon = (cat: Expense['category']) => {
    switch (cat) {
      case 'rent': return <Home size={16} />;
      case 'phone': return <Phone size={16} />;
      case 'food': return <Utensils size={16} />;
      default: return <ReceiptText size={16} />;
    }
  };

  const getCategoryLabel = (cat: Expense['category']) => {
    switch (cat) {
      case 'rent': return 'Tiền nhà';
      case 'phone': return 'Điện thoại';
      case 'food': return 'Ăn uống';
      default: return 'Chi phí khác';
    }
  };

  const progressPercentage = Math.min((monthlyTotal / (target || 1)) * 100, 100);
  const progressColor = progressPercentage >= 100 ? '#0d9b72' : progressPercentage >= 50 ? '#f59e0b' : '#ff6b7a';

  return (
    <>
      <header className="appbar compact">
        <div>
          <p className="appbar-kicker">Bảng thu nhập</p>
          <h1 className="appbar-title">Tổng quan tài chính</h1>
        </div>
      </header>

      <section className="balance-hero-container" style={{ margin: '0 16px 24px' }}>
        <div style={{ background: 'linear-gradient(135deg, #2752ff, #7357ff)', padding: '24px', borderRadius: '28px', color: 'white', boxShadow: '0 20px 40px rgba(39, 82, 255, 0.2)' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase' }}>Số dư thực tế còn lại</span>
          <h2 style={{ fontSize: '32px', fontWeight: 900, margin: '8px 0', letterSpacing: '-0.02em' }}>{formatKrw(netBalance)}</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Tổng thu nhập</span>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>{formatKrw(monthlyTotal)}</div>
            </div>
            <div>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Tổng chi tiêu</span>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>-{formatKrw(totalExpenses)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="target-card" style={{ background: '#fff', padding: '20px', borderRadius: '24px', margin: '0 16px 24px', boxShadow: '0 10px 30px rgba(8, 22, 43, 0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#657080', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mục tiêu tháng</span>
            {isEditingTarget ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="number" 
                  value={tempTarget} 
                  onChange={(e) => setTempTarget(e.target.value)} 
                  style={{ background: '#f5f7fa', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '16px', fontWeight: 800, width: '120px', color: '#08162b' }}
                  autoFocus
                />
                <button type="button" onClick={handleSaveTarget} style={{ background: '#2752ff', color: '#fff', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <strong style={{ fontSize: '20px', fontWeight: 800, color: '#08162b' }}>{formatKrw(target)}</strong>
                <button type="button" onClick={() => setIsEditingTarget(true)} style={{ background: 'transparent', border: 'none', color: '#a0aab8', padding: '4px' }}>
                  <Edit2 size={16} />
                </button>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#657080' }}>Đã đạt</span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: progressColor }}>{progressPercentage.toFixed(0)}%</div>
          </div>
        </div>
        
        <div style={{ width: '100%', height: '12px', background: '#f0f3f7', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${progressPercentage}%`, 
            background: progressColor, 
            borderRadius: '99px',
            transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: `0 0 10px ${progressColor}60`
          }} />
        </div>
      </section>

      <section className="section-block">
        <div className="section-head" style={{ padding: '0 16px' }}>
          <div>
            <p className="section-kicker">Quản lý chi tiêu</p>
            <h3>Chi phí hàng tháng</h3>
          </div>
          <button type="button" onClick={() => setIsAddingExpense(true)} className="icon-circle" style={{ background: '#f0f3f7', color: '#08162b' }}>
            <Plus size={20} />
          </button>
        </div>

        {isAddingExpense && (
          <div style={{ margin: '0 16px 16px', padding: '16px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <select 
                value={expenseForm.category} 
                onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value as any})}
                style={{ width: '100%', height: '44px', padding: '0 12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              >
                <option value="food">Ăn uống</option>
                <option value="rent">Tiền nhà</option>
                <option value="phone">Điện thoại</option>
                <option value="other">Khác</option>
              </select>
              <input 
                type="number" 
                placeholder="Số tiền" 
                value={expenseForm.amount || ''}
                onChange={(e) => setExpenseForm({...expenseForm, amount: Number(e.target.value)})}
                style={{ width: '100%', height: '44px', padding: '0 12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <input 
              type="text" 
              placeholder="Ghi chú (Ví dụ: Tiền phòng tháng 4)" 
              value={expenseForm.note}
              onChange={(e) => setExpenseForm({...expenseForm, note: e.target.value})}
              style={{ width: '100%', height: '44px', padding: '0 12px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsAddingExpense(false)} style={{ flex: 1, height: '44px', borderRadius: '12px', background: '#e2e8f0', color: '#475569', border: 'none', fontWeight: 700 }}>Huỷ</button>
              <button type="button" onClick={handleAddExpense} style={{ flex: 1, height: '44px', borderRadius: '12px', background: '#2752ff', color: 'white', border: 'none', fontWeight: 700 }}>Lưu chi phí</button>
            </div>
          </div>
        )}

        <div className="surface-card" style={{ margin: '0 16px' }}>
          {expenses.length ? (
            expenses.map((expense) => (
              <div key={expense.id} className="workplace-row" style={{ padding: '14px 0' }}>
                <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  {getCategoryIcon(expense.category)}
                </div>
                <div className="workplace-copy" style={{ marginLeft: '12px' }}>
                  <strong>{expense.note || getCategoryLabel(expense.category)}</strong>
                  <span>{getCategoryLabel(expense.category)}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ display: 'block', color: '#e11d48' }}>-{formatKrw(expense.amount)}</strong>
                  <button type="button" onClick={() => onDeleteExpense(expense.id)} style={{ border: 'none', background: 'transparent', color: '#cbd5e1', padding: '4px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ padding: '20px' }}>
              <ReceiptText size={20} />
              <div>
                <strong>Chưa có chi tiêu nào</strong>
                <p>Nhập chi phí cố định để tính số dư thực tế.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section-block">
        <div className="section-head" style={{ padding: '0 16px' }}>
          <div>
            <p className="section-kicker">Biểu đồ thu nhập</p>
            <h3>Tần suất làm việc</h3>
          </div>
        </div>
        <div className="income-chart-card" style={{ margin: '0 16px' }}>
          <div className="income-chart-head">
            <div>
              <span>Tháng này</span>
              <strong>{formatKrw(monthlyTotal)}</strong>
            </div>
            <small>{monthlyHours > 0 ? '+12%' : '0%'}</small>
          </div>
          <svg className="income-sparkline" viewBox="0 0 120 38" aria-hidden="true">
            <polyline points="3,28 22,22 40,25 58,14 76,19 96,8 117,15" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="income-bars">
            {weekdayTotals.map((value, index) => (
              <div key={weekdayLabels[index]} className="income-bar-item">
                <span className={index === strongestDay && value > 0 ? 'income-bar hot' : 'income-bar'} style={{ height: `${Math.max(18, (value / maxWeekdayTotal) * 72)}px` }} />
                <small>{weekdayLabels[index]}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stats-grid" style={{ margin: '0 16px' }}>
        <article className="info-card accent-blue">
          <span>Tổng tháng</span>
          <strong>{formatKrw(monthlyTotal)}</strong>
        </article>
        <article className="info-card accent-green">
          <span>Tổng giờ</span>
          <strong>{monthlyHours.toFixed(1)}h</strong>
        </article>
        <article className="info-card accent-sky">
          <span>Trung bình / giờ</span>
          <strong>{formatKrw(averageHourly)}</strong>
        </article>
        <article className="info-card accent-plain">
          <span>KRW sang VND</span>
          <strong>{rate.source === 'live' ? `${rate.value.toFixed(2)} VND` : 'Đang dùng cache'}</strong>
        </article>
      </section>
    </>
  );
}
