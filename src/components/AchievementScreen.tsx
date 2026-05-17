/**
 * AchievementScreen — Hành Trình / 나의 여정
 *
 * Supabase table required:
 * ---------------------------------------------------
 * create table public.admin_events (
 *   id          uuid primary key default gen_random_uuid(),
 *   title       text not null,
 *   description text,
 *   reward_emoji text default '🎁',
 *   start_date  date not null,
 *   end_date    date not null,
 *   active      boolean default true,
 *   created_at  timestamptz default now()
 * );
 * alter table public.admin_events enable row level security;
 * create policy "public read" on public.admin_events for select using (true);
 * create policy "admin insert" on public.admin_events for all using (auth.role() = 'authenticated');
 * ---------------------------------------------------
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Gift, Map, ChevronRight, Calendar, Sparkles, Trophy } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { calculateShiftPay } from '../lib/salary';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  reward_emoji: string;
  start_date: string;
  end_date: string;
}

interface Milestone {
  key: string;
  threshold: number; // VND
  emoji: string;
  imgKey: string;    // for future image replacement
  label_vi: string;
  label_ko: string;
  desc_vi: string;
  desc_ko: string;
  color: string;
  bgColor: string;
}

interface CharacterStage {
  threshold: number;
  emoji: string;
  imgKey: string;
  name_vi: string;
  name_ko: string;
  desc_vi: string;
  desc_ko: string;
}

// ─────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────

export const MILESTONES: Milestone[] = [
  {
    key: 'tea', threshold: 1_000_000, emoji: '🧋', imgKey: 'badge_tea',
    label_vi: 'Trà Sữa Gang', label_ko: '버블티 부자',
    desc_vi: 'Đủ trà sữa cả tháng rồi!', desc_ko: '한 달 버블티 값이 생겼어요!',
    color: '#ec4899', bgColor: '#fdf2f8',
  },
  {
    key: 'airpods', threshold: 3_000_000, emoji: '🎧', imgKey: 'badge_airpods',
    label_vi: 'AirPods Moment', label_ko: '에어팟 구매 가능',
    desc_vi: 'Flex với bạn bè thôi!', desc_ko: '친구들한테 자랑할 수 있어요!',
    color: '#8b5cf6', bgColor: '#f5f3ff',
  },
  {
    key: 'plane', threshold: 5_000_000, emoji: '✈️', imgKey: 'badge_plane',
    label_vi: 'Vé Về Thăm Nhà', label_ko: '귀국 항공권',
    desc_vi: 'Bay về ôm má một cái!', desc_ko: '엄마한테 돌아갈 수 있어요!',
    color: '#0ea5e9', bgColor: '#f0f9ff',
  },
  {
    key: 'gold', threshold: 10_000_000, emoji: '🏅', imgKey: 'badge_gold',
    label_vi: '1 Cây Vàng!', label_ko: '금 1돈!',
    desc_vi: 'Ông bà tổ tiên phù hộ!', desc_ko: '조상님이 도와주셨어요!',
    color: '#f59e0b', bgColor: '#fffbeb',
  },
  {
    key: 'motorbike', threshold: 20_000_000, emoji: '🛵', imgKey: 'badge_motorbike',
    label_vi: 'Xe Máy Cho Ba', label_ko: '아버지 오토바이',
    desc_vi: 'Quà hiếu thảo số 1!', desc_ko: '최고의 효도 선물!',
    color: '#10b981', bgColor: '#f0fdf4',
  },
  {
    key: 'ring', threshold: 35_000_000, emoji: '💍', imgKey: 'badge_ring',
    label_vi: 'Nhẫn Cầu Hôn', label_ko: '프로포즈 반지',
    desc_vi: 'Thả thính được rồi đó!', desc_ko: '이제 프로포즈해도 돼요!',
    color: '#a855f7', bgColor: '#faf5ff',
  },
  {
    key: 'wedding', threshold: 50_000_000, emoji: '👰', imgKey: 'badge_wedding',
    label_vi: 'Đám Cưới Xịn', label_ko: '결혼식',
    desc_vi: 'Buffet 50 bàn luôn!', desc_ko: '50테이블 뷔페 가능!',
    color: '#f43f5e', bgColor: '#fff1f2',
  },
  {
    key: 'phone', threshold: 80_000_000, emoji: '📱', imgKey: 'badge_phone',
    label_vi: 'iPhone Mới Nhất', label_ko: '최신 아이폰',
    desc_vi: 'Flex không cần filter!', desc_ko: '필터 없이 자랑해요!',
    color: '#3b82f6', bgColor: '#eff6ff',
  },
  {
    key: 'house', threshold: 100_000_000, emoji: '🏠', imgKey: 'badge_house',
    label_vi: 'Cọc Được Nhà', label_ko: '집 계약금',
    desc_vi: 'Ký hợp đồng thôi!', desc_ko: '계약서 사인할 시간!',
    color: '#22c55e', bgColor: '#f0fdf4',
  },
  {
    key: 'car', threshold: 150_000_000, emoji: '🚗', imgKey: 'badge_car',
    label_vi: 'Mua Xe Ô Tô', label_ko: '자동차 구매',
    desc_vi: 'Đón ba má bằng xe riêng!', desc_ko: '부모님을 직접 모시러 가요!',
    color: '#f97316', bgColor: '#fff7ed',
  },
  {
    key: 'vietnam', threshold: 200_000_000, emoji: '🇻🇳', imgKey: 'badge_vietnam',
    label_vi: 'Về Việt Nam Thôi!', label_ko: '베트남으로 귀국!',
    desc_vi: 'Hoàn thành hành trình!', desc_ko: '여정 완료!',
    color: '#ef4444', bgColor: '#fef2f2',
  },
];

const CHARACTER_STAGES: CharacterStage[] = [
  {
    threshold: 0, emoji: '🥚', imgKey: 'hamster_egg',
    name_vi: 'Trứng Bí Ẩn', name_ko: '신비한 알',
    desc_vi: 'Hành trình bắt đầu từ đây...', desc_ko: '여정이 시작됩니다...',
  },
  {
    threshold: 1_000_000, emoji: '🐣', imgKey: 'hamster_baby',
    name_vi: 'Baby Hamster', name_ko: '아기 햄스터',
    desc_vi: 'Mới bắt đầu kiếm tiền!', desc_ko: '이제 막 돈을 벌기 시작했어요!',
  },
  {
    threshold: 10_000_000, emoji: '🐹', imgKey: 'hamster_normal',
    name_vi: 'Hamster Cần Cù', name_ko: '부지런한 햄스터',
    desc_vi: 'Đang trên đường thành công!', desc_ko: '성공을 향해 가는 중!',
  },
  {
    threshold: 35_000_000, emoji: '🐹🎓', imgKey: 'hamster_student',
    name_vi: 'Hamster Sinh Viên', name_ko: '학생 햄스터',
    desc_vi: 'Tích lũy kinh nghiệm & tiền!', desc_ko: '경험과 돈을 쌓고 있어요!',
  },
  {
    threshold: 80_000_000, emoji: '🐹💼', imgKey: 'hamster_office',
    name_vi: 'Hamster Dân Văn Phòng', name_ko: '직장인 햄스터',
    desc_vi: 'Chuyên nghiệp rồi đó!', desc_ko: '이제 프로가 됐어요!',
  },
  {
    threshold: 150_000_000, emoji: '🐹👑', imgKey: 'hamster_rich',
    name_vi: 'Hamster Thành Đạt', name_ko: '성공한 햄스터',
    desc_vi: 'Gần về nhà rồi!', desc_ko: '거의 다 왔어요!',
  },
  {
    threshold: 200_000_000, emoji: '🏆', imgKey: 'hamster_home',
    name_vi: 'Hamster Trở Về', name_ko: '귀국 햄스터',
    desc_vi: 'Hoàn thành hành trình!', desc_ko: '여정 완료!',
  },
];

const REWARD_POOL = [
  '⭐', '🌟', '💫', '✨', '🎖️', '🏆', '🎀', '🌸',
  '🦋', '🌈', '🎵', '🍀', '🌙', '☀️', '🎊', '💎',
  '🌺', '🦄', '🔮', '🌠',
];

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function fmtVnd(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString('vi-VN');
}

function iconUrl(name: string) {
  return `/icon/${name}.png`;
}

function faceImg(progressPct: number, hasUnclaimed: boolean, totalVnd: number): string {
  if (totalVnd === 0) return 'face_sad';
  if (hasUnclaimed) return 'face_shock';
  if (progressPct >= 90) return 'face_proud';
  if (progressPct >= 60) return 'face_excited';
  if (progressPct >= 20) return 'face_happy';
  return 'face_sleepy';
}

function claimedKey(uid?: string | null) {
  return `ach-claimed-${uid ?? 'guest'}`;
}
function loadClaimed(uid?: string | null): string[] {
  try { return JSON.parse(localStorage.getItem(claimedKey(uid)) ?? '[]'); }
  catch { return []; }
}
function saveClaimed(keys: string[], uid?: string | null) {
  localStorage.setItem(claimedKey(uid), JSON.stringify(keys));
}

// ─────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────

function GiftModal({
  milestone,
  isKo,
  onClose,
  onClaim,
}: {
  milestone: Milestone;
  isKo: boolean;
  onClose: () => void;
  onClaim: (reward: string) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'shaking' | 'opened'>('idle');
  const [reward, setReward] = useState('');

  const handleTap = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('shaking');
    setTimeout(() => {
      const r = REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];
      setReward(r);
      setPhase('opened');
      onClaim(r);
    }, 700);
  }, [phase, onClaim]);

  return createPortal(
    <div className="ach-gift-overlay" onClick={phase === 'opened' ? onClose : undefined}>
      <div className="ach-gift-modal" onClick={e => e.stopPropagation()}>
        {phase !== 'opened' ? (
          <>
            <div className="ach-gift-milestone-badge" style={{ background: milestone.bgColor, color: milestone.color }}>
              {milestone.emoji} {isKo ? milestone.label_ko : milestone.label_vi}
            </div>
            <div className="ach-gift-title">{isKo ? '🎁 선물 상자!' : '🎁 Hộp Quà!'}</div>
            <div className="ach-gift-hint">{isKo ? '상자를 눌러서 열어보세요!' : 'Nhấn vào hộp để mở!'}</div>
            <button
              type="button"
              className={`ach-gift-box-btn ${phase === 'shaking' ? 'shaking' : ''}`}
              onClick={handleTap}
              disabled={phase === 'shaking'}
            >
              <img src={iconUrl('box_closed')} alt="gift box" className="ach-gift-box-img" />
            </button>
            {phase === 'idle' && (
              <p className="ach-gift-tap-hint">{isKo ? '👆 탭하기' : '👆 Nhấn vào đây'}</p>
            )}
          </>
        ) : (
          <>
            <div className="ach-gift-confetti">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="ach-confetti-dot" style={{
                  '--i': i,
                  '--color': ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][i % 6],
                } as React.CSSProperties} />
              ))}
            </div>
            <img src={iconUrl('box_open')} alt="opened box" className="ach-gift-box-img" />
            <div className="ach-gift-reward-emoji">{reward}</div>
            <div className="ach-gift-title">{isKo ? '축하해요! 🎉' : 'Chúc mừng! 🎉'}</div>
            <div className="ach-gift-subtitle">
              {isKo ? '새 아이콘을 획득했어요!' : 'Bạn nhận được icon đặc biệt!'}
            </div>
            <div className="ach-gift-reward-label">
              {isKo ? '획득한 아이콘:' : 'Icon vừa nhận:'} <strong>{reward}</strong>
            </div>
            <button type="button" className="ach-gift-done-btn" onClick={onClose}>
              {isKo ? '닫기 ✓' : 'Đóng ✓'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────

interface AchievementScreenProps {
  onClose?: () => void;
  isKo?: boolean;
  inline?: boolean;
}

export function AchievementScreen({ onClose, isKo = false, inline = false }: AchievementScreenProps) {
  const { shifts, rate, session } = useAppStore();
  const uid = session?.user.id ?? null;

  const [claimed, setClaimed] = useState<string[]>(() => loadClaimed(uid));
  const [giftMilestone, setGiftMilestone] = useState<Milestone | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [collectedIcons, setCollectedIcons] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`ach-icons-${uid ?? 'guest'}`) ?? '[]'); }
    catch { return []; }
  });

  // ── Compute total VND from all shifts ──
  const totalVnd = useMemo(() => {
    return shifts.reduce((sum, s) => sum + calculateShiftPay(s).total * rate.value, 0);
  }, [shifts, rate.value]);

  // ── Current character stage ──
  const stage = useMemo(() => {
    return [...CHARACTER_STAGES].reverse().find(s => totalVnd >= s.threshold) ?? CHARACTER_STAGES[0];
  }, [totalVnd]);

  // ── Next milestone ──
  const nextMilestone = useMemo(() => MILESTONES.find(m => totalVnd < m.threshold) ?? null, [totalVnd]);

  // ── Progress % to next milestone ──
  const progressPct = useMemo(() => {
    if (!nextMilestone) return 100;
    const idx = MILESTONES.indexOf(nextMilestone);
    const prevThreshold = idx > 0 ? MILESTONES[idx - 1].threshold : 0;
    const range = nextMilestone.threshold - prevThreshold;
    const done = Math.max(0, totalVnd - prevThreshold);
    return Math.min(100, (done / range) * 100);
  }, [totalVnd, nextMilestone]);

  // ── Unclaimed but reached milestones ──
  const unclaimedCount = MILESTONES.filter(m => totalVnd >= m.threshold && !claimed.includes(m.key)).length;

  // ── Load admin events ──
  useEffect(() => {
    if (!supabase) { setEventsLoading(false); return; }
    const today = new Date().toISOString().slice(0, 10);
    void supabase
      .from('admin_events')
      .select('id,title,description,reward_emoji,start_date,end_date')
      .eq('active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .then(({ data }) => {
        setEvents((data ?? []) as AdminEvent[]);
        setEventsLoading(false);
      });
  }, []);

  const handleClaim = useCallback((milestone: Milestone) => {
    setGiftMilestone(milestone);
  }, []);

  const handleGiftCollect = useCallback((reward: string) => {
    if (!giftMilestone) return;
    const nextClaimed = [...claimed, giftMilestone.key];
    setClaimed(nextClaimed);
    saveClaimed(nextClaimed, uid);
    const nextIcons = [...collectedIcons, reward];
    setCollectedIcons(nextIcons);
    localStorage.setItem(`ach-icons-${uid ?? 'guest'}`, JSON.stringify(nextIcons));
  }, [giftMilestone, claimed, collectedIcons, uid]);

  const bodyContent = (
    <div className="ach-body">

            {/* Character Card */}
            <div className="ach-char-card">
              <div className="ach-char-card-top">
                <div className="ach-char-avatar-wrap">
                  <img src={iconUrl(stage.imgKey)} alt={stage.name_vi} className="ach-char-avatar-img" />
                  <img
                    src={iconUrl(faceImg(progressPct, unclaimedCount > 0, totalVnd))}
                    alt="face"
                    className="ach-char-face-img"
                  />
                  <div className="ach-char-glow" />
                </div>
                <div className="ach-char-meta">
                  <div className="ach-char-name">{isKo ? stage.name_ko : stage.name_vi}</div>
                  <div className="ach-char-desc">{isKo ? stage.desc_ko : stage.desc_vi}</div>
                </div>
              </div>
              <div className="ach-char-total">
                <div className="ach-char-total-label">{isKo ? '총 수입' : 'Tổng tích lũy'}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <div className="ach-char-total-value">{fmtVnd(totalVnd)}</div>
                  <div className="ach-char-total-sub">VND</div>
                </div>
              </div>
            </div>

            {/* Progress bar to next milestone */}
            {nextMilestone && (
              <div className="ach-progress-card">
                <div className="ach-progress-head">
                  <span className="ach-progress-label">
                    {isKo ? '다음 목표' : 'Mục tiêu kế tiếp'}
                  </span>
                  <span className="ach-progress-next" style={{ color: nextMilestone.color }}>
                    {nextMilestone.emoji} {isKo ? nextMilestone.label_ko : nextMilestone.label_vi}
                  </span>
                  <span className="ach-progress-pct">{Math.round(progressPct)}%</span>
                </div>
                <div className="ach-progress-track">
                  <div
                    className="ach-progress-fill"
                    style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${nextMilestone.color}99, ${nextMilestone.color})` }}
                  />
                </div>
                <div className="ach-progress-remain">
                  {isKo
                    ? `${fmtVnd(nextMilestone.threshold - totalVnd)} 더 필요해요`
                    : `Còn ${fmtVnd(nextMilestone.threshold - totalVnd)} nữa là đạt!`}
                </div>
              </div>
            )}
            {!nextMilestone && (
              <div className="ach-completed-banner">
                <Trophy size={18} />
                {isKo ? '모든 목표를 달성했어요! 🏆' : 'Bạn đã chinh phục toàn bộ hành trình! 🏆'}
              </div>
            )}

            {/* Admin Events */}
            {!eventsLoading && events.length > 0 && (
              <div className="ach-section">
                <div className="ach-section-title">
                  <Sparkles size={14} />
                  {isKo ? '진행 중인 이벤트' : 'Sự kiện đang diễn ra'}
                </div>
                <div className="ach-events-list">
                  {events.map(ev => (
                    <div key={ev.id} className="ach-event-card">
                      <div className="ach-event-emoji">{ev.reward_emoji}</div>
                      <div className="ach-event-body">
                        <div className="ach-event-title">{ev.title}</div>
                        {ev.description && <div className="ach-event-desc">{ev.description}</div>}
                        <div className="ach-event-dates">
                          <Calendar size={10} />
                          {ev.start_date} → {ev.end_date}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collected icons */}
            {collectedIcons.length > 0 && (
              <div className="ach-section">
                <div className="ach-section-title">
                  <Gift size={14} />
                  {isKo ? '내 아이콘 컬렉션' : 'Bộ sưu tập icon của bạn'}
                </div>
                <div className="ach-icon-grid">
                  {collectedIcons.map((icon, i) => (
                    <div key={i} className="ach-icon-chip">{icon}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Milestone Map */}
            <div className="ach-section">
              <div className="ach-section-title">
                <Map size={14} />
                {isKo ? '이정표 지도' : 'Bản Đồ Mốc Thành Tích'}
              </div>
              <div className="ach-map-wrap">
                <img src="/icon/map_background.png" alt="" className="ach-map-bg" aria-hidden="true" />
              <div className="ach-map">
                {MILESTONES.map((m, idx) => {
                  const reached = totalVnd >= m.threshold;
                  const isClaimed = claimed.includes(m.key);
                  const isCurrentPos = nextMilestone?.key === m.key
                    ? false
                    : (idx === MILESTONES.length - 1 && !nextMilestone)
                      ? true
                      : nextMilestone && MILESTONES[MILESTONES.indexOf(nextMilestone) - 1]?.key === m.key;
                  const canClaim = reached && !isClaimed;

                  return (
                    <div key={m.key} className={`ach-ms ${reached ? 'ach-ms--reached' : ''} ${isCurrentPos ? 'ach-ms--current' : ''}`}>
                      {/* Left: icon + connector */}
                      <div className="ach-ms-left">
                        <div
                          className="ach-ms-node"
                          style={reached ? { boxShadow: `0 0 0 3px ${m.color}33` } : {}}
                        >
                          <img
                            src={iconUrl(m.imgKey)}
                            alt={m.label_vi}
                            className="ach-ms-badge-img"
                            style={!reached ? { filter: 'grayscale(1)', opacity: 0.3 } : {}}
                          />
                          {isCurrentPos && (
                            <img src={iconUrl(stage.imgKey)} alt="you are here" className="ach-hamster-badge-img" />
                          )}
                        </div>
                        {idx < MILESTONES.length - 1 && (
                          <div className={`ach-ms-line ${reached ? 'ach-ms-line--reached' : ''}`}
                            style={reached ? { background: `linear-gradient(to bottom, ${m.color}88, #e2e8f0)` } : {}}
                          />
                        )}
                      </div>

                      {/* Right: info */}
                      <div className="ach-ms-right">
                        <div className="ach-ms-info">
                          <div className="ach-ms-label" style={reached ? { color: 'var(--text-main)' } : {}}>
                            {isKo ? m.label_ko : m.label_vi}
                          </div>
                          <div className="ach-ms-amount" style={reached ? { color: m.color } : {}}>
                            {fmtVnd(m.threshold)}
                          </div>
                          {reached && (
                            <div className="ach-ms-desc">{isKo ? m.desc_ko : m.desc_vi}</div>
                          )}
                        </div>

                        <div className="ach-ms-action">
                          {canClaim ? (
                            <button
                              type="button"
                              className="ach-claim-btn"
                              style={{ background: m.bgColor, color: m.color, borderColor: `${m.color}44` }}
                              onClick={() => handleClaim(m)}
                            >
                              <Gift size={13} />
                              {isKo ? '열기' : 'Mở'}
                            </button>
                          ) : isClaimed ? (
                            <span className="ach-status-chip ach-status-chip--done">✅</span>
                          ) : reached ? (
                            <span className="ach-status-chip ach-status-chip--done">✅</span>
                          ) : (
                            <span className="ach-status-chip">🔒</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>{/* /ach-map-wrap */}
            </div>

            {/* Footer hint */}
            <p className="ach-footer-hint">
              {isKo
                ? '💡 총 수입은 앱에 입력한 모든 근무 기록을 기반으로 계산됩니다.'
                : '💡 Tổng tích lũy được tính từ toàn bộ ca làm đã nhập trong ứng dụng.'}
            </p>
          </div>
  );

  const giftModal = giftMilestone ? (
    <GiftModal
      milestone={giftMilestone}
      isKo={isKo}
      onClose={() => setGiftMilestone(null)}
      onClaim={handleGiftCollect}
    />
  ) : null;

  if (inline) {
    return (
      <>
        {bodyContent}
        {giftModal}
      </>
    );
  }

  return createPortal(
    <>
      <div className="ach-overlay" onClick={onClose}>
        <div className="ach-sheet" onClick={e => e.stopPropagation()}>
          <div className="ach-drag-bar" />
          <div className="ach-header">
            <div className="ach-header-left">
              <Map size={18} />
              <span>{isKo ? '나의 여정' : 'Hành Trình Của Tôi'}</span>
              {unclaimedCount > 0 && <span className="ach-unclaimed-badge">{unclaimedCount}</span>}
            </div>
            <button type="button" className="ach-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          {bodyContent}
        </div>
      </div>
      {giftModal}
    </>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────
// Entry Banner (rendered inside HomeScreen)
// ─────────────────────────────────────────────────────

export function AchievementBanner({
  isKo = false,
  onClick,
  allShifts,
  rateValue,
}: {
  isKo?: boolean;
  onClick: () => void;
  allShifts: { id: string; [key: string]: unknown }[];
  rateValue: number;
}) {
  const totalVnd = useMemo(() => {
    return allShifts.reduce((sum, s) => {
      const { total } = calculateShiftPay(s as Parameters<typeof calculateShiftPay>[0]);
      return sum + total * rateValue;
    }, 0);
  }, [allShifts, rateValue]);

  const stage = useMemo(() => {
    return [...CHARACTER_STAGES].reverse().find(s => totalVnd >= s.threshold) ?? CHARACTER_STAGES[0];
  }, [totalVnd]);

  const nextMilestone = useMemo(() => MILESTONES.find(m => totalVnd < m.threshold) ?? null, [totalVnd]);

  const progressPct = useMemo(() => {
    if (!nextMilestone) return 100;
    const idx = MILESTONES.indexOf(nextMilestone);
    const prevThreshold = idx > 0 ? MILESTONES[idx - 1].threshold : 0;
    const range = nextMilestone.threshold - prevThreshold;
    const done = Math.max(0, totalVnd - prevThreshold);
    return Math.min(100, (done / range) * 100);
  }, [totalVnd, nextMilestone]);

  const unclaimedCount = useMemo(() => {
    const claimed = loadClaimed(null);
    return MILESTONES.filter(m => totalVnd >= m.threshold && !claimed.includes(m.key)).length;
  }, [totalVnd]);

  return (
    <button type="button" className="ach-banner" onClick={onClick}>
      <img src={`/icon/${stage.imgKey}.png`} alt={stage.name_vi} className="ach-banner-char-img" />
      <div className="ach-banner-body">
        <div className="ach-banner-top">
          <span className="ach-banner-name">{isKo ? stage.name_ko : stage.name_vi}</span>
          {unclaimedCount > 0 && (
            <span className="ach-banner-dot">{unclaimedCount} {isKo ? '개 선물' : 'quà'}</span>
          )}
        </div>
        {nextMilestone ? (
          <>
            <div className="ach-banner-track">
              <div
                className="ach-banner-fill"
                style={{ width: `${progressPct}%`, background: nextMilestone.color }}
              />
            </div>
            <div className="ach-banner-sub">
              {nextMilestone.emoji} {isKo ? nextMilestone.label_ko : nextMilestone.label_vi} — {Math.round(progressPct)}%
            </div>
          </>
        ) : (
          <div className="ach-banner-sub">🏆 {isKo ? '모든 목표 달성!' : 'Đã chinh phục tất cả!'}</div>
        )}
      </div>
      <ChevronRight size={16} className="ach-banner-arrow" />
    </button>
  );
}
