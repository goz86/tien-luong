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
  type LucideIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { calculateShiftPay } from '../lib/salary';
import type { CurrencyMode, Expense, RateState, Shift, VenueColors } from '../lib/types';
import { formatCurrencyFlowAmount } from '../lib/currency';
import { DateWheelModal } from './shared/DateWheelModal';
import { getVenueColor, shiftMonth, formatHoursCompact } from '../utils/helpers';

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

function resolveStageImgKey(shifts: Shift[], expenses: Expense[], rateValue: number): string {
  const grossKrw = shifts.reduce((sum, s) => sum + calculateShiftPay(s).total, 0);
  const expenseKrw = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalVnd = Math.max(0, grossKrw - expenseKrw) * rateValue;
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
type IncomeTab = 'overview' | 'expenses' | 'workplaces' | 'insurance';
type ChartViewMode = 'day' | 'week' | 'month';
type IconComponent = LucideIcon;

const incomeTabs: Array<{ id: IncomeTab; icon: IconComponent }> = [
  { id: 'overview', icon: BarChart3 },
  { id: 'expenses', icon: ReceiptText },
  { id: 'workplaces', icon: Building2 },
  { id: 'insurance', icon: ShieldCheck },
];

// ─── Insurance 4대보험 ────────────────────────────────────────
interface InsuranceRecord {
  id: string;
  month: string;           // 'YYYY-MM'
  workplaceLabel: string;
  workStartDate: string;   // 'YYYY-MM-DD'
  payDate: string;         // 'YYYY-MM-DD'
  baseSalary: number;      // KRW
  insuranceType: '2' | '4';
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
  type: '2' | '4',
  rates?: { health?: number; longCare?: number; pension?: number; employment?: number },
) {
  const h  = rates?.health      ?? INS_RATES.health;
  const lc = rates?.longCare    ?? INS_RATES.longCare;
  const p  = rates?.pension     ?? INS_RATES.pension;
  const e  = rates?.employment  ?? INS_RATES.employment;
  const healthAmt     = Math.round(base * h / 100);
  const longCareAmt   = Math.round(healthAmt * lc / 100);
  const pensionAmt    = type === '4' ? Math.round(base * p / 100) : 0;
  const employmentAmt = type === '4' ? Math.round(base * e / 100) : 0;
  return { healthAmt, longCareAmt, pensionAmt, employmentAmt };
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
function useInsuranceRecords() {
  const [records, setRaw] = useState<InsuranceRecord[]>(loadInsRecords);
  const set = (next: InsuranceRecord[]) => { saveInsRecords(next); setRaw(next); };
  const add = (rec: Omit<InsuranceRecord, 'id'>) => {
    const r = { ...rec, id: `ins-${Date.now()}-${Math.random().toString(16).slice(2)}` };
    set([...loadInsRecords(), r]);
    return r;
  };
  const update = (id: string, patch: Partial<InsuranceRecord>) => {
    set(loadInsRecords().map(r => r.id === id ? { ...r, ...patch } : r));
  };
  const remove = (id: string) => set(loadInsRecords().filter(r => r.id !== id));
  return { records, add, update, remove };
}

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
    tabs: { overview: '요약', expenses: '지출', workplaces: '근무지', insurance: '보험' },
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
    insTitle: '4대보험 관리',
    insSubtitle: '월별 보험료를 계산하고 지출에 반영하세요.',
    insAdd: '보험료 추가',
    insType2: '2가지 (건강보험+장기요양)',
    insType4: '4가지 전부',
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
    insExpenseNote: (type: string) => `4대보험 (${type === '4' ? '4가지' : '2가지'})`,
  } : {
    tabs: { overview: 'Tổng quan', expenses: 'Chi tiêu', workplaces: 'Nơi làm', insurance: 'Bảo hiểm' },
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
    expenseRecords: 'Khoản đã chi',
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
    insTitle: 'Quản lý bảo hiểm 4대보험',
    insSubtitle: 'Tính tiền bảo hiểm theo tháng và tự động trừ vào chi tiêu.',
    insAdd: 'Thêm khai bảo hiểm',
    insType2: '2가지 (건강보험+장기요양)',
    insType4: '4가지 전부',
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
    insExpenseNote: (type: string) => `Bảo hiểm 4대보험 (${type === '4' ? '4 loại' : '2 loại'})`,
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
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const prevTotalRef = useRef<number | null>(null);

  // ── Insurance tab state (moved below memoized values — see further down) ──
  const { records: allInsRecords, add: addInsRecord, update: updateInsRecord, remove: removeInsRecord } = useInsuranceRecords();
  const [isAddingIns, setIsAddingIns] = useState(false);
  const [editingInsId, setEditingInsId] = useState<string | null>(null);
  const [insDatePickerField, setInsDatePickerField] = useState<InsFormField | null>(null);
  const todayStr = new Date().toISOString().slice(0, 10);
  // insForm initialised with safe zero-defaults; populated in the "Add" click handler
  const [insForm, setInsForm] = useState<Omit<InsuranceRecord, 'id'>>({
    month: '',
    workplaceLabel: '',
    workStartDate: todayStr,
    payDate: todayStr,
    baseSalary: 0,
    insuranceType: '2',
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

  const totalExpenses = useMemo(() => monthExpenses.reduce((sum, expense) => sum + expense.amount, 0), [monthExpenses]);
  const netBalance = monthlyTotal - totalExpenses;
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
      category: 'food',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      note: '',
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
            <span>{isKo ? '공유 카드' : 'Báo cáo chia sẻ'}</span>
            <strong>{isKo ? '이번 달 기록을 예쁘게 저장' : 'Lưu lại tháng làm việc của mình'}</strong>
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
                        <span>{categoryLabels[expense.category]} · {new Date(expense.date).getDate()}/{new Date(expense.date).getMonth() + 1}</span>
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
                      <small>{workplace.count} {ui.shifts} · {formatHoursCompact(workplace.hours)} · {workplace.share.toFixed(0)}%</small>
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
                  </button>
                </div>

                {/* Workplace */}
                <label className="income-ins-label">
                  <span>{ui.insWorkplace}</span>
                  <input
                    className="income-ins-input"
                    value={insForm.workplaceLabel}
                    onChange={e => setInsForm(f => ({ ...f, workplaceLabel: e.target.value }))}
                    placeholder={workplaces[0]?.label ?? (isKo ? '근무지명' : 'Tên nơi làm')}
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

                  {/* 건강보험 */}
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

                  {/* 장기요양 */}
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

                  {/* 국민연금 + 고용보험 — only for 4-type */}
                  {insForm.insuranceType === '4' && (
                    <>
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
                    </>
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
                    insuranceType: '2',
                    healthRate: INS_RATES.health,
                    longCareRate: INS_RATES.longCare,
                    pensionRate: INS_RATES.pension,
                    employmentRate: INS_RATES.employment,
                    ...calcIns(base, '2'),
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

            {/* ── Record list ── */}
            {monthInsRecords.length > 0 ? (
              <div className="income-ins-list">
                {monthInsRecords.map(rec => (
                  <article key={rec.id} className={`income-ins-card${rec.confirmed ? ' confirmed' : ''}`}>
                    <div className="income-ins-card-head">
                      <div>
                        {rec.workplaceLabel && <strong className="income-ins-card-venue">{rec.workplaceLabel}</strong>}
                        <span className="income-ins-card-badge">
                          {rec.insuranceType === '4'
                            ? (isKo ? '4가지' : '4 loại')
                            : (isKo ? '2가지' : '2 loại')}
                        </span>
                        {rec.confirmed && (
                          <span className="income-ins-confirmed-badge">
                            <Check size={11} /> {ui.insConfirmed}
                          </span>
                        )}
                      </div>
                      {!rec.confirmed && (
                        <button
                          type="button"
                          className="income-ins-edit-btn"
                          onClick={() => {
                            setInsForm({ ...rec });
                            setEditingInsId(rec.id);
                            setIsAddingIns(false);
                          }}
                        >
                          {ui.insEdit}
                        </button>
                      )}
                    </div>

                    <div className="income-ins-card-dates">
                      <span>{rec.workStartDate} → {rec.payDate}</span>
                      <span>{rec.baseSalary.toLocaleString()} ₩</span>
                    </div>

                    <div className="income-ins-card-breakdown">
                      <span>{ui.insHealth} {rec.healthRate}%: {rec.healthAmt.toLocaleString()} ₩</span>
                      <span>{ui.insLongCare} {rec.longCareRate}%: {rec.longCareAmt.toLocaleString()} ₩</span>
                      {rec.insuranceType === '4' && (
                        <>
                          <span>{ui.insPension} {rec.pensionRate}%: {rec.pensionAmt.toLocaleString()} ₩</span>
                          <span>{ui.insEmployment} {rec.employmentRate}%: {rec.employmentAmt.toLocaleString()} ₩</span>
                        </>
                      )}
                    </div>

                    <div className="income-ins-card-footer">
                      <div className="income-ins-card-total">
                        <span>{ui.insTotal}</span>
                        <strong>−{insTotal(rec).toLocaleString()} ₩</strong>
                      </div>
                      <div className="income-ins-card-actions">
                        <button
                          type="button"
                          className="income-ins-del-btn"
                          onClick={() => removeInsRecord(rec.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                        {!rec.confirmed && (
                          <button
                            type="button"
                            className="income-ins-confirm-btn"
                            onClick={() => {
                              updateInsRecord(rec.id, { confirmed: true });
                              onAddExpense({
                                category: 'health',
                                amount: insTotal(rec),
                                date: rec.payDate,
                                note: ui.insExpenseNote(rec.insuranceType),
                              });
                            }}
                          >
                            <Check size={14} />
                            {ui.insConfirm}
                          </button>
                        )}
                      </div>
                    </div>
                    {rec.note ? <p className="income-ins-card-note">{rec.note}</p> : null}
                  </article>
                ))}
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
    </>
  );
}
