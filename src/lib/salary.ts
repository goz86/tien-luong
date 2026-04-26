export const MINIMUM_WAGE_2026 = 10320;
export const DEFAULT_KRW_TO_VND = 18.1;

export type Shift = {
  id: string;
  date: string;
  label: string;
  startTime: string;
  endTime: string;
  hourlyWage: number;
  breakMinutes: number;
  notes: string;
  
  // NEW: Phụ cấp ca đêm (Night shift allowance - x1.5)
  // Người dùng tự tick xác nhận ca này được nhân 1.5
  nightShift?: boolean; 
  
  // NEW: Thuế 3.3% (Freelancer tax deduction)
  taxDeduction?: boolean; 
  
  // NEW: Phụ cấp nghỉ lễ / cuối tuần (주휴수당 - Holiday pay)
  holidayAllowance?: number; 
};

export function formatKrw(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

export function formatVnd(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')} VND`;
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function shiftHours(shift: Shift) {
  const start = toMinutes(shift.startTime);
  let end = toMinutes(shift.endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(0, (end - start - shift.breakMinutes) / 60);
}

export function calculateShiftPay(shift: Shift) {
  const hours = shiftHours(shift);
  
  // 1. Lương cơ bản
  let baseTotal = hours * shift.hourlyWage;
  
  // 2. Phụ cấp ca đêm (Night shift allowance)
  // Ở HQ thường là thêm 50% cho số giờ làm đêm. Ở đây nếu user bật `nightShift`,
  // ta nhân 1.5 cho toàn bộ thời gian của ca làm này (đơn giản hoá cho user).
  let nightPay = 0;
  if (shift.nightShift) {
    nightPay = baseTotal * 0.5; 
    baseTotal += nightPay;
  }
  
  // 3. Phụ cấp cuối tuần / lễ (주휴수당)
  const holidayPay = shift.holidayAllowance || 0;
  baseTotal += holidayPay;
  
  // 4. Thuế 3.3% (Tax deduction)
  let taxAmount = 0;
  if (shift.taxDeduction) {
    taxAmount = baseTotal * 0.033;
    baseTotal -= taxAmount; // Trừ đi phần thuế
  }

  return {
    hours,
    total: baseTotal,
    nightPay,
    holidayPay,
    taxAmount
  };
}
