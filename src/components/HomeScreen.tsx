import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Edit3, Trash2, Bell, TrendingUp, ShieldCheck } from 'lucide-react';
import { formatKrw, calculateShiftPay, shiftHours } from '../lib/salary';
import { RateState, Shift, VenueColors } from '../lib/types';
import { formatDateChip, getVenueColor } from '../utils/helpers';
import { FinanceMetric } from './shared/ui';
import { Logo } from './shared/Logo';

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
  onNextMonth,
  onOpenNotifications,
  unreadCount,
  profile,
  isAnonymousRank,
  onToggleAnonymous,
  rankings,
  myId,
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
  onOpenNotifications: () => void;
  unreadCount: number;
  profile: any;
  isAnonymousRank: boolean;
  onToggleAnonymous: (val: boolean) => void;
  rankings: any[];
  myId: string;
}) {
  const [selectedWorkplace, setSelectedWorkplace] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isVND, setIsVND] = useState(false);
  const monthNumber = new Date(`${currentMonth}T00:00:00`).getMonth() + 1;

  const workplaceShifts = allShifts.filter(s => s.label === selectedWorkplace)
    .sort((a, b) => {
      const strA = `${a.date}T${a.startTime || '00:00'}`;
      const strB = `${b.date}T${b.startTime || '00:00'}`;
      return strA < strB ? 1 : strA > strB ? -1 : 0;
    });

  return (
    <>
      <header className="appbar">
        <Logo />
        <button 
          type="button" 
          aria-label="Thông báo"
          onClick={onOpenNotifications}
          style={{
            background: 'white',
            border: 'none',
            borderRadius: '16px',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            position: 'relative'
          }}
        >
          <Bell size={22} color="#64748b" />
          {unreadCount > 0 && (
            <span className="cm-notification-badge">{unreadCount}</span>
          )}
        </button>
      </header>

      <section className="hero-balance-card">
        <div className="hero-topline">
          <div onClick={() => setIsVND(!isVND)} style={{ cursor: 'pointer', flex: 1, minWidth: 0 }} title="Nhấn để đổi tiền tệ">
            <p>Thu nhập tháng này</p>
            <h2 style={{ whiteSpace: 'nowrap', fontSize: isVND ? '28px' : '35px' }}>
              {isVND ? `${Math.round(monthlyTotal * rate.value).toLocaleString('vi-VN')} VNĐ` : formatKrw(monthlyTotal)}
            </h2>
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
          <FinanceMetric label="Tổng số giờ" value={`${monthlyHours.toFixed(1)}h`} />
          <FinanceMetric label="Lương TB/ giờ" value={formatKrw(averageHourly)} />
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
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(8, 22, 43, 0.4);
          backdrop-filter: blur(8px);
          z-index: 2000;
          display: flex;
          align-items: flex-end;
          padding: 0;
        }
        .modal-content {
          background: white;
          width: 100%;
          max-width: 430px;
          margin: 0 auto;
          height: 65vh;
          border-top-left-radius: 40px;
          border-top-right-radius: 40px;
          padding: 24px;
          overflow-y: auto;
          box-shadow: 0 -20px 60px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .modal-handle {
          width: 48px;
          height: 5px;
          background: #e2e8f0;
          border-radius: 99px;
          margin: 0 auto 20px;
          flex-shrink: 0;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-shrink: 0;
        }
        .history-list {
          flex: 1;
          overflow-y: auto;
          padding-bottom: 40px;
        }
        .workplace-history-item {
          display: flex;
          align-items: center;
          padding: 18px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .history-actions {
          display: flex;
          gap: 8px;
        }
        .action-btn {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .action-btn:active { transform: scale(0.9); }
        .edit-btn { background: #eff6ff; color: #2752ff; }
        .delete-btn { background: #fff1f2; color: #e11d48; }

        .dark .modal-content {
          background: #0f172a;
          color: white;
        }
        .dark .workplace-history-item {
          border-bottom-color: #1e293b;
        }
        .dark .modal-handle { background: #334155; }
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
            <div className="modal-handle" />
            <div className="modal-header">
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#2752ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch sử ca làm</p>
                <h3 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-main)' }}>{selectedWorkplace}</h3>
              </div>
              <button onClick={() => setSelectedWorkplace(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '16px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            <div className="history-list">
              {workplaceShifts.map(shift => (
                <div key={shift.id} className="workplace-history-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>{formatDateChip(shift.date)}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                      {shift.startTime} - {shift.endTime} • {shiftHours(shift)}h
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: '16px' }}>
                    <div style={{ fontWeight: 900, fontSize: '17px', color: '#2752ff', fontFeatureSettings: '"tnum"' }}>{formatKrw(calculateShiftPay(shift).total)}</div>
                  </div>
                  <div className="history-actions">
                    <button className="action-btn edit-btn" onClick={() => {
                      onEditShift(shift);
                      setSelectedWorkplace(null);
                    }}>
                      <Edit3 size={18} />
                    </button>
                    <button className="action-btn delete-btn" onClick={() => setDeleteConfirmId(shift.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '0 24px calc(100px + env(safe-area-inset-bottom)) 24px' }}>
              <button 
                type="button" 
                className="quick-save-button" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: '#2752ff', color: 'white', borderRadius: '16px', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  onOpenAdd();
                  setSelectedWorkplace(null);
                }}
              >
                <Plus size={18} />
                Thêm ca làm mới
              </button>
            </div>
          </div>
        </div>
      )}


      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">Cộng đồng Duhoc Mate</p>
            <h3>Bảng xếp hạng thu nhập</h3>
          </div>
          <div className="rank-month-badge">
            Tháng {new Date().getMonth() + 1}
          </div>
        </div>
        
        <div className="ranking-container">
          {rankings.length === 0 ? (
            <div className="rank-empty-state">
              <TrendingUp size={24} style={{ opacity: 0.2, marginBottom: '8px' }} />
              <p>Chưa có dữ liệu xếp hạng tháng {monthNumber}</p>
              <span>{myId ? 'Hãy ghi lại ca làm đầu tiên để lên hạng!' : 'Đăng nhập để ghi lại ca làm và lên hạng!'}</span>
            </div>
          ) : (
            rankings.map((item, i) => {
              const isMe = item.user_id === myId;
              const rank = i + 1;
              const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
              
              // Resolve display name for the list
              let displayName = item.display_name;
              
              // Cute names list
              const cuteNames = [
                "Gấu Trúc Chăm Chỉ 🐼", "Mèo Con Cần Mẫn 🐱", "Thỏ Ngọc May Mắn 🐰", 
                "Sóc Nhỏ Năng Động 🐿️", "Cánh Cụt Đáng Yêu 🐧", "Hươu Sao Tốt Bụng 🦌",
                "Vịt Vàng Lon Ton 🐥", "Cún Con Tinh Nghịch 🐶"
              ];

              const getCuteName = (uid: string) => {
                const index = uid ? uid.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % cuteNames.length : 0;
                return cuteNames[index];
              };

              // Masking logic
              const effectiveAnonymous = isMe ? isAnonymousRank : item.is_anonymous_rank;
              
              if (effectiveAnonymous) {
                displayName = getCuteName(item.user_id);
              }

              return (
                <div key={item.user_id} className={`rank-card ${isMe ? 'is-me' : ''}`}>
                  <div className="rank-number">
                    {medal ? <span className="medal">{medal}</span> : <span>{rank}</span>}
                  </div>
                  <div className="rank-info">
                    <div className="rank-name-row">
                      <strong>{isMe ? (isAnonymousRank ? displayName : item.display_name) : displayName}</strong>
                    </div>
                  </div>

                  <div className="rank-value">
                    <span className="rank-amount">{formatKrw(item.total_income)}</span>
                  </div>
                </div>

              );
            })
          )}
        </div>



        {myId && (
          <div className="rank-privacy-toggle" onClick={() => onToggleAnonymous(!isAnonymousRank)}>
            <div className={`privacy-switch ${isAnonymousRank ? 'active' : ''}`}>
              <div className="switch-handle" />
            </div>
            <div className="privacy-copy">
              <ShieldCheck size={16} color={isAnonymousRank ? '#2752ff' : '#64748b'} />
              <span style={{ color: isAnonymousRank ? '#2752ff' : '#64748b' }}>
                {isAnonymousRank ? 'Bạn đang ẩn danh' : 'Chế độ ẩn danh'}
              </span>
            </div>
          </div>
        )}
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
      {deleteConfirmId && (
        <section className="calendar-modal-backdrop confirm-backdrop" style={{ zIndex: 3500 }} onClick={() => setDeleteConfirmId(null)}>
          <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="confirm-content">
              <h3>Xác nhận</h3>
              <p>Bạn có chắc chắn muốn xoá ca làm việc này không? Dữ liệu đã xoá sẽ không thể khôi phục.</p>
            </div>
            <div className="confirm-footer">
              <button type="button" className="confirm-btn cancel" onClick={() => setDeleteConfirmId(null)}>Hủy bỏ</button>
              <button 
                type="button" 
                className="confirm-btn danger" 
                onClick={() => {
                  onDeleteShift(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
