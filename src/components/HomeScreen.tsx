import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Edit3, Trash2 } from 'lucide-react';
import { formatKrw, calculateShiftPay, shiftHours } from '../lib/salary';
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
  allShifts,
  venueColors,
  onRefresh,
  onOpenAdd,
  onEditShift,
  onDeleteShift,
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
  allShifts: Shift[];
  venueColors: VenueColors;
  onRefresh: () => void;
  onOpenAdd: () => void;
  onEditShift: (shift: Shift) => void;
  onDeleteShift: (id: string) => void;
  currentMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const [selectedWorkplace, setSelectedWorkplace] = useState<string | null>(null);
  const monthNumber = new Date(`${currentMonth}T00:00:00`).getMonth() + 1;

  const workplaceShifts = allShifts.filter(s => s.label === selectedWorkplace)
    .sort((a, b) => b.date.localeCompare(a.date));

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
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: flex-end;
        }
        .modal-content {
          background: white;
          width: 100%;
          max-height: 85vh;
          border-top-left-radius: 32px;
          border-top-right-radius: 32px;
          padding: 24px;
          overflow-y: auto;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .workplace-history-item {
          display: flex;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .history-actions {
          display: flex;
          gap: 8px;
        }
        .action-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
        }
        .edit-btn { background: #f1f5f9; color: #2752ff; }
        .delete-btn { background: #fff1f2; color: #e11d48; }

        .dark .modal-content {
          background: #0f172a;
          color: white;
        }
        .dark .workplace-history-item {
          border-bottom-color: #1e293b;
        }
        .dark .edit-btn { background: #1e293b; }
      `}</style>

      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">Nơi làm tháng này ({workplaces.length})</p>
          </div>
        </div>

        <div className="surface-card">
          {workplaces.length ? workplaces.map((workplace) => (
            <div 
              key={workplace.label} 
              className="workplace-row" 
              onClick={() => setSelectedWorkplace(workplace.label)}
              style={{ cursor: 'pointer' }}
            >
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
            <div style={{ padding: '20px 0', fontSize: '14px', color: '#94a3b8', textAlign: 'center' }}>Chưa có dữ liệu làm việc</div>
          )}
        </div>
      </section>

      {selectedWorkplace && (
        <div className="modal-overlay" onClick={() => setSelectedWorkplace(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#2752ff', textTransform: 'uppercase' }}>Lịch sử ca làm</p>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>{selectedWorkplace}</h3>
              </div>
              <button onClick={() => setSelectedWorkplace(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', padding: '8px' }}>
                <X size={20} />
              </button>
            </div>

            <div className="history-list">
              {workplaceShifts.map(shift => (
                <div key={shift.id} className="workplace-history-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{formatDateChip(shift.date)}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      {shift.startTime} - {shift.endTime} • {shiftHours(shift)}h
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: '16px' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{formatKrw(calculateShiftPay(shift).total)}</div>
                  </div>
                  <div className="history-actions">
                    <button className="action-btn edit-btn" onClick={() => {
                      onEditShift(shift);
                      setSelectedWorkplace(null);
                    }}>
                      <Edit3 size={16} />
                    </button>
                    <button className="action-btn delete-btn" onClick={() => {
                      if (confirm('Bạn có chắc muốn xoá ca làm này?')) {
                        onDeleteShift(shift.id);
                      }
                    }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
            <p className="section-kicker">lịch sử gần đây</p>
          </div>
        </div>

        <div className="list-stack">
          {recentShifts.map((shift) => (
            <article key={shift.id} className="list-row">
              <div className="dot" style={{ background: getVenueColor(shift.label, venueColors) }} />
              <div className="workplace-copy">
                <strong>{shift.label}</strong>
                <span>
                  {formatDateChip(shift.date)} • {shift.startTime}-{shift.endTime}
                </span>
              </div>
              <strong className="workplace-amount">{formatKrw(calculateShiftPay(shift).total)}</strong>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
