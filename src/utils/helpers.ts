import { Shift, calculateShiftPay, shiftHours } from '../lib/salary';

export function formatMonthVietnamese(dateIso: string) {
  const value = new Date(`${dateIso}T00:00:00`);
  return `Tháng ${value.getMonth() + 1}, ${value.getFullYear()}`;
}

export function formatMonthHeader(dateIso: string) {
  return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date(`${dateIso}T00:00:00`));
}

export function formatDateChip(dateIso: string) {
  const value = new Date(`${dateIso}T00:00:00`);
  return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export function formatSelectedDate(dateIso: string) {
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${dateIso}T00:00:00`));
}

export function formatHoursCompact(value: number) {
  const roundedMinutes = Math.round(value * 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  if (hours === 0) return `${minutes}p`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${String(minutes).padStart(2, '0')}p`;
}

export function formatCompactKrw(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

export function formatCalendarKrw(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}\uC6D0`;
}

export function formatCalendarMonthTitle(dateIso: string) {
  const value = new Date(`${dateIso}T00:00:00`);
  return `${value.getFullYear()}.${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export function startOfMonth(dateIso: string) {
  return `${dateIso.slice(0, 7)}-01`;
}

export function shiftMonth(monthIso: string, delta: number) {
  const value = new Date(`${monthIso}T00:00:00`);
  value.setMonth(value.getMonth() + delta);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`;
}

export function buildCalendar(monthIso: string, shifts: Shift[]) {
  const monthDate = new Date(`${monthIso}T00:00:00`);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const items = new Map<string, Shift[]>();

  shifts.forEach((shift) => {
    items.set(shift.date, [...(items.get(shift.date) ?? []), shift]);
  });

  const cells: Array<{ date: string; day: number; items: Shift[]; total: number; inMonth: boolean }> = [];
  for (let index = 0; index < offset; index += 1) {
    const day = prevMonthDays - offset + index + 1;
    const value = new Date(year, month - 1, day);
    const iso = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayItems = items.get(iso) ?? [];
    const total = dayItems.reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0);
    cells.push({ date: iso, day, items: dayItems, total, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${monthIso.slice(0, 7)}-${String(day).padStart(2, '0')}`;
    const dayItems = items.get(iso) ?? [];
    const total = dayItems.reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0);
    cells.push({ date: iso, day, items: dayItems, total, inMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const value = new Date(year, month + 1, nextDay);
    const iso = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
    const dayItems = items.get(iso) ?? [];
    const total = dayItems.reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0);
    cells.push({ date: iso, day: nextDay, items: dayItems, total, inMonth: false });
    nextDay += 1;
  }
  return cells;
}

export function getShiftLineSummary(shift: Shift) {
  return formatHoursCompact(shiftHours(shift));
}

export function getVenueColor(venue: string, colors: Record<string, string>): string {
  if (colors[venue]) return colors[venue];
  const VENUE_PALETTE = ['#2752ff', '#0d9b72', '#ff6b7a', '#f59e0b', '#9333ea', '#0891b2', '#e11d48', '#16a34a'];
  let hash = 0;
  for (const char of venue) hash = (hash + (char.codePointAt(0) ?? 0)) % VENUE_PALETTE.length;
  return VENUE_PALETTE[hash];
}

export function isKoreanHoliday(dateIso: string): boolean {
  const [year, month, day] = dateIso.split('-').map(Number);
  
  // Fixed holidays
  const fixed = [
    '01-01', // New Year
    '03-01', // Independence Movement Day
    '05-05', // Children's Day
    '06-06', // Memorial Day
    '08-15', // Liberation Day
    '10-03', // National Foundation Day
    '10-09', // Hangeul Day
    '12-25', // Christmas
  ];
  if (fixed.includes(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)) return true;

  // Moving holidays (approximation for 2024-2025)
  const moving = [
    // 2024
    '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', // Seollal
    '2024-04-10', // Election Day
    '2024-05-15', // Buddha's Birthday
    '2024-09-16', '2024-09-17', '2024-09-18', // Chuseok
    // 2025
    '2025-01-28', '2025-01-29', '2025-01-30', // Seollal
    '2025-05-05', // Buddha's Birthday
    '2025-10-05', '2025-10-06', '2025-10-07', // Chuseok
  ];
  if (moving.includes(dateIso)) return true;

  return false;
}
