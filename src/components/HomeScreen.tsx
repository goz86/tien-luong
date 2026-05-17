import { lazy, Suspense, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Edit3, Trash2, Bell, TrendingUp, ShieldCheck } from 'lucide-react';
import { formatKrw, calculateShiftPay, shiftHours } from '../lib/salary';
import { CurrencyMode, Expense, RateState, Shift, VenueColors } from '../lib/types';
import { formatCurrencyFlowAmount } from '../lib/currency';
import { formatDateChip, getVenueColor, formatHoursCompact } from '../utils/helpers';
import { FinanceMetric } from './shared/ui';
import { ActivityTicker } from './shared/ActivityTicker';
import { AchievementBanner, AchievementCompanionNudge } from './AchievementWidgets';

const AchievementScreen = lazy(() => import('./AchievementScreen').then((m) => ({ default: m.AchievementScreen })));

export function HomeScreen({
  monthlyTotal,
  monthlyHours,
  averageHourly,
  rate,
  workplaces,
  recentShifts,
  allShifts,
  expenses,
  venueColors,
  onRefresh,
  onOpenAdd,
  onEditShift,
  onDeleteShift,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  onOpenNotifications,
  onOpenCommunityPost,
  unreadCount,
  profile,
  lang = 'vi',
  isAnonymousRank,
  onToggleAnonymous,
  rankings,
  myId,
  currencyMode,
}: {
  monthlyTotal: number;
  monthlyHours: number;
  averageHourly: number;
  rate: RateState;
  workplaces: Array<{ label: string; total: number; count: number; hours: number }>;
  recentShifts: Shift[];
  allShifts: Shift[];
  expenses: Expense[];
  venueColors: VenueColors;
  onRefresh: () => void;
  onOpenAdd: () => void;
  onEditShift: (shift: Shift) => void;
  onDeleteShift: (id: string) => void;
  currentMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenNotifications: () => void;
  onOpenCommunityPost: (postId: string) => void;
  unreadCount: number;
  profile: any;
  lang?: 'vi' | 'ko';
  isAnonymousRank: boolean;
  onToggleAnonymous: (val: boolean) => void;
  rankings: any[];
  myId: string;
  currencyMode: CurrencyMode;
}) {
  const ui = lang === 'ko' ? {
    notifications: '알림',
    currencyHint: '탭하면 통화가 바뀝니다',
    monthlyIncome: '이번 달 수입',
    totalHours: '총 근무시간',
    averageHourly: '평균 시급',
    exchangeRate: '환율',
    cachedRate: '캐시 사용',
    addShift: '근무 추가',
    workplacesThisMonth: '이번 달 근무지',
    noWorkData: '근무 데이터가 없습니다',
    shiftHistory: '근무 내역',
    community: 'Duhoc Mate 커뮤니티',
    incomeRanking: '수입 랭킹',
    noRanking: '이번 달 랭킹 데이터가 없습니다',
    deleteConfirm: '이 근무 기록을 삭제할까요? 삭제한 데이터는 복구할 수 없습니다.',
    cancel: '취소',
    confirm: '확인',
    edit: '수정',
    delete: '삭제',
  } : {
    notifications: 'Thông báo',
    currencyHint: 'Nhấn để đổi tiền tệ',
    monthlyIncome: 'Thu nhập tháng này',
    totalHours: 'Tổng số giờ',
    averageHourly: 'TB/giờ',
    exchangeRate: 'Tỷ giá',
    cachedRate: 'Dùng cache',
    addShift: 'Thêm ca',
    workplacesThisMonth: 'Nơi làm tháng này',
    noWorkData: 'Chưa có dữ liệu làm việc',
    shiftHistory: 'Lịch sử ca làm',
    community: 'Cộng đồng Duhoc Mate',
    incomeRanking: 'Bảng xếp hạng thu nhập',
    noRanking: `Chưa có dữ liệu xếp hạng tháng`,
    deleteConfirm: 'Bạn có chắc chắn muốn xoá ca làm việc này không? Dữ liệu đã xoá sẽ không thể khôi phục.',
    cancel: 'Hủy bỏ',
    confirm: 'Đồng ý',
    edit: 'Sửa',
    delete: 'Xoá',
  };
  const [selectedWorkplace, setSelectedWorkplace] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isVND, setIsVND] = useState(false);
  const [showAchievement, setShowAchievement] = useState(false);
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
        <h1 className="appbar-title home-wordmark">Duhoc Mate</h1>
        <AchievementCompanionNudge
          allShifts={allShifts}
          expenses={expenses}
          rateValue={rate.value}
          onClick={() => setShowAchievement(true)}
        />
        <button 
          type="button" 
          aria-label={ui.notifications}
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

      <ActivityTicker lang={lang} onOpenPost={onOpenCommunityPost} />

      <section className="hero-balance-card">
        <div className="hero-topline">
          <div onClick={() => setIsVND(!isVND)} style={{ cursor: 'pointer', flex: 1, minWidth: 0, overflow: 'hidden' }} title={ui.currencyHint}>
            <p>{ui.monthlyIncome}</p>
            {(() => {
              const { text: display, code } = formatCurrencyFlowAmount(monthlyTotal, currencyMode, rate.value, isVND);
              const len = display.replace(/\s/g, '').length;
              const fs = code === 'VND'
                ? (len > 16 ? '18px' : len > 12 ? '22px' : '26px')
                : (len > 11 ? '24px' : len > 9 ? '28px' : len > 7 ? '32px' : '35px');
              return (
                <h2 style={{
                  whiteSpace: 'nowrap',
                  fontSize: fs,
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'font-size 0.2s ease',
                  letterSpacing: '-0.035em',
                }}>
                  {display}
                </h2>
              );
            })()}
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
          <FinanceMetric label={ui.totalHours} value={formatHoursCompact(monthlyHours)} />
          <FinanceMetric label={ui.averageHourly} value={formatKrw(averageHourly)} />
          <FinanceMetric label={ui.exchangeRate} value={rate.source === 'live' ? `${rate.value.toFixed(2)} VND` : ui.cachedRate} />
        </div>

        <button type="button" className="primary-cta" onClick={onOpenAdd}>
          <Plus size={18} />
          {ui.addShift}
        </button>
      </section>

      {/* ── Achievement Banner ── */}
      <div className="home-achievement-strip">
        <AchievementBanner
          compact
          isKo={lang === 'ko'}
          onClick={() => setShowAchievement(true)}
          allShifts={allShifts}
          expenses={expenses}
          rateValue={rate.value}
        />
      </div>

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
          background: rgba(8, 22, 43, 0.34);
          backdrop-filter: blur(8px);
          z-index: 2000;
          display: flex;
          align-items: flex-end;
          padding: 0;
        }
        .modal-content {
          background:
            radial-gradient(circle at 92% 0%, rgba(38, 217, 164, 0.11), transparent 30%),
            linear-gradient(180deg, #ffffff 0%, #f6f9ff 100%);
          width: 100%;
          max-width: 430px;
          margin: 0 auto;
          height: 85vh;
          border-top-left-radius: 40px;
          border-top-right-radius: 40px;
          padding: 20px 22px 0;
          overflow-y: auto;
          box-shadow: 0 -24px 70px rgba(15, 23, 42, 0.18);
          display: flex;
          flex-direction: column;
          position: relative;
          border: 1px solid rgba(255, 255, 255, 0.75);
          border-bottom: 0;
        }
        .modal-handle {
          width: 42px;
          height: 5px;
          background: #e2e8f0;
          border-radius: 99px;
          margin: 0 auto 18px;
          flex-shrink: 0;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin: 0 -22px 18px;
          padding: 0 22px 18px;
          border-bottom: 1px solid rgba(112, 129, 159, 0.08);
          flex-shrink: 0;
        }
        .workplace-history-title {
          margin: 4px 0 0;
          font-size: clamp(22px, 6vw, 26px);
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.05em;
          color: var(--text-main);
        }
        .modal-close-button {
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 17px;
          background: rgba(241, 245, 249, 0.9);
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.08);
        }
        .history-list {
          flex: 1;
          overflow-y: auto;
          padding: 2px 0 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .workplace-history-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: start;
          padding: 13px 14px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 22px;
          background:
            radial-gradient(circle at 92% 18%, rgba(79, 115, 255, 0.08), transparent 34%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(246, 249, 255, 0.92));
          box-shadow: 0 14px 34px rgba(28, 43, 76, 0.08);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .workplace-history-item:active {
          transform: scale(0.985);
        }
        .workplace-history-date {
          font-weight: 900;
          font-size: 15px;
          letter-spacing: -0.02em;
          color: var(--text-main);
        }
        .workplace-history-meta {
          font-size: 12px;
          color: var(--text-soft);
          margin-top: 5px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .workplace-history-note {
          font-size: 11px;
          color: #94a3b8;
          font-style: italic;
          margin-top: 3px;
        }
        .workplace-history-pay {
          text-align: right;
          font-weight: 900;
          font-size: 16px;
          color: var(--blue-700);
          font-feature-settings: "tnum";
          white-space: nowrap;
        }
        .history-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 8px;
        }
        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .action-btn:active { transform: scale(0.9); }
        .edit-btn { background: linear-gradient(180deg, #eef4ff, #eaf0ff); color: #2752ff; }
        .delete-btn { background: linear-gradient(180deg, #fff5f6, #ffecef); color: #e11d48; }
        .workplace-history-footer {
          padding: 2px 20px calc(100px + env(safe-area-inset-bottom)) 20px;
        }
        .workplace-history-add {
          width: 100%;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: linear-gradient(135deg, var(--blue-700), #7657ff);
          color: white;
          border-radius: 18px;
          font-weight: 900;
          border: none;
          cursor: pointer;
          box-shadow: 0 18px 34px rgba(39, 82, 255, 0.22);
        }

        .dark .modal-content {
          background:
            radial-gradient(circle at 92% 0%, rgba(38, 217, 164, 0.12), transparent 32%),
            linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
          color: white;
          border-color: rgba(255, 255, 255, 0.06);
        }
        .dark .workplace-history-item {
          border-color: rgba(255, 255, 255, 0.07);
          background:
            radial-gradient(circle at 92% 18%, rgba(79, 115, 255, 0.14), transparent 34%),
            linear-gradient(135deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.92));
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.22);
        }
        .dark .modal-handle { background: #334155; }
        .dark .modal-close-button { background: rgba(30, 41, 59, 0.92); color: #94a3b8; }
        .dark .edit-btn { background: rgba(39, 82, 255, 0.16); }
      `}</style>

      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">{ui.workplacesThisMonth} ({workplaces.length})</p>
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
                  {workplace.count} ca · {formatHoursCompact(workplace.hours)}
                </span>
              </div>
              <strong className="workplace-amount">{formatKrw(workplace.total)}</strong>
            </div>
          )) : (
            <div style={{ padding: '20px 0', fontSize: '14px', color: '#94a3b8', textAlign: 'center' }}>{ui.noWorkData}</div>
          )}
        </div>
      </section>

      {selectedWorkplace && (
        <div className="modal-overlay" onClick={() => setSelectedWorkplace(null)}>
          <div className="modal-content workplace-history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <div>
                <p className="section-kicker">{ui.shiftHistory}</p>
                <h3 className="workplace-history-title">{selectedWorkplace}</h3>
              </div>
              <button className="modal-close-button" onClick={() => setSelectedWorkplace(null)} aria-label={lang === 'ko' ? '닫기' : 'Đóng'}>
                <X size={20} />
              </button>
            </div>

            <div className="history-list">
              {workplaceShifts.map(shift => (
                <div key={shift.id} className="workplace-history-item">
                  <div>
                    <div className="workplace-history-date">{formatDateChip(shift.date)}</div>
                    <div className="workplace-history-meta">
                      {shift.startTime} - {shift.endTime} · {formatHoursCompact(shiftHours(shift))}
                      {shift.notes && <div className="workplace-history-note">{shift.notes}</div>}
                    </div>
                  </div>
                  <div>
                    <div className="workplace-history-pay">{formatKrw(calculateShiftPay(shift).total)}</div>
                    <div className="history-actions">
                      <button className="action-btn edit-btn" onClick={() => {
                        onEditShift(shift);
                        setSelectedWorkplace(null);
                      }}>
                        <Edit3 size={16} />
                      </button>
                      <button className="action-btn delete-btn" onClick={() => setDeleteConfirmId(shift.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="workplace-history-footer">
              <button 
                type="button" 
                className="workplace-history-add"
                onClick={() => {
                  onOpenAdd();
                  setSelectedWorkplace(null);
                }}
              >
                <Plus size={18} />
                {ui.addShift}
              </button>
            </div>
          </div>
        </div>
      )}


      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">{ui.community}</p>
            <h3>{ui.incomeRanking}</h3>
          </div>
          <div className="rank-month-badge">
            {lang === 'ko' ? `${new Date().getMonth() + 1}월` : `Tháng ${new Date().getMonth() + 1}`}
          </div>
        </div>
        
        <div className="ranking-container">
          {rankings.length === 0 ? (
            <div className="rank-empty-state">
              <TrendingUp size={24} style={{ opacity: 0.2, marginBottom: '8px' }} />
              <p>{lang === 'ko' ? `${monthNumber}월 랭킹 데이터가 없습니다` : `${ui.noRanking} ${monthNumber}`}</p>
              <span>{myId ? (lang === 'ko' ? '첫 근무를 기록하고 랭킹에 올라보세요!' : 'Hãy ghi lại ca làm đầu tiên để lên hạng!') : (lang === 'ko' ? '로그인하고 근무를 기록하면 랭킹에 참여할 수 있어요!' : 'Đăng nhập để ghi lại ca làm và lên hạng!')}</span>
            </div>
          ) : (
            rankings.map((item) => {
              const isMe = item.user_id === myId;
              const rank = item.rank;
              const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
              
              // Resolve display name for the list
              let displayName = item.display_name;
              
              // Cute names list
              const cuteNames = lang === 'ko'
                ? ["성실한 랭커", "꾸준한 알바생", "행운의 유학생", "열정 가득 멤버", "친절한 친구", "노력형 멤버", "활기찬 랭커", "부지런한 메이트"]
                : ["Gấu Trúc", "Mèo Con", "Thỏ Ngọc", "Sóc Nhỏ", "Cánh Cụt", "Hươu Sao", "Vịt Vàng", "Cún Con"];

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
                <div key={item.user_id} className={`rank-card ${isMe ? 'is-me' : ''} ${rank > 3 ? 'rank-outside' : ''}`}>
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
                {isAnonymousRank ? (lang === 'ko' ? '익명으로 표시 중' : 'Bạn đang ẩn danh') : (lang === 'ko' ? '익명 모드' : 'Chế độ ẩn danh')}
              </span>
            </div>
          </div>
        )}
      </section>



      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">{lang === 'ko' ? '최근 근무 내역' : 'lịch sử gần đây'}</p>
          </div>
        </div>

        <div className="list-stack">
          {recentShifts.map((shift) => (
            <article key={shift.id} className="list-row">
              <div className="dot" style={{ background: getVenueColor(shift.label, venueColors) }} />
              <div className="workplace-copy">
                <strong>{shift.label}</strong>
                <span>
                  {formatDateChip(shift.date)} · {shift.startTime}-{shift.endTime}
                  {shift.notes && <span style={{ display: 'block', fontStyle: 'italic', color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>{shift.notes}</span>}
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
              <h3>{lang === 'ko' ? '확인' : 'Xác nhận'}</h3>
              <p>{ui.deleteConfirm}</p>
            </div>
            <div className="confirm-footer">
              <button type="button" className="confirm-btn cancel" onClick={() => setDeleteConfirmId(null)}>{ui.cancel}</button>
              <button 
                type="button" 
                className="confirm-btn danger" 
                onClick={() => {
                  onDeleteShift(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
              >
                {ui.confirm}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Achievement Screen ── */}
      {showAchievement && (
        <Suspense fallback={null}>
          <AchievementScreen
            isKo={lang === 'ko'}
            onClose={() => setShowAchievement(false)}
          />
        </Suspense>
      )}
    </>
  );
}
