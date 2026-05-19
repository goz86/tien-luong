import { Shift, WageType } from './salary';

export type Tab = 'home' | 'calendar' | 'income' | 'friends' | 'profile' | 'admin';

export type RateState = {
  value: number;
  source: 'live' | 'cached';
  updatedAt: string;
};

export type CurrencyMode = 'krw-vnd' | 'vnd-vnd' | 'vnd-krw';

export interface PersonalGoal {
  id: string;
  title: string;
  amount: number;
  currency: 'VND' | 'KRW';
  icon: string;
  createdAt: string;
  completedAt?: string | null;
}

export type VenueColors = Record<string, string>;

export interface CompanionProfile {
  id: string;
  displayName: string;
  school: string;
  region: string;
  focus: string;
  availability?: string;
  avatarUrl?: string | null;
  tags: string[];
  latitude?: number | null;
  longitude?: number | null;
  locationUpdatedAt?: string | null;
  lastSeenAt?: string | null;
  isOnline?: boolean;
}

export interface ProfileDraft {
  displayName: string;
  school: string;
  region: string;
  note: string;
  avatarUrl?: string;
  tags?: string[];
  latitude?: number | null;
  longitude?: number | null;
  locationUpdatedAt?: string | null;
  lastSeenAt?: string | null;
}

export interface Expense {
  id: string;
  category: 'rent' | 'phone' | 'food' | 'transport' | 'shopping' | 'health' | 'entertainment' | 'other' | 'juhyu_income' | 'overtime_income' | 'other_income';
  amount: number;
  date: string;
  note: string;
  type?: 'thu' | 'chi';  // defaults to 'chi' for backward compat
}

export type StoredState = {
  shifts: Shift[];
  profile: ProfileDraft;
  companions: CompanionProfile[];
  requested: string[];
  rate: RateState;
  venueColors: VenueColors;
  incomeTarget?: number;
  expenses: Expense[];
  personalGoals?: PersonalGoal[];
  currencyMode?: CurrencyMode;
};

export type ShiftDraft = {
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hourlyWage: number;
  label: string;
  note: string;
  nightShift?: boolean;
  taxDeduction?: boolean;
  holidayAllowance?: number;
  /** UI-only: which wage format the user entered (converted to hourlyWage on save) */
  wageType?: WageType;
  /** UI-only: raw value the user typed (일급 or 월급 amount before conversion) */
  wageInput?: number;
};

export type CalendarDisplay = 'duration' | 'range';
export type { Shift };
