import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatKrw, calculateShiftPay } from '../lib/salary';
import { RateState, Shift, VenueColors } from '../lib/types';
import { formatDateChip, getVenueColor } from '../utils/helpers';
import { FinanceMetric } from './shared/ui';

export function HomeScreen({
  monthlyTotal,
  monthlyHours,
  averageHourly,
  rate,
  workplaces,
  recentShifts,
  venueColors,
  onRefresh,
  onOpenAdd,
  currentMonth,
  onPrevMonth,
  onNextMonth
}: {
  monthlyTotal: number;
  monthlyHours: number;
  averageHourly: number;
  rate: RateState;
  workplaces: Array<{ label: string; total: number; count: number; hours: number }>;
  recentShifts: Shift[];
  venueColors: VenueColors;
  onRefresh: () => void;
  onOpenAdd: () => void;
  currentMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const monthNumber = new Date(`${currentMonth}T00:00:00`).getMonth() + 1;

  return (
    <>
      <header className="appbar">
        <div>
          <p className="appbar-kicker">Duhoc Mate</p>
        </div>
      </header>

      <section className="hero-balance-card">
        <div className="hero-topline">
          <div>
            <p>Thu nhập tháng này</p>
            <h2>{formatKrw(monthlyTotal)}</h2>
          </div>
          
          <div className="month-navigator">
            <button type="button" onClick={onPrevMonth} className="nav-btn">
              <ChevronLeft size={18} />
            </button>
            <span className="month-display">{monthNumber}</span>
            <button type="button" onClick={onNextMonth} className="nav-btn">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="hero-metrics">
          <FinanceMetric label="Số giờ" value={`${monthlyHours.toFixed(1)}h`} />
          <FinanceMetric label="Mức / giờ" value={formatKrw(averageHourly)} />
          <FinanceMetric label="Tỷ giá" value={rate.source === 'live' ? `${rate.value.toFixed(2)} VND` : 'Dùng cache'} />
        </div>

        <button type="button" className="primary-cta" onClick={onOpenAdd}>
          <Plus size={18} />
          Thêm ca
        </button>
      </section>

      <style>{`
        .month-navigator {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.2);
          padding: 6px 12px;
          border-radius: 99px;
          backdrop-filter: blur(8px);
        }
        .nav-btn {
          background: transparent;
          border: none;
          color: white;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0.8;
        }
        .nav-btn:active {
          opacity: 1;
          transform: scale(0.9);
        }
        .month-display {
          font-weight: 800;
          font-size: 18px;
          color: white;
          min-width: 20px;
          text-align: center;
        }
      `}</style>

      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">Ca làm tiếp theo</p>
            <h3>Sắp tới bạn có lịch</h3>
          </div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '24px', margin: '0', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>MAI</span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>27</span>
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: '15px' }}>Quán Cafe Hollys</strong>
            <span style={{ fontSize: '13px', color: '#64748b' }}>18:00 - 22:00 (4h)</span>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '12px', background: '#dcfce7', color: '#166534', fontSize: '12px', fontWeight: 700 }}>
            +44k ₩
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">Bảng xếp hạng ẩn danh</p>
            <h3>Top thu nhập khu vực</h3>
          </div>
        </div>
        <div className="surface-card">
          {[
            { name: 'Du học sinh A', school: 'Konkuk', amount: '2,850,000₩', rank: 1 },
            { name: 'Ẩn danh 123', school: 'Sejong', amount: '2,420,000₩', rank: 2 },
            { name: 'Bạn (Hạng 12)', school: 'Kyunghee', amount: formatKrw(monthlyTotal), rank: 12 },
          ].map((item, i) => (
            <div key={i} className="workplace-row" style={{ opacity: item.rank > 3 ? 0.7 : 1 }}>
              <div style={{ width: '24px', fontWeight: 900, color: item.rank === 1 ? '#f59e0b' : '#64748b' }}>{item.rank}</div>
              <div className="workplace-copy">
                <strong>{item.name}</strong>
                <span>{item.school}</span>
              </div>
              <strong style={{ color: '#2752ff' }}>{item.amount}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">Nơi làm tháng này</p>
          </div>
        </div>

        <div className="surface-card">
          {workplaces.length ? workplaces.slice(0, 3).map((workplace) => (
            <div key={workplace.label} className="workplace-row">
              <div className="dot" style={{ background: getVenueColor(workplace.label, venueColors) }} />
              <div className="workplace-copy">
                <strong>{workplace.label}</strong>
                <span>
                  {workplace.count} ca • {workplace.hours.toFixed(1)}h
                </span>
              </div>
              <strong className="workplace-amount">{formatKrw(workplace.total)}</strong>
            </div>
          )) : (
            <div style={{ padding: '10px 0', fontSize: '13px', color: '#94a3b8' }}>Chưa có dữ liệu làm việc</div>
          )}
        </div>
      </section>
    </>
  );
}
