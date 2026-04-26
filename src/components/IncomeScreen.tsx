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
      <header className="appbar compact" style={{ padding: '20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.04em', margin: 0 }}>Duhoc Mate<span style={{ color: '#2752ff' }}>.</span></h1>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-soft)', marginTop: '4px' }}>Tổng quan tài chính</p>
        </div>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-soft)' }}>
          <WalletCards size={20} color="#2752ff" />
        </div>
      </header>

      <section className="balance-hero-container" style={{ margin: '0 16px 28px' }}>
        <div style={{ 
          background: 'linear-gradient(145deg, #2752ff, #6366f1)', 
          padding: '28px', 
          borderRadius: '32px', 
          color: 'white', 
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(39, 82, 255, 0.35)' 
        }}>
          {/* Decorative glass circles */}
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(20px)' }} />
          <div style={{ position: 'absolute', bottom: '-10px', left: '-10px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(15px)' }} />

          <span style={{ fontSize: '13px', fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '1px' }}>Số dư khả dụng</span>
          <h2 style={{ fontSize: '36px', fontWeight: 900, margin: '10px 0', letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {formatKrw(netBalance)}
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', opacity: 0.75, fontWeight: 500 }}>Thu nhập</span>
              <div style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.01em' }}>{formatKrw(monthlyTotal)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', opacity: 0.75, fontWeight: 500 }}>Chi tiêu</span>
              <div style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.01em' }}>-{formatKrw(totalExpenses)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="target-card" style={{ background: '#fff', padding: '24px', borderRadius: '32px', margin: '0 16px 28px', boxShadow: '0 12px 40px rgba(8, 22, 43, 0.03)', border: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Mục tiêu tháng</span>
            {isEditingTarget ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <input 
                  type="number" 
                  value={tempTarget} 
                  onChange={(e) => setTempTarget(e.target.value)} 
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 16px', fontSize: '18px', fontWeight: 800, width: '140px', color: '#08162b', fontFeatureSettings: '"tnum"' }}
                  autoFocus
                />
                <button type="button" onClick={handleSaveTarget} style={{ background: '#2752ff', color: '#fff', border: 'none', borderRadius: '12px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(39, 82, 255, 0.3)' }}>
                  <Check size={20} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <strong style={{ fontSize: '24px', fontWeight: 900, color: '#08162b', fontFeatureSettings: '"tnum"', letterSpacing: '-0.02em' }}>{formatKrw(target)}</strong>
                <button type="button" onClick={() => setIsEditingTarget(true)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#64748b', padding: '6px', display: 'flex', transition: 'all 0.2s' }}>
                  <Edit2 size={14} />
                </button>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Tiến độ</span>
            <div style={{ fontSize: '28px', fontWeight: 900, color: progressColor, fontFeatureSettings: '"tnum"', letterSpacing: '-0.04em' }}>{progressPercentage.toFixed(0)}%</div>
          </div>
        </div>
        <div style={{ width: '100%', height: '14px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', padding: '3px' }}>
          <div style={{ 
            height: '100%', 
            width: `${progressPercentage}%`, 
            background: `linear-gradient(90deg, ${progressColor}, ${progressColor}dd)`, 
            borderRadius: '99px',
            transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: `0 0 12px ${progressColor}40`
          }} />
        </div>
      </section>

      <section className="section-block" style={{ marginBottom: '32px' }}>
        <div className="section-head" style={{ padding: '0 20px', marginBottom: '20px' }}>
          <div>
            <p className="section-kicker" style={{ color: '#2752ff', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Quản lý tài chính</p>
            <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>Chi phí hàng tháng</h3>
          </div>
          <button type="button" onClick={() => setIsAddingExpense(true)} style={{ width: '52px', height: '52px', borderRadius: '18px', background: '#2752ff', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px rgba(39, 82, 255, 0.3)' }}>
            <Plus size={26} />
          </button>
        </div>

        {isAddingExpense && (
          <div style={{ margin: '0 16px 24px', padding: '24px', background: 'white', borderRadius: '32px', boxShadow: '0 20px 40px rgba(8, 22, 43, 0.08)', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Hạng mục</span>
                <select 
                  value={expenseForm.category} 
                  onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value as any})}
                  style={{ width: '100%', height: '52px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}
                >
                  <option value="food">Ăn uống</option>
                  <option value="rent">Tiền nhà</option>
                  <option value="phone">Điện thoại</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Số tiền (₩)</span>
                <input 
                  type="number" 
                  placeholder="0" 
                  value={expenseForm.amount || ''}
                  onChange={(e) => setExpenseForm({...expenseForm, amount: Number(e.target.value)})}
                  style={{ width: '100%', height: '52px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '18px', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Ghi chú</span>
              <input 
                type="text" 
                placeholder="Nhập ghi chú chi tiêu..." 
                value={expenseForm.note}
                onChange={(e) => setExpenseForm({...expenseForm, note: e.target.value})}
                style={{ width: '100%', height: '52px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setIsAddingExpense(false)} style={{ flex: 1, height: '56px', borderRadius: '18px', background: '#f1f5f9', color: '#64748b', border: 'none', fontWeight: 700, fontSize: '15px' }}>Hủy</button>
              <button type="button" onClick={handleAddExpense} style={{ flex: 1, height: '56px', borderRadius: '18px', background: '#2752ff', color: 'white', border: 'none', fontWeight: 700, fontSize: '15px', boxShadow: '0 12px 24px rgba(39, 82, 255, 0.25)' }}>Lưu chi phí</button>
            </div>
          </div>
        )}

        <div className="surface-card" style={{ margin: '0 16px', borderRadius: '32px', padding: '12px 24px', boxShadow: '0 8px 30px rgba(8, 22, 43, 0.02)' }}>
          {expenses.length ? (
            expenses.map((expense) => (
              <div key={expense.id} className="workplace-row" style={{ padding: '20px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ width: '52px', height: '52px', background: '#f1f5f9', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2752ff' }}>
                  {getCategoryIcon(expense.category)}
                </div>
                <div className="workplace-copy" style={{ marginLeft: '16px' }}>
                  <strong style={{ fontSize: '16px', color: '#0f172a', fontWeight: 700 }}>{expense.note || getCategoryLabel(expense.category)}</strong>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginTop: '2px' }}>{getCategoryLabel(expense.category)}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ display: 'block', color: '#e11d48', fontSize: '17px', fontWeight: 900, fontFeatureSettings: '"tnum"', letterSpacing: '-0.02em' }}>-{formatKrw(expense.amount)}</strong>
                  <button type="button" onClick={() => onDeleteExpense(expense.id)} style={{ border: 'none', background: 'transparent', color: '#cbd5e1', padding: '6px', marginTop: '6px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ padding: '50px 20px', textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '24px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#cbd5e1' }}>
                <ReceiptText size={36} />
              </div>
              <strong style={{ display: 'block', fontSize: '17px', color: '#0f172a' }}>Chưa có chi tiêu nào</strong>
              <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '6px', maxWidth: '240px', margin: '6px auto 0', lineHeight: '1.5' }}>Ghi lại các khoản chi phí để theo dõi kế hoạch tài chính hiệu quả hơn.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section-block" style={{ marginBottom: '32px' }}>
        <div className="section-head" style={{ padding: '0 20px', marginBottom: '16px' }}>
          <div>
            <p className="section-kicker" style={{ color: '#2752ff', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Phân tích</p>
            <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>Tần suất làm việc</h3>
          </div>
        </div>
        <div className="income-chart-card" style={{ margin: '0 16px', borderRadius: '32px', padding: '24px', background: 'white', boxShadow: '0 12px 40px rgba(8, 22, 43, 0.03)', border: '1px solid #f1f5f9' }}>
          <div className="income-chart-head" style={{ marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Tháng này</span>
              <strong style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', display: 'block', marginTop: '4px' }}>{formatKrw(monthlyTotal)}</strong>
            </div>
            <div style={{ background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 800 }}>
              {monthlyHours > 0 ? '+12.5%' : '0%'}
            </div>
          </div>
          <svg className="income-sparkline" viewBox="0 0 120 38" aria-hidden="true" style={{ color: '#2752ff', filter: 'drop-shadow(0 8px 12px rgba(39, 82, 255, 0.2))', marginBottom: '24px' }}>
            <polyline points="3,28 22,22 40,25 58,14 76,19 96,8 117,15" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="income-bars" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '100px', gap: '8px' }}>
            {weekdayTotals.map((value, index) => (
              <div key={weekdayLabels[index]} className="income-bar-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div 
                  style={{ 
                    width: '100%', 
                    height: `${Math.max(12, (value / maxWeekdayTotal) * 80)}px`, 
                    background: index === strongestDay && value > 0 ? 'linear-gradient(180deg, #2752ff, #6366f1)' : '#f1f5f9', 
                    borderRadius: '8px',
                    transition: 'all 0.3s ease'
                  }} 
                />
                <small style={{ fontSize: '11px', fontWeight: 700, color: index === strongestDay && value > 0 ? '#2752ff' : '#94a3b8' }}>{weekdayLabels[index]}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stats-grid" style={{ margin: '0 16px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <article className="info-card" style={{ background: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Tổng thu</span>
          <strong style={{ display: 'block', fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>{formatKrw(monthlyTotal)}</strong>
        </article>
        <article className="info-card" style={{ background: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Tổng giờ</span>
          <strong style={{ display: 'block', fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>{monthlyHours.toFixed(1)}h</strong>
        </article>
        <article className="info-card" style={{ background: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Lương TB</span>
          <strong style={{ display: 'block', fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>{formatKrw(averageHourly)}</strong>
        </article>
        <article className="info-card" style={{ background: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Tỷ giá VND</span>
          <strong style={{ display: 'block', fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>{rate.value.toFixed(0)}đ</strong>
        </article>
      </section>
    </>
  );
}
