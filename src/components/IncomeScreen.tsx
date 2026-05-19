import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
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
  ShieldCheck,
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
  CalendarCheck,
  type LucideIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { calculateShiftPay } from '../lib/salary';
import type { CurrencyMode, Expense, RateState, Shift, VenueColors } from '../lib/types';
import { formatCurrencyFlowAmount } from '../lib/currency';
import { DateWheelModal } from './shared/DateWheelModal';
import { getVenueColor, shiftMonth, formatHoursCompact } from '../utils/helpers';
import { localDateStr } from '../lib/localDate';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

// ── Companion / mascot helpers (synced with AchievementScreen) ──
const COMPANION_STORAGE_KEY = 'duhoc-mate-ach-companion';
const COMPANION_CHANGE_EVENT = 'duhoc-mate-ach-companion-change';
const COMPANION_IMG_MAP: Record<string, string> = {
  hamster: 'companion_hamster',
  cat: 'companion_cat',
  bunny: 'companion_bunny',
  bear: 'companion_bear',
  fox: 'companion_fox',
  star: 'companion_star',
};
const CHARACTER_STAGE_THRESHOLDS: Array<{ threshold: number; imgKey: string }> = [
  { threshold: 200_000_000, imgKey: 'hamster_home' },
  { threshold: 150_000_000, imgKey: 'hamster_rich' },
  { threshold: 80_000_000,  imgKey: 'hamster_office' },
  { threshold: 35_000_000,  imgKey: 'hamster_student' },
  { threshold: 10_000_000,  imgKey: 'hamster_normal' },
  { threshold: 1_000_000,   imgKey: 'hamster_baby' },
  { threshold: 0,           imgKey: 'hamster_egg' },
];

const incomeExpenseCategories = new Set<Expense['category']>(['juhyu_income', 'other_income']);

function isIncomeEntry(expense: Pick<Expense, 'category' | 'type'>) {
  return expense.type === 'thu' || incomeExpenseCategories.has(expense.category);
}

function resolveStageImgKey(shifts: Shift[], expenses: Expense[], rateValue: number): string {
  const grossKrw = shifts.reduce((sum, s) => sum + calculateShiftPay(s).total, 0);
  const flowKrw = expenses.reduce((sum, e) => sum + (isIncomeEntry(e) ? e.amount : -e.amount), 0);
  const totalVnd = Math.max(0, grossKrw + flowKrw) * rateValue;
  return (CHARACTER_STAGE_THRESHOLDS.find(s => totalVnd >= s.threshold) ?? CHARACTER_STAGE_THRESHOLDS[CHARACTER_STAGE_THRESHOLDS.length - 1]).imgKey;
}

function useShareMascotImgKey(shifts: Shift[], expenses: Expense[], rateValue: number): string {
  const getKey = () => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(COMPANION_STORAGE_KEY) : null;
    return stored ?? 'journey';
  };
  const [companionKey, setCompanionKey] = useState(getKey);

  useEffect(() => {
    const sync = () => setCompanionKey(getKey());
    const syncCustom = (e: Event) => setCompanionKey((e as CustomEvent<string>).detail ?? 'journey');
    window.addEventListener('storage', sync);
    window.addEventListener(COMPANION_CHANGE_EVENT, syncCustom);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(COMPANION_CHANGE_EVENT, syncCustom);
    };
  }, []);

  const imgKey = COMPANION_IMG_MAP[companionKey] ?? resolveStageImgKey(shifts, expenses, rateValue);
  return `/icon/${imgKey}.png`;
}

type AppLang = 'vi' | 'ko';
type IncomeTab = 'overview' | 'expenses' | 'insurance' | 'juhyu';
type ChartViewMode = 'day' | 'week' | 'month';
type IconComponent = LucideIcon;

const incomeTabs: Array<{ id: IncomeTab; icon: IconComponent }> = [
  { id: 'overview', icon: BarChart3 },
  { id: 'expenses', icon: ReceiptText },
  { id: 'insurance', icon: ShieldCheck },
  { id: 'juhyu', icon: CalendarCheck },
];

// ─── Insurance 4대보험 ────────────────────────────────────────
interface InsuranceRecord {
  id: string;
  month: string;           // 'YYYY-MM'
  workplaceLabel: string;
  workStartDate: string;   // 'YYYY-MM-DD'
  payDate: string;         // 'YYYY-MM-DD'
  baseSalary: number;      // KRW
  insuranceType: '2' | 'partial' | '4';
  // Rates stored as % values (e.g. 3.545, not 0.03545) — user-editable
  healthRate: number;
  longCareRate: number;    // applied to healthAmt
  pensionRate: number;
  employmentRate: number;
  // Computed/editable KRW amounts
  healthAmt: number;
  longCareAmt: number;
  pensionAmt: number;      // 0 if '2'
  employmentAmt: number;   // 0 if '2'
  confirmed: boolean;
  note: string;
}
type InsFormField = 'workStartDate' | 'payDate';

const INS_STORAGE_KEY = 'duhoc-mate-insurance';
// Default 2025-2026 rates as %-values (employee share)
const INS_RATES = { health: 3.545, longCare: 12.95, pension: 4.5, employment: 0.9 };

function calcIns(
  base: number,
  type: '2' | 'partial' | '4',
  rates?: { health?: number; longCare?: number; pension?: number; employment?: number },
) {
  const h  = rates?.health      ?? INS_RATES.health;
  const lc = rates?.longCare    ?? INS_RATES.longCare;
  const p  = rates?.pension     ?? INS_RATES.pension;
  const e  = rates?.employment  ?? INS_RATES.employment;
  if (type === '4') {
    // Làm đủ tháng: đóng đủ 4 loại
    const healthAmt     = Math.round(base * h / 100);
    const longCareAmt   = Math.round(healthAmt * lc / 100);
    const pensionAmt    = Math.round(base * p / 100);
    const employmentAmt = Math.round(base * e / 100);
    return { healthAmt, longCareAmt, pensionAmt, employmentAmt };
  } else if (type === 'partial') {
    // Nghỉ giữa tháng (상실): 국민연금 + 건강보험 + 장기요양 KHÔNG tính.
    // Chỉ đóng 고용보험 (0.9%) dựa trên thu nhập thực tế tháng đó.
    const employmentAmt = Math.round(base * e / 100);
    return { healthAmt: 0, longCareAmt: 0, pensionAmt: 0, employmentAmt };
  } else {
    // 2 loại: chỉ 건강보험 + 장기요양 (lao động ngắn hạn không đủ điều kiện 국민연금/고용보험)
    const healthAmt   = Math.round(base * h / 100);
    const longCareAmt = Math.round(healthAmt * lc / 100);
    return { healthAmt, longCareAmt, pensionAmt: 0, employmentAmt: 0 };
  }
}

function insTotal(rec: Pick<InsuranceRecord, 'healthAmt' | 'longCareAmt' | 'pensionAmt' | 'employmentAmt'>) {
  return rec.healthAmt + rec.longCareAmt + rec.pensionAmt + rec.employmentAmt;
}

function loadInsRecords(): InsuranceRecord[] {
  try {
    const raw = window.localStorage.getItem(INS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InsuranceRecord[]) : [];
  } catch { return []; }
}
function saveInsRecords(records: InsuranceRecord[]) {
  window.localStorage.setItem(INS_STORAGE_KEY, JSON.stringify(records));
}
function insToRow(rec: InsuranceRecord, userId: string) {
  return {
    id: rec.id,
    user_id: userId,
    month: rec.month,
    workplace_label: rec.workplaceLabel,
    work_start_date: rec.workStartDate,
    pay_date: rec.payDate,
    base_salary: rec.baseSalary,
    insurance_type: rec.insuranceType,
    health_rate: rec.healthRate,
    long_care_rate: rec.longCareRate,
    pension_rate: rec.pensionRate,
    employment_rate: rec.employmentRate,
    health_amt: rec.healthAmt,
    long_care_amt: rec.longCareAmt,
    pension_amt: rec.pensionAmt,
    employment_amt: rec.employmentAmt,
    confirmed: rec.confirmed,
    note: rec.note,
    updated_at: new Date().toISOString(),
  };
}
function rowToIns(row: any): InsuranceRecord {
  return {
    id: row.id,
    month: row.month ?? '',
    workplaceLabel: row.workplace_label ?? '',
    workStartDate: row.work_start_date ?? localDateStr(),
    payDate: row.pay_date ?? localDateStr(),
    baseSalary: Number(row.base_salary) || 0,
    insuranceType: (row.insurance_type ?? '4') as InsuranceRecord['insuranceType'],
    healthRate: Number(row.health_rate) || 0,
    longCareRate: Number(row.long_care_rate) || 0,
    pensionRate: Number(row.pension_rate) || 0,
    employmentRate: Number(row.employment_rate) || 0,
    healthAmt: Number(row.health_amt) || 0,
    longCareAmt: Number(row.long_care_amt) || 0,
    pensionAmt: Number(row.pension_amt) || 0,
    employmentAmt: Number(row.employment_amt) || 0,
    confirmed: row.confirmed === true,
    note: row.note ?? '',
  };
}
function useInsuranceRecords() {
  const session = useAppStore((s) => s.session);
  const online = useAppStore((s) => s.online);
  const [records, setRaw] = useState<InsuranceRecord[]>(loadInsRecords);
  const userId = session?.user.id;
  const syncOne = (rec: InsuranceRecord) => {
    if (!supabase || !userId || !online) return;
    void supabase.from('insurance_records').upsert(insToRow(rec, userId), { onConflict: 'id' });
  };
  useEffect(() => {
    if (!supabase || !userId || !online) return;
    let cancelled = false;
    supabase
      .from('insurance_records')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (cancelled) return;
        const remote = (data ?? []).map(rowToIns);
        const local = loadInsRecords();
        const remoteIds = new Set(remote.map((r) => r.id));
        const merged = [...remote, ...local.filter((r) => !remoteIds.has(r.id))];
        saveInsRecords(merged);
        setRaw(merged);
        local.filter((r) => !remoteIds.has(r.id)).forEach((rec) => syncOne(rec));
      });
    return () => { cancelled = true; };
  }, [online, userId]);
  const set = (next: InsuranceRecord[]) => { saveInsRecords(next); setRaw(next); };
  const add = (rec: Omit<InsuranceRecord, 'id'>) => {
    const r = { ...rec, id: `ins-${Date.now()}-${Math.random().toString(16).slice(2)}` };
    set([...loadInsRecords(), r]);
    syncOne(r);
    return r;
  };
  const update = (id: string, patch: Partial<InsuranceRecord>) => {
    const next = loadInsRecords().map(r => r.id === id ? { ...r, ...patch } : r);
    set(next);
    const updated = next.find((r) => r.id === id);
    if (updated) syncOne(updated);
  };
  const remove = (id: string) => {
    set(loadInsRecords().filter(r => r.id !== id));
    if (supabase && userId && online) void supabase.from('insurance_records').delete().eq('id', id).eq('user_id', userId);
  };
  return { records, add, update, remove };
}

// ─── 주휴수당 ────────────────────────────────────────────────────
interface JuhyuWeek {
  weekStart: string;    // YYYY-MM-DD (Monday T2)
  weekEnd: string;      // YYYY-MM-DD (Sunday CN)
  weeklyHours: number;  // actual hours worked at this workplace this week
  workDays: number;     // actual days worked this week
  juhyuHours: number;   // weeklyHours / workDays
  qualifies: boolean;   // full Mon-Sun AND weeklyHours >= 15
  amount: number;
}

interface JuhyuRecord {
  id: string;
  month: string;              // 'YYYY-MM'
  workplaceLabel: string;
  startDate: string;          // 'YYYY-MM-DD'
  endDate: string;            // 'YYYY-MM-DD'
  hourlyRate: number;         // 시급 ₩
  juhyuHoursPerWeek: number;  // avg across qualifying weeks
  juhyuPerWeek: number;       // avg weekly amount
  juhyuPerMonth: number;      // sum of qualifying week amounts
  weeks: JuhyuWeek[];
  qualifies: boolean;         // at least one qualifying week
  confirmed: boolean;
  note: string;
}

const JUHYU_STORAGE_KEY = 'duhoc-mate-juhyu';

// Compute week-by-week breakdown from actual shift calendar data (T2→CN).
// Includes partial weeks at start/end — only checks hours >= 15, not full-week requirement.
function calcJuhyuWeeksFromShifts(
  startDate: string,
  endDate: string,
  workplaceLabel: string,
  shifts: Shift[],
  hourlyRate: number,
): JuhyuWeek[] {
  // Use local date formatting — toISOString() returns UTC and shifts the date in UTC+7/+9
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sd = new Date(startDate + 'T00:00:00');
  const ed = new Date(endDate + 'T00:00:00');

  // Find the Monday (T2) of the week that contains startDate (go back if needed)
  let mon = new Date(sd);
  const dow = mon.getDay(); // 0=CN,1=T2...6=T7
  if (dow !== 1) mon.setDate(mon.getDate() - (dow === 0 ? 6 : dow - 1));

  const weeks: JuhyuWeek[] = [];

  while (mon <= ed) {
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);

    const weekStartStr = fmt(mon);
    const weekEndStr = fmt(sun);

    // Only count shifts within [startDate, endDate] — partial weeks at edges are OK
    const effectiveFrom = weekStartStr < startDate ? startDate : weekStartStr;
    const effectiveTo   = weekEndStr   > endDate   ? endDate   : weekEndStr;

    const weekShifts = shifts.filter(s => {
      const matchLabel = workplaceLabel ? s.label === workplaceLabel : true;
      return matchLabel && s.date >= effectiveFrom && s.date <= effectiveTo;
    });

    const weeklyHours = weekShifts.reduce((sum, s) => sum + calculateShiftPay(s).hours, 0);
    const workDays = new Set(weekShifts.map(s => s.date)).size;
    const juhyuHours = workDays > 0 ? weeklyHours / workDays : 0;
    const qualifies = weeklyHours >= 15;  // only hours matter, not full-week
    const amount = qualifies ? Math.round(juhyuHours * hourlyRate) : 0;

    weeks.push({ weekStart: weekStartStr, weekEnd: weekEndStr, weeklyHours, workDays, juhyuHours, qualifies, amount });

    mon = new Date(mon);
    mon.setDate(mon.getDate() + 7);
  }
  return weeks;
}

function buildJuhyuCalc(weeks: JuhyuWeek[], hourlyRate: number) {
  const qualifying = weeks.filter(w => w.qualifies);
  const qualifies = qualifying.length > 0;
  const juhyuPerMonth = weeks.reduce((s, w) => s + w.amount, 0);
  const juhyuHoursPerWeek = qualifying.length > 0
    ? qualifying.reduce((s, w) => s + w.juhyuHours, 0) / qualifying.length : 0;
  const juhyuPerWeek = qualifying.length > 0
    ? Math.round(juhyuHoursPerWeek * hourlyRate) : 0;
  return { qualifies, juhyuHoursPerWeek, juhyuPerWeek, juhyuPerMonth, weeks };
}

function loadJuhyuRecords(): JuhyuRecord[] {
  try {
    const raw = window.localStorage.getItem(JUHYU_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as JuhyuRecord[]) : [];
  } catch { return []; }
}
function saveJuhyuRecords(records: JuhyuRecord[]) {
  window.localStorage.setItem(JUHYU_STORAGE_KEY, JSON.stringify(records));
}
function juhyuToRow(rec: JuhyuRecord, userId: string) {
  return {
    id: rec.id,
    user_id: userId,
    month: rec.month,
    workplace_label: rec.workplaceLabel,
    start_date: rec.startDate,
    end_date: rec.endDate,
    hourly_rate: rec.hourlyRate,
    juhyu_hours_per_week: rec.juhyuHoursPerWeek,
    juhyu_per_week: rec.juhyuPerWeek,
    juhyu_per_month: rec.juhyuPerMonth,
    weeks: rec.weeks,
    qualifies: rec.qualifies,
    confirmed: rec.confirmed,
    note: rec.note,
    updated_at: new Date().toISOString(),
  };
}
function rowToJuhyu(row: any): JuhyuRecord {
  return {
    id: row.id,
    month: row.month ?? '',
    workplaceLabel: row.workplace_label ?? '',
    startDate: row.start_date ?? localDateStr(),
    endDate: row.end_date ?? localDateStr(),
    hourlyRate: Number(row.hourly_rate) || 0,
    juhyuHoursPerWeek: Number(row.juhyu_hours_per_week) || 0,
    juhyuPerWeek: Number(row.juhyu_per_week) || 0,
    juhyuPerMonth: Number(row.juhyu_per_month) || 0,
    weeks: Array.isArray(row.weeks) ? row.weeks : [],
    qualifies: row.qualifies === true,
    confirmed: row.confirmed === true,
    note: row.note ?? '',
  };
}
function useJuhyuRecords() {
  const session = useAppStore((s) => s.session);
  const online = useAppStore((s) => s.online);
  const [records, setRaw] = useState<JuhyuRecord[]>(loadJuhyuRecords);
  const userId = session?.user.id;
  const syncOne = (rec: JuhyuRecord) => {
    if (!supabase || !userId || !online) return;
    void supabase.from('juhyu_records').upsert(juhyuToRow(rec, userId), { onConflict: 'id' });
  };
  useEffect(() => {
    if (!supabase || !userId || !online) return;
    let cancelled = false;
    supabase
      .from('juhyu_records')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (cancelled) return;
        const remote = (data ?? []).map(rowToJuhyu);
        const local = loadJuhyuRecords();
        const remoteIds = new Set(remote.map((r) => r.id));
        const merged = [...remote, ...local.filter((r) => !remoteIds.has(r.id))];
        saveJuhyuRecords(merged);
        setRaw(merged);
        local.filter((r) => !remoteIds.has(r.id)).forEach((rec) => syncOne(rec));
      });
    return () => { cancelled = true; };
  }, [online, userId]);
  const set = (next: JuhyuRecord[]) => { saveJuhyuRecords(next); setRaw(next); };
  const add = (rec: Omit<JuhyuRecord, 'id'>) => {
    const r = { ...rec, id: `juhyu-${Date.now()}-${Math.random().toString(16).slice(2)}` };
    set([...loadJuhyuRecords(), r]);
    syncOne(r);
    return r;
  };
  const update = (id: string, patch: Partial<JuhyuRecord>) => {
    const next = loadJuhyuRecords().map(r => r.id === id ? { ...r, ...patch } : r);
    set(next);
    const updated = next.find((r) => r.id === id);
    if (updated) syncOne(updated);
  };
  const remove = (id: string) => {
    set(loadJuhyuRecords().filter(r => r.id !== id));
    if (supabase && userId && online) void supabase.from('juhyu_records').delete().eq('id', id).eq('user_id', userId);
  };
  return { records, add, update, remove };
}

const categoryMeta: Record<Expense['category'], { label: string; icon: any; tone: string; entryType: 'thu' | 'chi' }> = {
  rent:           { label: 'Tiền nhà',      icon: Home,         tone: 'blue',    entryType: 'chi' },
  phone:          { label: 'Điện thoại',    icon: Smartphone,   tone: 'green',   entryType: 'chi' },
  food:           { label: 'Ăn uống',       icon: Utensils,     tone: 'orange',  entryType: 'chi' },
  transport:      { label: 'Di chuyển',     icon: Bus,          tone: 'purple',  entryType: 'chi' },
  shopping:       { label: 'Mua sắm',       icon: ShoppingBag,  tone: 'pink',    entryType: 'chi' },
  health:         { label: 'Sức khỏe',      icon: HeartPulse,   tone: 'red',     entryType: 'chi' },
  entertainment:  { label: 'Giải trí',      icon: Music,        tone: 'cyan',    entryType: 'chi' },
  other:          { label: 'Khác',          icon: ReceiptText,  tone: 'gray',    entryType: 'chi' },
  juhyu_income:   { label: '주휴수당',       icon: CalendarCheck, tone: 'emerald', entryType: 'thu' },
  other_income:   { label: 'Thu nhập khác', icon: TrendingUp,   tone: 'emerald', entryType: 'thu' },
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

function makeSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const controlX = prev.x + (point.x - prev.x) / 2;
    return `${path} C ${controlX} ${prev.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

function profileLine(isKo: boolean, saveRatio: number) {
  if (saveRatio >= 70) return isKo ? '저축력이 아주 좋아요.' : 'Giữ tiền quá ổn, rất đáng tự hào.';
  if (saveRatio >= 40) return isKo ? '좋은 리듬으로 가고 있어요.' : 'Nhịp làm và giữ tiền đang rất đẹp.';
  if (saveRatio > 0) return isKo ? '이번 달도 한 걸음 더 갔어요.' : 'Tháng này vẫn tiến thêm một bước.';
  return isKo ? '기록을 시작한 것만으로도 좋아요.' : 'Bắt đầu ghi lại đã là một bước tốt.';
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
  currencyMode,
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
  currencyMode: CurrencyMode;
}) {
  const isKo = lang === 'ko';
  const locale = isKo ? 'ko-KR' : 'vi-VN';
  const ui = isKo ? {
    tabs: { overview: '요약', expenses: '지출', insurance: '보험', juhyu: '주휴' },
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
    expenseManage: '수입/지출 관리',
    expenseRecords: '가계부',
    addExpense: '항목 추가',
    category: '카테고리',
    amount: '금액',
    expenseDate: '날짜',
    note: '메모',
    notePlaceholder: '예: 이번 주 식비',
    saveExpense: '저장',
    noExpense: '기록된 내역이 없습니다',
    noExpenseHint: '주휴수당, 월세, 식비를 기록해 순수입을 정확히 파악하세요.',
    thuLabel: '수입',
    chiLabel: '지출',
    addThu: '수입 추가',
    addChi: '지출 추가',
    workplace: '근무지',
    byIncome: '수입순 정렬',
    noWorkplace: '근무지가 없습니다',
    noWorkplaceHint: '캘린더에 근무를 추가하면 근무지별로 자동 집계됩니다.',
    deleteExpense: '지출 삭제',
    shifts: '회',
    insTitle: '4대보험 관리',
    insSubtitle: '월별 보험료를 계산하고 지출에 반영하세요.',
    insAdd: '이번 달 보험료 확인',
    insType2: '2가지',
    insTypePartial: '중도 퇴사',
    insType4: '풀 1달',
    insWorkplace: '근무지 (선택)',
    insStartDate: '근무 시작일',
    insPayDate: '급여일',
    insSalaryBase: '해당 급여 (₩)',
    insHealth: '건강보험',
    insLongCare: '장기요양',
    insPension: '국민연금',
    insEmployment: '고용보험',
    insTotal: '납부 예상액',
    insConfirm: '확인 — 지출에 반영',
    insConfirmed: '지출에 반영됨',
    insNote: '메모',
    insSave: '저장',
    insCancel: '취소',
    insDelete: '삭제',
    insEdit: '수정',
    insEmpty: '이달 보험료 기록 없음',
    insEmptyHint: '보험료를 추가하면 월별 순수입에 자동 반영됩니다.',
    insExpenseNote: (type: string) => `4대보험 (${type === '4' ? '전체 4가지' : type === 'partial' ? '고용보험만 · 중도퇴사' : '건강+장기요양'})`,
    juhyuTitle: '주휴수당 관리',
    juhyuSubtitle: '주 15시간 이상 근무 시 받을 수 있는 유급 주휴수당을 확인하세요.',
    juhyuAdd: '이번 달 주휴수당 계산',
    juhyuWorkplace: '근무지 (선택)',
    juhyuWeeklyHours: '주 소정근로시간 (시간)',
    juhyuWorkDays: '주 근무일수',
    juhyuHourlyRate: '시급 (₩)',
    juhyuPayDate: '급여일',
    juhyuNote: '메모',
    juhyuTotal: '월 주휴수당 예상',
    juhyuPerWeek: '주당',
    juhyuConfirm: '받은 것으로 확인',
    juhyuConfirmed: '수령 확인됨',
    juhyuEmpty: '이달 주휴수당 기록 없음',
    juhyuEmptyHint: '주 근무 정보를 추가하면 주휴수당을 자동 계산해드려요.',
    juhyuWarn15h: '주 15시간 미만 — 주휴수당 미해당',
    juhyuQualifies: '주휴수당 해당',
  } : {
    tabs: { overview: 'Tổng quan', expenses: 'Thu chi', insurance: 'Bảo hiểm', juhyu: '주휴' },
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
    expenseManage: 'Quản lý thu chi',
    expenseRecords: 'Sổ thu chi',
    addExpense: 'Thêm mục',
    category: 'Hạng mục',
    amount: 'Số tiền',
    expenseDate: 'Ngày',
    note: 'Ghi chú',
    notePlaceholder: 'Ví dụ: tiền ăn tuần này',
    saveExpense: 'Lưu',
    noExpense: 'Chưa có thu chi',
    noExpenseHint: 'Ghi 주휴수당, tiền nhà, ăn uống để biết thu nhập ròng chính xác.',
    thuLabel: 'Thu nhập',
    chiLabel: 'Chi tiêu',
    addThu: 'Thêm thu nhập',
    addChi: 'Thêm chi tiêu',
    workplace: 'Nơi làm',
    byIncome: 'Xếp theo thu nhập',
    noWorkplace: 'Chưa có nơi làm',
    noWorkplaceHint: 'Thêm ca làm trong lịch để app tự tổng hợp theo từng nơi.',
    deleteExpense: 'Xóa chi tiêu',
    shifts: 'ca',
    insTitle: 'Quản lý bảo hiểm 4대보험',
    insSubtitle: 'Tính tiền bảo hiểm theo tháng và tự động trừ vào chi tiêu.',
    insAdd: 'Kiểm tra bảo hiểm tháng này',
    insType2: '2 loại',
    insTypePartial: 'Nghỉ giữa tháng',
    insType4: 'Làm đủ tháng',
    insWorkplace: 'Nơi làm (không bắt buộc)',
    insStartDate: 'Ngày bắt đầu làm',
    insPayDate: 'Ngày nhận lương',
    insSalaryBase: 'Lương tương ứng (₩)',
    insHealth: '건강보험',
    insLongCare: '장기요양',
    insPension: '국민연금',
    insEmployment: '고용보험',
    insTotal: 'Tổng phải đóng',
    insConfirm: 'Xác nhận — trừ vào Chi tiêu',
    insConfirmed: 'Đã trừ vào Chi tiêu',
    insNote: 'Ghi chú',
    insSave: 'Lưu',
    insCancel: 'Hủy',
    insDelete: 'Xóa',
    insEdit: 'Sửa',
    insEmpty: 'Chưa có khai bảo hiểm tháng này',
    insEmptyHint: 'Thêm khai bảo hiểm để tự động trừ vào thu nhập ròng.',
    insExpenseNote: (type: string) => `Bảo hiểm 4대보험 (${type === '4' ? 'đủ 4 loại' : type === 'partial' ? 'chỉ 고용 · nghỉ giữa tháng' : '건강+장기요양'})`,
    juhyuTitle: 'Quản lý 주휴수당',
    juhyuSubtitle: 'Làm ≥ 15h/tuần? Bạn được hưởng phụ cấp ngày nghỉ. Tính toán và kiểm tra ở đây.',
    juhyuAdd: 'Tính 주휴수당 tháng này',
    juhyuWorkplace: 'Nơi làm (không bắt buộc)',
    juhyuWeeklyHours: 'Giờ làm mỗi tuần',
    juhyuWorkDays: 'Số ngày làm/tuần',
    juhyuHourlyRate: 'Lương giờ (₩)',
    juhyuPayDate: 'Ngày nhận lương',
    juhyuNote: 'Ghi chú',
    juhyuTotal: 'Dự kiến nhận/tháng',
    juhyuPerWeek: '/tuần',
    juhyuConfirm: 'Xác nhận đã nhận',
    juhyuConfirmed: 'Đã nhận',
    juhyuEmpty: 'Chưa có tính toán 주휴수당',
    juhyuEmptyHint: 'Thêm để biết bạn có đang nhận đủ lương hay không.',
    juhyuWarn15h: 'Dưới 15h/tuần — không đủ điều kiện',
    juhyuQualifies: 'Đủ điều kiện nhận',
  };
  const categoryLabels: Record<Expense['category'], string> = isKo ? {
    rent: '월세', phone: '통신비', food: '식비', transport: '교통비',
    shopping: '쇼핑', health: '건강', entertainment: '여가', other: '기타',
    juhyu_income: '주휴수당', other_income: '기타 수입',
  } : {
    rent: 'Tiền nhà', phone: 'Điện thoại', food: 'Ăn uống', transport: 'Di chuyển',
    shopping: 'Mua sắm', health: 'Sức khỏe', entertainment: 'Giải trí', other: 'Khác',
    juhyu_income: '주휴수당', other_income: 'Thu nhập khác',
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
  const [showShareCard, setShowShareCard] = useState(false);
  const [isExportingShare, setIsExportingShare] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareCardTitle, setShareCardTitle] = useState('');
  const [shareCardFooter, setShareCardFooter] = useState('');
  const [editingShareField, setEditingShareField] = useState<'title' | 'footer' | null>(null);
  const shareMascotSrc = useShareMascotImgKey(shifts, expenses, rate.value);
  const [expenseForm, setExpenseForm] = useState<Omit<Expense, 'id'>>({
    category: 'food',
    amount: 0,
    date: localDateStr(),
    note: '',
    type: 'chi',
  });
  const prevTotalRef = useRef<number | null>(null);

  // ── Insurance tab state (moved below memoized values — see further down) ──
  const { records: allInsRecords, add: addInsRecord, update: updateInsRecord, remove: removeInsRecord } = useInsuranceRecords();
  const [isAddingIns, setIsAddingIns] = useState(false);
  const [editingInsId, setEditingInsId] = useState<string | null>(null);
  const [expandedInsId, setExpandedInsId] = useState<string | null>(null);
  const [insDatePickerField, setInsDatePickerField] = useState<InsFormField | null>(null);
  const todayStr = localDateStr();
  // insForm initialised with safe zero-defaults; populated in the "Add" click handler
  const [insForm, setInsForm] = useState<Omit<InsuranceRecord, 'id'>>({
    month: '',
    workplaceLabel: '',
    workStartDate: todayStr,
    payDate: todayStr,
    baseSalary: 0,
    insuranceType: '4',
    healthRate: INS_RATES.health,
    longCareRate: INS_RATES.longCare,
    pensionRate: INS_RATES.pension,
    employmentRate: INS_RATES.employment,
    healthAmt: 0,
    longCareAmt: 0,
    pensionAmt: 0,
    employmentAmt: 0,
    confirmed: false,
    note: '',
  });

  // ── 주휴수당 tab state ──
  const { records: allJuhyuRecords, add: addJuhyuRecord, update: updateJuhyuRecord, remove: removeJuhyuRecord } = useJuhyuRecords();
  const [isAddingJuhyu, setIsAddingJuhyu] = useState(false);
  const [editingJuhyuId, setEditingJuhyuId] = useState<string | null>(null);
  const [expandedJuhyuId, setExpandedJuhyuId] = useState<string | null>(null);
  const [juhyuDatePickerField, setJuhyuDatePickerField] = useState<'startDate' | 'endDate' | null>(null);
  const [juhyuForm, setJuhyuForm] = useState<Omit<JuhyuRecord, 'id'>>({
    month: '',
    workplaceLabel: '',
    startDate: todayStr,
    endDate: todayStr,
    hourlyRate: 10320,
    juhyuHoursPerWeek: 0,
    juhyuPerWeek: 0,
    juhyuPerMonth: 0,
    weeks: [],
    qualifies: false,
    confirmed: false,
    note: '',
  });

  function applyJuhyuCalc(patch: Partial<Omit<JuhyuRecord, 'id'>>) {
    setJuhyuForm(f => {
      const merged = { ...f, ...patch };
      const weeks = calcJuhyuWeeksFromShifts(
        merged.startDate, merged.endDate, merged.workplaceLabel, shifts, merged.hourlyRate,
      );
      return { ...merged, ...buildJuhyuCalc(weeks, merged.hourlyRate) };
    });
  }

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
    return formatCurrencyFlowAmount(val, currencyMode, rate.value, isVnd).text;
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
  const weekdayHours = useMemo(
    () =>
      weekdayLabels.map((_, index) =>
        currentWeekShifts
          .filter((shift) => {
            const day = new Date(`${shift.date}T00:00:00`).getDay();
            return (day + 6) % 7 === index;
          })
          .reduce((sum, shift) => sum + calculateShiftPay(shift).hours, 0)
      ),
    [currentWeekShifts]
  );

  const totalIncomeEntries = useMemo(
    () => monthExpenses.filter(isIncomeEntry).reduce((sum, expense) => sum + expense.amount, 0),
    [monthExpenses]
  );
  const totalExpenses = useMemo(
    () => monthExpenses.filter((expense) => !isIncomeEntry(expense)).reduce((sum, expense) => sum + expense.amount, 0),
    [monthExpenses]
  );
  const netBalance = monthlyTotal + totalIncomeEntries - totalExpenses;
  const saveRatio = monthlyTotal > 0 ? Math.max(0, Math.min(100, (netBalance / monthlyTotal) * 100)) : 0;
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

  const monthInsRecords = useMemo(
    () => allInsRecords.filter(r => r.month === selectedMonthKey),
    [allInsRecords, selectedMonthKey]
  );

  const monthJuhyuRecords = useMemo(
    () => allJuhyuRecords.filter(r => r.month === selectedMonthKey),
    [allJuhyuRecords, selectedMonthKey]
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

  const monthlyFlowChartData = useMemo(() => {
    const results = Array.from({ length: chartDaysInMonth }, (_, index) => ({
      day: index + 1,
      income: 0,
      expense: 0,
      incomeDelta: 0,
      expenseDelta: 0,
    }));

    monthShifts.forEach((shift) => {
      const day = new Date(`${shift.date}T00:00:00`).getDate();
      if (day >= 1 && day <= chartDaysInMonth) {
        results[day - 1].incomeDelta += calculateShiftPay(shift).total;
      }
    });

    monthExpenses.forEach((expense) => {
      const day = new Date(`${expense.date}T00:00:00`).getDate();
      if (day < 1 || day > chartDaysInMonth) return;
      if (isIncomeEntry(expense)) {
        results[day - 1].incomeDelta += expense.amount;
      } else {
        results[day - 1].expenseDelta += expense.amount;
      }
    });

    let incomeRunning = 0;
    let expenseRunning = 0;
    return results.map((item) => {
      incomeRunning += item.incomeDelta;
      expenseRunning += item.expenseDelta;
      return { ...item, income: incomeRunning, expense: expenseRunning };
    });
  }, [chartDaysInMonth, monthExpenses, monthShifts]);

  const maxMonthlyFlow = useMemo(
    () => Math.max(...monthlyFlowChartData.flatMap((item) => [item.income, item.expense]), 1),
    [monthlyFlowChartData]
  );

  const monthlyFlowGeometry = useMemo(() => {
    const toPoint = (value: number, index: number) => ({
      x: 20 + (index / Math.max(1, chartDaysInMonth - 1)) * 282,
      y: 108 - (value / maxMonthlyFlow) * 82,
    });
    const incomePoints = monthlyFlowChartData.map((item, index) => toPoint(item.income, index));
    const expensePoints = monthlyFlowChartData.map((item, index) => toPoint(item.expense, index));
    const incomeLine = makeSmoothPath(incomePoints);
    const expenseLine = makeSmoothPath(expensePoints);
    const areaBottom = 112;

    return {
      incomePoints,
      expensePoints,
      incomeLine,
      expenseLine,
      incomeArea: incomeLine ? `${incomeLine} L ${incomePoints[incomePoints.length - 1].x} ${areaBottom} L ${incomePoints[0].x} ${areaBottom} Z` : '',
      expenseArea: expenseLine ? `${expenseLine} L ${expensePoints[expensePoints.length - 1].x} ${areaBottom} L ${expensePoints[0].x} ${areaBottom} Z` : '',
    };
  }, [chartDaysInMonth, maxMonthlyFlow, monthlyFlowChartData]);

  const flowLabelDay = isCurrentViewMonth ? todayDayNumber : chartDaysInMonth;

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
      const endStr = dateToIso(end);
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
    if (val >= 1_000) return `${Math.round(val / 1000)}K`;
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
      category: expenseForm.type === 'thu' ? 'other_income' : 'food',
      amount: 0,
      date: localDateStr(),
      note: '',
      type: expenseForm.type ?? 'chi',
    });
    setIsAddingExpense(false);
  }

  async function handleExportShareCard() {
    if (!shareCardRef.current) return;
    setIsExportingShare(true);
    try {
      const el = shareCardRef.current;
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#eef6ff',
        width: el.offsetWidth,
        height: el.offsetHeight,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `duhoc-mate-${selectedMonthKey}-report.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error('Unable to export income share card:', error);
    } finally {
      setIsExportingShare(false);
    }
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
            <strong>{formatHoursCompact(monthlyHours)}</strong>
          </article>
        </div>
      </section>

      <section className={`income-share-report ${showShareCard ? 'open' : ''}`}>
        <div className="income-share-head">
          <div>
            <span>{isKo ? '공유 카드' : 'Báo cáo tháng này'}</span>
            <strong>{isKo ? '이번 달 기록을 예쁘게 저장' : 'Hãy lưu lại những khoảnh khắc đáng nhớ của tháng này!'}</strong>
          </div>
          <button type="button" onClick={() => {
            if (!showShareCard) {
              setShareCardTitle(isKo ? '이번 달도 잘 버텼어요' : 'Tháng này mình đã làm được');
              setShareCardFooter(profileLine(isKo, saveRatio));
              setEditingShareField(null);
            }
            setShowShareCard(v => !v);
          }}>
            {showShareCard ? (isKo ? '숨기기' : 'Ẩn') : (isKo ? '보기' : 'Xem')}
          </button>
        </div>
        {showShareCard && (
          <>
            <div className="income-share-card" ref={shareCardRef}>
              <div className="income-share-bg-orb one" />
              <div className="income-share-bg-orb two" />
              <div className="income-share-brand">
                <img src="/logo.png" alt="" />
                <span>Duhoc Mate</span>
              </div>
              <div className="income-share-mascot">
                <img src={shareMascotSrc} alt="" />
              </div>
              <p>{isKo ? `${chartMonthNumber}월 리포트` : `Báo cáo tháng ${chartMonthNumber}`}</p>
              <h3
                className={`income-share-editable${editingShareField === 'title' ? ' editing' : ''}`}
                onClick={() => setEditingShareField('title')}
                title={isKo ? '클릭하여 편집' : 'Nhấn để chỉnh sửa'}
              >
                {editingShareField === 'title' ? (
                  <input
                    autoFocus
                    value={shareCardTitle}
                    onChange={e => setShareCardTitle(e.target.value)}
                    onBlur={() => setEditingShareField(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingShareField(null); }}
                    onClick={e => e.stopPropagation()}
                    className="income-share-input"
                  />
                ) : (
                  <>{shareCardTitle}<Edit2 size={12} className="income-share-edit-icon" /></>
                )}
              </h3>
              <div className="income-share-total">{formatMoney(netBalance)}</div>
              <div className="income-share-grid">
                <div>
                  <span>{isKo ? '근무 시간' : 'Số giờ'}</span>
                  <strong>{formatHoursCompact(monthlyHours)}</strong>
                </div>
                <div>
                  <span>{isKo ? '총 급여' : 'Tổng lương'}</span>
                  <strong>{formatMoney(monthlyTotal)}</strong>
                </div>
                <div>
                  <span>{isKo ? '저축률' : 'Giữ lại'}</span>
                  <strong>{Math.round(saveRatio)}%</strong>
                </div>
              </div>
              <div className="income-share-footer">
                <span
                  className={`income-share-editable${editingShareField === 'footer' ? ' editing' : ''}`}
                  onClick={() => setEditingShareField('footer')}
                  title={isKo ? '클릭하여 편집' : 'Nhấn để chỉnh sửa'}
                >
                  {editingShareField === 'footer' ? (
                    <input
                      autoFocus
                      value={shareCardFooter}
                      onChange={e => setShareCardFooter(e.target.value)}
                      onBlur={() => setEditingShareField(null)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditingShareField(null); }}
                      onClick={e => e.stopPropagation()}
                      className="income-share-input"
                    />
                  ) : (
                    <>{shareCardFooter}<Edit2 size={10} className="income-share-edit-icon" /></>
                  )}
                </span>
                <small>duhocmate.com</small>
              </div>
            </div>
            <button type="button" className="income-share-export" onClick={handleExportShareCard} disabled={isExportingShare}>
              {isExportingShare ? (isKo ? '저장 중...' : 'Đang tạo ảnh...') : (isKo ? 'PNG 저장' : 'Tải ảnh PNG')}
            </button>
          </>
        )}
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
              {['🎉', '⭐', '✨', '🎊', '💫', '🌟', '🎈', '🏆'].map((e, i) => (
                <span key={i} className={`iga-p iga-p${i}`}>{e}</span>
              ))}
            </div>
            <span>{ui.goalDone}</span>
          </div>
        )}
      </section>

      <div className="income-subtabs" role="tablist" aria-label={ui.incomeTabs}>
        {incomeTabs.map(({ id, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? 'active' : ''}
              onClick={() => setActiveTab(id)}
              title={ui.tabs[id]}
            >
              <Icon size={16} />
              <span className="income-subtab-label">{ui.tabs[id]}</span>
            </button>
          );
        })}
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
                    <em>{weekdayHours[index] > 0 ? formatHoursCompact(weekdayHours[index]) : ''}</em>
                    <span style={{ height: `${Math.max(4, (value / maxWeekdayTotal) * 80)}px` }} />
                    <small>{weekdayLabels[index]}</small>
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
                <strong>{monthShifts.length} {ui.shifts}</strong>
              </article>
              <article>
                <Clock size={20} />
                <span>{ui.bestHours}</span>
                <strong>{formatHoursCompact(maxHoursInDay)}</strong>
              </article>
              <article className="gold">
                <Trophy size={20} />
                <span>{ui.bestDay}</span>
                <strong>{bestDayData ? new Date(bestDayData[0]).getDate() + '/' + (new Date(bestDayData[0]).getMonth() + 1) : '--'}</strong>
              </article>
            </section>

            <section className="income-chart-panel monthly">
              <div className="income-section-head">
                <div>
                  <p>{ui.monthOverview}</p>
                  <h2>
                    {chartView === 'day'
                      ? (isKo ? `${chartDaysInMonth}일 수입 · 지출` : `Thu và chi ${chartDaysInMonth} ngày`)
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
                  <div className="income-flow-line-chart">
                    <div className="income-flow-legend">
                      <span className="income-flow-legend-income">{isKo ? '수입' : 'Thu'}</span>
                      <span className="income-flow-legend-expense">{isKo ? '지출' : 'Chi'}</span>
                    </div>
                    <svg className="income-flow-svg" viewBox="0 0 320 132" role="img" aria-label={isKo ? '월별 수입과 지출 라인 차트' : 'Biểu đồ đường thu và chi trong tháng'}>
                      {[0.25, 0.5, 0.75, 1].map((tick) => (
                        <g key={tick}>
                          <line x1="20" x2="302" y1={108 - tick * 82} y2={108 - tick * 82} className="income-flow-grid" />
                          <text x="4" y={112 - tick * 82} className="income-flow-y-label">{fmtBar(maxMonthlyFlow * tick)}</text>
                        </g>
                      ))}
                      {isCurrentViewMonth ? (
                        <line
                          x1={20 + ((todayDayNumber - 1) / Math.max(1, chartDaysInMonth - 1)) * 282}
                          x2={20 + ((todayDayNumber - 1) / Math.max(1, chartDaysInMonth - 1)) * 282}
                          y1="16"
                          y2="112"
                          className="income-flow-today-line"
                        />
                      ) : null}
                      <path className="income-flow-area income-flow-area-income" d={monthlyFlowGeometry.incomeArea} />
                      <path className="income-flow-area income-flow-area-expense" d={monthlyFlowGeometry.expenseArea} />
                      <path className="income-flow-line income-flow-line-income" d={monthlyFlowGeometry.incomeLine} />
                      <path className="income-flow-line income-flow-line-expense" d={monthlyFlowGeometry.expenseLine} />
                      {monthlyFlowChartData.map((item, index) => {
                        const incomePoint = monthlyFlowGeometry.incomePoints[index];
                        const expensePoint = monthlyFlowGeometry.expensePoints[index];
                        const showIncomeDot = item.incomeDelta > 0 || item.day === flowLabelDay;
                        const showExpenseDot = item.expenseDelta > 0 || item.day === flowLabelDay;
                        const showIncomeLabel = item.income > 0 && item.day === flowLabelDay;
                        const showExpenseLabel = item.expense > 0 && item.day === flowLabelDay;
                        return (
                          <g key={item.day}>
                            {showIncomeDot && item.income > 0 ? (
                              <>
                                <circle className="income-flow-dot income-flow-dot-income" cx={incomePoint.x} cy={incomePoint.y} r={showIncomeLabel ? 4.6 : 3} />
                                {showIncomeLabel ? (
                                  <text x={Math.min(292, Math.max(28, incomePoint.x))} y={Math.max(14, incomePoint.y - 10)} className="income-flow-value income-flow-value-income">{fmtBar(item.income)}</text>
                                ) : null}
                              </>
                            ) : null}
                            {showExpenseDot && item.expense > 0 ? (
                              <>
                                <circle className="income-flow-dot income-flow-dot-expense" cx={expensePoint.x} cy={expensePoint.y} r={showExpenseLabel ? 4.6 : 3} />
                                {showExpenseLabel ? (
                                  <text x={Math.min(292, Math.max(28, expensePoint.x))} y={Math.max(14, expensePoint.y - 10)} className="income-flow-value income-flow-value-expense">{fmtBar(item.expense)}</text>
                                ) : null}
                              </>
                            ) : null}
                          </g>
                        );
                      })}
                    </svg>
                    <div className="income-flow-x-axis">
                      {[1, 5, 10, 15, 20, 25, 30].filter((day) => day <= chartDaysInMonth).map((day) => (
                        <span key={day}>{day}</span>
                      ))}
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
                {/* Thu / Chi toggle */}
                <div className="income-thuchi-toggle">
                  <button
                    type="button"
                    className={`income-thuchi-btn thu${expenseForm.type === 'thu' ? ' active' : ''}`}
                    onClick={() => setExpenseForm({ ...expenseForm, type: 'thu', category: 'other_income' })}
                  >
                    + {isKo ? '수입' : 'Thu nhập'}
                  </button>
                  <button
                    type="button"
                    className={`income-thuchi-btn chi${expenseForm.type !== 'thu' ? ' active' : ''}`}
                    onClick={() => setExpenseForm({ ...expenseForm, type: 'chi', category: 'food' })}
                  >
                    − {isKo ? '지출' : 'Chi tiêu'}
                  </button>
                </div>
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
                        {Object.entries(categoryMeta)
                          .filter(([, m]) => m.entryType === (expenseForm.type ?? 'chi'))
                          .map(([value]) => (
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

            {monthExpenses.length > 0 && (() => {
              const thuTotal = monthExpenses.filter(isIncomeEntry).reduce((s, e) => s + e.amount, 0);
              const chiTotal = monthExpenses.filter(e => !isIncomeEntry(e)).reduce((s, e) => s + e.amount, 0);
              return (
                <div className="income-thuchi-summary">
                  <div className="income-thuchi-sum thu">
                    <span>{isKo ? '수입' : 'Thu'}</span>
                    <strong>+{formatMoney(thuTotal)}</strong>
                  </div>
                  <div className="income-thuchi-divider" />
                  <div className="income-thuchi-sum chi">
                    <span>{isKo ? '지출' : 'Chi'}</span>
                    <strong>−{formatMoney(chiTotal)}</strong>
                  </div>
                </div>
              );
            })()}
            <div className="income-expense-list">
              {monthExpenses.length ? (
                monthExpenses.map((expense) => {
                  const meta = categoryMeta[expense.category] ?? categoryMeta['other'];
                  const Icon = meta.icon;
                  const isThu = isIncomeEntry(expense);
                  return (
                    <article key={expense.id} className={`income-expense-row${isThu ? ' thu' : ''}`}>
                      <div className={`income-expense-icon ${meta.tone}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <strong>{expense.note || categoryLabels[expense.category]}</strong>
                        <span>{categoryLabels[expense.category]} · {new Date(expense.date).getDate()}/{new Date(expense.date).getMonth() + 1}</span>
                      </div>
                      <div className="income-expense-amount">
                        <b className={isThu ? 'thu-amt' : ''}>{isThu ? '+' : '−'}{formatMoney(expense.amount)}</b>
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


        {/* ── Insurance Tab ── */}
        {activeTab === 'insurance' ? (
          <section className="income-insurance-panel">
            <div className="income-section-head">
              <div>
                <p>{isKo ? '보험료 관리' : 'Bảo hiểm'}</p>
                <h2>{ui.insTitle}</h2>
              </div>
              <ShieldCheck size={22} />
            </div>
            <p className="income-ins-subtitle">{ui.insSubtitle}</p>

            {/* ── Add form ── */}
            {isAddingIns || editingInsId ? (
              <div className="income-ins-form">
                {/* Insurance type toggle */}
                <div className="income-ins-type-row">
                  <button
                    type="button"
                    className={`income-ins-type-btn${insForm.insuranceType === '2' ? ' active' : ''}`}
                    onClick={() => {
                      const calc = calcIns(insForm.baseSalary, '2', { health: insForm.healthRate, longCare: insForm.longCareRate, pension: insForm.pensionRate, employment: insForm.employmentRate });
                      setInsForm(f => ({ ...f, insuranceType: '2', ...calc }));
                    }}
                  >
                    {ui.insType2}
                    <span className="income-ins-type-sub">(건강+장기요양)</span>
                  </button>
                  <button
                    type="button"
                    className={`income-ins-type-btn${insForm.insuranceType === 'partial' ? ' active' : ''}`}
                    onClick={() => {
                      const calc = calcIns(insForm.baseSalary, 'partial', { health: insForm.healthRate, longCare: insForm.longCareRate, pension: insForm.pensionRate, employment: insForm.employmentRate });
                      setInsForm(f => ({ ...f, insuranceType: 'partial', ...calc }));
                    }}
                  >
                    {ui.insTypePartial}
                    <span className="income-ins-type-sub">(고용보험 0.9%만)</span>
                  </button>
                  <button
                    type="button"
                    className={`income-ins-type-btn${insForm.insuranceType === '4' ? ' active' : ''}`}
                    onClick={() => {
                      const calc = calcIns(insForm.baseSalary, '4', { health: insForm.healthRate, longCare: insForm.longCareRate, pension: insForm.pensionRate, employment: insForm.employmentRate });
                      setInsForm(f => ({ ...f, insuranceType: '4', ...calc }));
                    }}
                  >
                    {ui.insType4}
                    <span className="income-ins-type-sub">(4가지 전부)</span>
                  </button>
                </div>

                {/* Workplace — chips linked to shifts data */}
                <label className="income-ins-label">
                  <span>{ui.insWorkplace}</span>
                  {workplaces.length > 0 && (
                    <div className="income-ins-wp-chips">
                      {/* "Tất cả" chip sums all workplaces */}
                      <button
                        type="button"
                        className={`income-ins-wp-chip${insForm.workplaceLabel === '__all__' ? ' active' : ''}`}
                        onClick={() => {
                          const base = monthlyTotal;
                          const calc = calcIns(base, insForm.insuranceType, { health: insForm.healthRate, longCare: insForm.longCareRate, pension: insForm.pensionRate, employment: insForm.employmentRate });
                          setInsForm(f => ({ ...f, workplaceLabel: '__all__', baseSalary: base, ...calc }));
                        }}
                      >
                        <span>{isKo ? '전체' : 'Tất cả'}</span>
                        <small>{monthlyTotal.toLocaleString()} ₩</small>
                      </button>
                      {workplaces.map(wp => (
                        <button
                          key={wp.label}
                          type="button"
                          className={`income-ins-wp-chip${insForm.workplaceLabel === wp.label ? ' active' : ''}`}
                          onClick={() => {
                            const base = wp.total;
                            const calc = calcIns(base, insForm.insuranceType, { health: insForm.healthRate, longCare: insForm.longCareRate, pension: insForm.pensionRate, employment: insForm.employmentRate });
                            setInsForm(f => ({ ...f, workplaceLabel: wp.label, baseSalary: base, ...calc }));
                          }}
                        >
                          <span>{wp.label}</span>
                          <small>{wp.total.toLocaleString()} ₩</small>
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    className="income-ins-input"
                    style={{ marginTop: workplaces.length > 0 ? '6px' : 0 }}
                    value={insForm.workplaceLabel === '__all__' ? (isKo ? '전체 근무지' : 'Tất cả nơi làm') : insForm.workplaceLabel}
                    onChange={e => setInsForm(f => ({ ...f, workplaceLabel: e.target.value }))}
                    placeholder={workplaces[0]?.label ?? (isKo ? '근무지명 직접 입력' : 'Nhập tên nơi làm')}
                  />
                </label>

                {/* Date row */}
                <div className="income-ins-date-row">
                  <label className="income-ins-label" style={{ flex: 1 }}>
                    <span>{ui.insStartDate}</span>
                    <button
                      type="button"
                      className="income-ins-date-btn"
                      onClick={() => setInsDatePickerField('workStartDate')}
                    >
                      {insForm.workStartDate}
                    </button>
                  </label>
                  <label className="income-ins-label" style={{ flex: 1 }}>
                    <span>{ui.insPayDate}</span>
                    <button
                      type="button"
                      className="income-ins-date-btn"
                      onClick={() => setInsDatePickerField('payDate')}
                    >
                      {insForm.payDate}
                    </button>
                  </label>
                </div>

                {/* Base salary */}
                <label className="income-ins-label">
                  <span>{ui.insSalaryBase}</span>
                  <input
                    className="income-ins-input"
                    type="number"
                    inputMode="numeric"
                    value={insForm.baseSalary || ''}
                    onChange={e => {
                      const base = Number(e.target.value) || 0;
                      const calc = calcIns(base, insForm.insuranceType, { health: insForm.healthRate, longCare: insForm.longCareRate, pension: insForm.pensionRate, employment: insForm.employmentRate });
                      setInsForm(f => ({ ...f, baseSalary: base, ...calc }));
                    }}
                  />
                </label>

                {/* Breakdown — rates + amounts all editable */}
                <div className="income-ins-breakdown">
                  <div className="income-ins-breakdown-title">{isKo ? '보험료 내역 (% · 금액 모두 수정 가능)' : 'Chi tiết bảo hiểm (% và ₩ đều có thể sửa)'}</div>

                  {/* 건강보험 + 장기요양 — cho type '2' và '4' */}
                  {(insForm.insuranceType === '2' || insForm.insuranceType === '4') && (
                    <>
                      <div className="income-ins-row">
                        <span className="income-ins-name">{ui.insHealth}</span>
                        <input className="income-ins-rate-input" type="number" inputMode="decimal" step="0.001"
                          value={insForm.healthRate}
                          onChange={e => {
                            const rate = Number(e.target.value) || 0;
                            const healthAmt = Math.round(insForm.baseSalary * rate / 100);
                            const longCareAmt = Math.round(healthAmt * insForm.longCareRate / 100);
                            setInsForm(f => ({ ...f, healthRate: rate, healthAmt, longCareAmt }));
                          }}
                        />
                        <span className="income-ins-unit">%&nbsp;=</span>
                        <input className="income-ins-amt" type="number" inputMode="numeric"
                          value={insForm.healthAmt || ''}
                          onChange={e => {
                            const healthAmt = Number(e.target.value) || 0;
                            const longCareAmt = Math.round(healthAmt * insForm.longCareRate / 100);
                            setInsForm(f => ({ ...f, healthAmt, longCareAmt }));
                          }}
                        />
                        <span className="income-ins-unit">₩</span>
                      </div>
                      <div className="income-ins-row">
                        <span className="income-ins-name">{ui.insLongCare}</span>
                        <input className="income-ins-rate-input" type="number" inputMode="decimal" step="0.01"
                          value={insForm.longCareRate}
                          onChange={e => {
                            const rate = Number(e.target.value) || 0;
                            const longCareAmt = Math.round(insForm.healthAmt * rate / 100);
                            setInsForm(f => ({ ...f, longCareRate: rate, longCareAmt }));
                          }}
                        />
                        <span className="income-ins-unit">%&nbsp;=</span>
                        <input className="income-ins-amt" type="number" inputMode="numeric"
                          value={insForm.longCareAmt || ''}
                          onChange={e => setInsForm(f => ({ ...f, longCareAmt: Number(e.target.value) || 0 }))}
                        />
                        <span className="income-ins-unit">₩</span>
                      </div>
                    </>
                  )}

                  {/* 국민연금 — chỉ cho type '4' */}
                  {insForm.insuranceType === '4' && (
                    <div className="income-ins-row">
                      <span className="income-ins-name">{ui.insPension}</span>
                      <input className="income-ins-rate-input" type="number" inputMode="decimal" step="0.01"
                        value={insForm.pensionRate}
                        onChange={e => {
                          const rate = Number(e.target.value) || 0;
                          const pensionAmt = Math.round(insForm.baseSalary * rate / 100);
                          setInsForm(f => ({ ...f, pensionRate: rate, pensionAmt }));
                        }}
                      />
                      <span className="income-ins-unit">%&nbsp;=</span>
                      <input className="income-ins-amt" type="number" inputMode="numeric"
                        value={insForm.pensionAmt || ''}
                        onChange={e => setInsForm(f => ({ ...f, pensionAmt: Number(e.target.value) || 0 }))}
                      />
                      <span className="income-ins-unit">₩</span>
                    </div>
                  )}

                  {/* 고용보험 — cho type 'partial' và '4' */}
                  {(insForm.insuranceType === 'partial' || insForm.insuranceType === '4') && (
                    <div className="income-ins-row">
                      <span className="income-ins-name">{ui.insEmployment}</span>
                      <input className="income-ins-rate-input" type="number" inputMode="decimal" step="0.01"
                        value={insForm.employmentRate}
                        onChange={e => {
                          const rate = Number(e.target.value) || 0;
                          const employmentAmt = Math.round(insForm.baseSalary * rate / 100);
                          setInsForm(f => ({ ...f, employmentRate: rate, employmentAmt }));
                        }}
                      />
                      <span className="income-ins-unit">%&nbsp;=</span>
                      <input className="income-ins-amt" type="number" inputMode="numeric"
                        value={insForm.employmentAmt || ''}
                        onChange={e => setInsForm(f => ({ ...f, employmentAmt: Number(e.target.value) || 0 }))}
                      />
                      <span className="income-ins-unit">₩</span>
                    </div>
                  )}

                  <div className="income-ins-row income-ins-total-row">
                    <span>{ui.insTotal}</span>
                    <strong>{insTotal(insForm).toLocaleString()} ₩</strong>
                  </div>
                  <p className="income-ins-employer-note">
                    {isKo
                      ? '산재보험은 사업주가 100% 부담합니다.'
                      : '산재보험 (tai nạn lao động) do chủ đóng 100%.'}
                  </p>
                </div>

                {/* Note */}
                <label className="income-ins-label">
                  <span>{ui.insNote}</span>
                  <input
                    className="income-ins-input"
                    value={insForm.note}
                    onChange={e => setInsForm(f => ({ ...f, note: e.target.value }))}
                    placeholder={isKo ? '예: GS25 5월 급여일 공제' : 'VD: trừ lương tháng 5 tại GS25'}
                  />
                </label>

                {/* Actions */}
                <div className="income-ins-form-actions">
                  <button
                    type="button"
                    className="income-ins-cancel-btn"
                    onClick={() => { setIsAddingIns(false); setEditingInsId(null); }}
                  >
                    {ui.insCancel}
                  </button>
                  <button
                    type="button"
                    className="income-ins-save-btn"
                    onClick={() => {
                      if (editingInsId) {
                        updateInsRecord(editingInsId, insForm);
                        setEditingInsId(null);
                      } else {
                        addInsRecord({ ...insForm, month: selectedMonthKey, confirmed: false });
                        setIsAddingIns(false);
                      }
                    }}
                  >
                    {ui.insSave}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="income-ins-add-btn"
                onClick={() => {
                  const base = monthlyTotal;
                  setInsForm({
                    month: selectedMonthKey,
                    workplaceLabel: workplaces[0]?.label ?? '',
                    workStartDate: `${selectedMonthKey}-01`,
                    payDate: todayStr,
                    baseSalary: base,
                    insuranceType: '4',
                    healthRate: INS_RATES.health,
                    longCareRate: INS_RATES.longCare,
                    pensionRate: INS_RATES.pension,
                    employmentRate: INS_RATES.employment,
                    ...calcIns(base, '4'),
                    confirmed: false,
                    note: '',
                  });
                  setIsAddingIns(true);
                }}
              >
                <Plus size={16} />
                {ui.insAdd}
              </button>
            )}

            {/* ── Record list (collapsible) ── */}
            {monthInsRecords.length > 0 ? (
              <div className="income-ins-list">
                {monthInsRecords.map(rec => {
                  const isOpen = expandedInsId === rec.id;
                  return (
                    <article key={rec.id} className={`income-ins-card${rec.confirmed ? ' confirmed' : ''}${isOpen ? ' open' : ''}`}>

                      {/* ── Always-visible summary row (click to toggle) ── */}
                      <button
                        type="button"
                        className="income-ins-card-summary"
                        onClick={() => setExpandedInsId(isOpen ? null : rec.id)}
                      >
                        <div className="income-ins-card-summary-left">
                          {rec.workplaceLabel && rec.workplaceLabel !== '__all__'
                            ? <strong>{rec.workplaceLabel}</strong>
                            : <strong>{isKo ? '전체 근무지' : 'Tất cả nơi làm'}</strong>
                          }
                          <span className="income-ins-card-badge">
                            {rec.insuranceType === '4'
                              ? (isKo ? '풀 1달' : 'Đủ tháng')
                              : rec.insuranceType === 'partial'
                                ? (isKo ? '중도퇴사' : 'Nghỉ giữa tháng')
                                : (isKo ? '2가지' : '2 loại')}
                          </span>
                          {rec.confirmed && (
                            <span className="income-ins-confirmed-badge">
                              <Check size={10} /> {isKo ? '완료' : 'Đã trừ'}
                            </span>
                          )}
                        </div>
                        <div className="income-ins-card-summary-right">
                          <strong className="income-ins-card-summary-total">−{insTotal(rec).toLocaleString()} ₩</strong>
                          <ChevronDown size={15} className={`income-ins-chevron${isOpen ? ' rotated' : ''}`} />
                        </div>
                      </button>

                      {/* ── Expanded detail ── */}
                      {isOpen && (
                        <div className="income-ins-card-detail">
                          <div className="income-ins-card-dates">
                            <span>{rec.workStartDate} → {rec.payDate}</span>
                            <span>{rec.baseSalary.toLocaleString()} ₩</span>
                          </div>

                          <div className="income-ins-card-breakdown">
                            {(rec.insuranceType === '2' || rec.insuranceType === '4') && (
                              <>
                                <div className="income-ins-card-brow">
                                  <span className="ins-brow-name">{ui.insHealth}</span>
                                  <span className="ins-brow-rate">{rec.healthRate}%</span>
                                  <span className="ins-brow-amt">{rec.healthAmt.toLocaleString()} ₩</span>
                                </div>
                                <div className="income-ins-card-brow">
                                  <span className="ins-brow-name">{ui.insLongCare}</span>
                                  <span className="ins-brow-rate">{rec.longCareRate}%</span>
                                  <span className="ins-brow-amt">{rec.longCareAmt.toLocaleString()} ₩</span>
                                </div>
                              </>
                            )}
                            {rec.insuranceType === '4' && (
                              <div className="income-ins-card-brow">
                                <span className="ins-brow-name">{ui.insPension}</span>
                                <span className="ins-brow-rate">{rec.pensionRate}%</span>
                                <span className="ins-brow-amt">{rec.pensionAmt.toLocaleString()} ₩</span>
                              </div>
                            )}
                            {rec.insuranceType === 'partial' && (
                              <div className="income-ins-card-brow" style={{ color: '#64748b', fontSize: '12px' }}>
                                <span className="ins-brow-name">
                                  {isKo ? '국민연금·건강·장기요양 미적용 (중도퇴사)' : '국민연금·건강보험 không tính (nghỉ giữa tháng)'}
                                </span>
                              </div>
                            )}
                            {(rec.insuranceType === 'partial' || rec.insuranceType === '4') && (
                              <div className="income-ins-card-brow">
                                <span className="ins-brow-name">{ui.insEmployment}</span>
                                <span className="ins-brow-rate">{rec.employmentRate}%</span>
                                <span className="ins-brow-amt">{rec.employmentAmt.toLocaleString()} ₩</span>
                              </div>
                            )}
                          </div>

                          {rec.note ? <p className="income-ins-card-note">{rec.note}</p> : null}

                          <div className="income-ins-card-footer">
                            <div className="income-ins-card-footer-top">
                              <div className="income-ins-card-total">
                                <span>{ui.insTotal}</span>
                                <strong>−{insTotal(rec).toLocaleString()} ₩</strong>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {!rec.confirmed && (
                                  <button type="button" className="income-ins-edit-btn"
                                    onClick={() => { setInsForm({ ...rec }); setEditingInsId(rec.id); setIsAddingIns(false); setExpandedInsId(null); }}
                                  >{ui.insEdit}</button>
                                )}
                                <button type="button" className="income-ins-del-btn" onClick={() => removeInsRecord(rec.id)}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {!rec.confirmed && (
                              <button type="button" className="income-ins-confirm-btn"
                                onClick={() => {
                                  updateInsRecord(rec.id, { confirmed: true });
                                  onAddExpense({ category: 'health', amount: insTotal(rec), date: rec.payDate, note: ui.insExpenseNote(rec.insuranceType), type: 'chi' });
                                }}
                              >
                                <Check size={14} />
                                {ui.insConfirm}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : !isAddingIns && !editingInsId ? (
              <div className="income-empty">
                <ShieldCheck size={34} />
                <strong>{ui.insEmpty}</strong>
                <p>{ui.insEmptyHint}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── 주휴수당 Tab ── */}
        {activeTab === 'juhyu' ? (
          <section className="income-insurance-panel">
            <div className="income-section-head">
              <div>
                <p>{isKo ? '주휴수당 관리' : '주휴수당'}</p>
                <h2>{ui.juhyuTitle}</h2>
              </div>
              <CalendarCheck size={22} />
            </div>
            <p className="income-ins-subtitle">{ui.juhyuSubtitle}</p>

            {/* ── Add / Edit form ── */}
            {isAddingJuhyu || editingJuhyuId ? (
              <div className="income-ins-form">

                {/* Workplace chips */}
                <label className="income-ins-label">
                  <span>{ui.juhyuWorkplace}</span>
                  {workplaces.length > 0 && (
                    <div className="income-ins-wp-chips">
                      {workplaces.map(wp => (
                        <button
                          key={wp.label}
                          type="button"
                          className={`income-ins-wp-chip${juhyuForm.workplaceLabel === wp.label ? ' active' : ''}`}
                          onClick={() => {
                            const hr = wp.hours > 0 ? Math.round(wp.total / wp.hours) : juhyuForm.hourlyRate;
                            applyJuhyuCalc({ workplaceLabel: wp.label, hourlyRate: hr });
                          }}
                        >
                          <span>{wp.label}</span>
                          <small>{wp.hours > 0 ? `${Math.round(wp.total / wp.hours).toLocaleString()} ₩/h` : ''}</small>
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    className="income-ins-input"
                    style={{ marginTop: workplaces.length > 0 ? '6px' : 0 }}
                    value={juhyuForm.workplaceLabel}
                    onChange={e => applyJuhyuCalc({ workplaceLabel: e.target.value })}
                    placeholder={workplaces[0]?.label ?? (isKo ? '근무지명 직접 입력' : 'Nhập tên nơi làm')}
                  />
                </label>

                <label className="income-ins-label">
                  <span>{ui.juhyuHourlyRate}</span>
                  <div className="income-ins-input-wrap">
                    <input
                      className="income-ins-input"
                      type="number"
                      inputMode="numeric"
                      value={juhyuForm.hourlyRate || ''}
                      onChange={e => applyJuhyuCalc({ hourlyRate: Number(e.target.value) || 0 })}
                    />
                    <span className="income-ins-unit">₩/h</span>
                  </div>
                </label>

                {/* Start date & End date */}
                <div className="income-juhyu-dates">
                  <label className="income-ins-label">
                    <span>{isKo ? '근무 시작일' : 'Ngày bắt đầu làm'}</span>
                    <button type="button" className="income-ins-date-btn" onClick={() => setJuhyuDatePickerField('startDate')}>
                      {juhyuForm.startDate}
                    </button>
                  </label>
                  <label className="income-ins-label">
                    <span>{isKo ? '근무 종료일' : 'Ngày kết thúc'}</span>
                    <button type="button" className="income-ins-date-btn" onClick={() => setJuhyuDatePickerField('endDate')}>
                      {juhyuForm.endDate}
                    </button>
                  </label>
                </div>

                {/* ── Week-by-week preview ── */}
                {juhyuForm.weeks.length > 0 && (
                  <div className={`income-juhyu-preview${juhyuForm.qualifies ? ' qualifies' : ' warn'}`}>
                    <div className="income-juhyu-weeks">
                      {juhyuForm.weeks.map((w, i) => (
                        <div key={i} className={`income-juhyu-week-row${w.qualifies ? '' : ' partial'}`}>
                          <span className="income-juhyu-week-label">
                            {isKo ? `${i + 1}주차` : `Tuần ${i + 1}`}
                            {' '}({w.weekStart.slice(5).replace('-', '/')} – {w.weekEnd.slice(5).replace('-', '/')})
                            {' '}
                            <em>{w.weeklyHours > 0 ? `${w.weeklyHours.toFixed(1)}h${w.workDays > 0 ? ` · ${w.workDays}${isKo ? '일' : ' ngày'}` : ''}` : (isKo ? '근무 없음' : 'Không có ca')}</em>
                          </span>
                          <strong>
                            {w.qualifies
                              ? `+${w.amount.toLocaleString()} ₩`
                              : w.weeklyHours < 15 && w.weeklyHours > 0
                                ? (isKo ? `<15h` : `<15h`)
                                : w.weeklyHours === 0
                                  ? '–'
                                  : (isKo ? '불완전한 주' : 'Tuần lẻ')
                            }
                          </strong>
                        </div>
                      ))}
                    </div>
                    <div className="income-juhyu-calc-row total" style={{ marginTop: '6px' }}>
                      <span>{isKo ? '합계' : 'Tổng cộng'}</span>
                      <strong>{juhyuForm.juhyuPerMonth.toLocaleString()} ₩</strong>
                    </div>
                  </div>
                )}

                {/* Note */}
                <label className="income-ins-label">
                  <span>{ui.juhyuNote}</span>
                  <input
                    className="income-ins-input"
                    value={juhyuForm.note}
                    onChange={e => applyJuhyuCalc({ note: e.target.value })}
                    placeholder={isKo ? '예: GS25 5월 급여일 포함' : 'VD: GS25 tháng 5'}
                  />
                </label>

                {/* Actions */}
                <div className="income-ins-form-actions">
                  <button type="button" className="income-ins-cancel-btn"
                    onClick={() => { setIsAddingJuhyu(false); setEditingJuhyuId(null); }}
                  >{ui.insCancel}</button>
                  <button type="button" className="income-ins-save-btn"
                    onClick={() => {
                      if (editingJuhyuId) {
                        updateJuhyuRecord(editingJuhyuId, juhyuForm);
                        setEditingJuhyuId(null);
                      } else {
                        addJuhyuRecord({ ...juhyuForm, month: selectedMonthKey, confirmed: false });
                        setIsAddingJuhyu(false);
                      }
                    }}
                  >{ui.insSave}</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="income-ins-add-btn"
                onClick={() => {
                  const wp = workplaces[0];
                  const hr = wp && wp.hours > 0 ? Math.round(wp.total / wp.hours) : 10320;
                  const monthStart = `${selectedMonthKey}-01`;
                  const monthEnd = `${selectedMonthKey}-${String(chartDaysInMonth).padStart(2, '0')}`;
                  const label = wp?.label ?? '';
                  const weeks = calcJuhyuWeeksFromShifts(monthStart, monthEnd, label, shifts, hr);
                  setJuhyuForm({
                    month: selectedMonthKey,
                    workplaceLabel: label,
                    startDate: monthStart,
                    endDate: monthEnd,
                    hourlyRate: hr,
                    ...buildJuhyuCalc(weeks, hr),
                    confirmed: false,
                    note: '',
                  });
                  setIsAddingJuhyu(true);
                }}
              >
                <Plus size={16} />
                {ui.juhyuAdd}
              </button>
            )}

            {/* ── Record list (collapsible) ── */}
            {monthJuhyuRecords.length > 0 ? (
              <div className="income-ins-list">
                {monthJuhyuRecords.map(rec => {
                  const isOpen = expandedJuhyuId === rec.id;
                  return (
                    <article key={rec.id} className={`income-ins-card${rec.confirmed ? ' confirmed' : ''}${isOpen ? ' open' : ''}`}>

                      {/* Summary row */}
                      <button
                        type="button"
                        className="income-ins-card-summary"
                        onClick={() => setExpandedJuhyuId(isOpen ? null : rec.id)}
                      >
                        <div className="income-ins-card-summary-left">
                          <strong>
                            {rec.workplaceLabel || (isKo ? '전체 근무지' : 'Tất cả nơi làm')}
                          </strong>
                          {rec.qualifies ? (
                            <span className="income-ins-card-badge income-juhyu-badge-ok">
                              {rec.weeks.filter(w => w.qualifies).length}{isKo ? '주' : ' tuần đủ đk'}
                            </span>
                          ) : (
                            <span className="income-ins-card-badge income-juhyu-badge-warn">
                              {'< 15h'}
                            </span>
                          )}
                          {rec.confirmed && (
                            <span className="income-ins-confirmed-badge">
                              <Check size={10} /> {isKo ? '완료' : 'Đã nhận'}
                            </span>
                          )}
                        </div>
                        <div className="income-ins-card-summary-right">
                          <strong className="income-juhyu-summary-total">
                            {rec.qualifies ? `+${rec.juhyuPerMonth.toLocaleString()} ₩` : '0 ₩'}
                          </strong>
                          <ChevronDown size={15} className={`income-ins-chevron${isOpen ? ' rotated' : ''}`} />
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="income-ins-card-detail">
                          <div className="income-ins-card-dates">
                            <span>{rec.startDate ?? ''} → {rec.endDate ?? ''}</span>
                            <span>{rec.hourlyRate.toLocaleString()} ₩/h</span>
                          </div>

                          {rec.weeks && rec.weeks.length > 0 && (
                            <div className="income-juhyu-weeks income-juhyu-weeks-record">
                              {rec.weeks.map((w, i) => (
                                <div key={i} className={`income-juhyu-week-row${w.qualifies ? '' : ' partial'}`}>
                                  <span className="income-juhyu-week-label">
                                    {isKo ? `${i + 1}주차` : `Tuần ${i + 1}`}
                                    {' '}({w.weekStart.slice(5).replace('-', '/')} – {w.weekEnd.slice(5).replace('-', '/')})
                                    {' '}
                                    <em>{w.weeklyHours > 0 ? `${w.weeklyHours.toFixed(1)}h · ${w.workDays}${isKo ? '일' : ' ngày'}` : (isKo ? '근무 없음' : 'Không có ca')}</em>
                                  </span>
                                  <strong>
                                    {w.qualifies
                                      ? `+${w.amount.toLocaleString()} ₩`
                                      : w.weeklyHours > 0 && w.weeklyHours < 15
                                        ? (isKo ? '<15h' : '<15h')
                                        : w.weeklyHours === 0 ? '–' : (isKo ? '불완전한 주' : 'Tuần lẻ')
                                    }
                                  </strong>
                                </div>
                              ))}
                            </div>
                          )}

                          {rec.note ? <p className="income-ins-card-note">{rec.note}</p> : null}

                          <div className="income-ins-card-footer">
                            <div className="income-ins-card-footer-top">
                              <div className="income-ins-card-total">
                                <span>{ui.juhyuTotal}</span>
                                <strong className="income-juhyu-summary-total">
                                  {rec.qualifies ? `+${rec.juhyuPerMonth.toLocaleString()} ₩` : '0 ₩'}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {!rec.confirmed && (
                                  <button type="button" className="income-ins-edit-btn"
                                    onClick={() => {
                                      setJuhyuForm({ ...rec });
                                      setEditingJuhyuId(rec.id);
                                      setIsAddingJuhyu(false);
                                      setExpandedJuhyuId(null);
                                    }}
                                  >{ui.insEdit}</button>
                                )}
                                <button type="button" className="income-ins-del-btn" onClick={() => removeJuhyuRecord(rec.id)}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {!rec.confirmed && rec.qualifies && (
                              <button type="button" className="income-ins-confirm-btn income-juhyu-confirm-btn"
                                onClick={() => {
                                  updateJuhyuRecord(rec.id, { confirmed: true });
                                  onAddExpense({
                                    category: 'juhyu_income',
                                    amount: rec.juhyuPerMonth,
                                    date: rec.endDate ?? todayStr,
                                    note: rec.workplaceLabel ? `주휴수당 — ${rec.workplaceLabel}` : '주휴수당',
                                    type: 'thu',
                                  });
                                }}
                              >
                                <Check size={14} />
                                {ui.juhyuConfirm}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : !isAddingJuhyu && !editingJuhyuId ? (
              <div className="income-empty">
                <CalendarCheck size={34} />
                <strong>{ui.juhyuEmpty}</strong>
                <p>{ui.juhyuEmptyHint}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* Expense date picker */}
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
      {/* Insurance date pickers */}
      {insDatePickerField && (
        <DateWheelModal
          title={insDatePickerField === 'workStartDate' ? ui.insStartDate : ui.insPayDate}
          initialDate={insDatePickerField === 'workStartDate' ? insForm.workStartDate : insForm.payDate}
          onClose={() => setInsDatePickerField(null)}
          onConfirm={(date) => {
            setInsForm(f => ({ ...f, [insDatePickerField]: date }));
            setInsDatePickerField(null);
          }}
        />
      )}
      {/* 주휴수당 date pickers */}
      {juhyuDatePickerField && (
        <DateWheelModal
          title={juhyuDatePickerField === 'startDate'
            ? (isKo ? '근무 시작일' : 'Ngày bắt đầu làm')
            : (isKo ? '근무 종료일' : 'Ngày kết thúc')}
          initialDate={juhyuDatePickerField === 'startDate' ? juhyuForm.startDate : juhyuForm.endDate}
          onClose={() => setJuhyuDatePickerField(null)}
          onConfirm={(date) => {
            applyJuhyuCalc({ [juhyuDatePickerField]: date });
            setJuhyuDatePickerField(null);
          }}
        />
      )}
    </>
  );
}
