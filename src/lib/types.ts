import { Shift } from './salary';

export type Tab = 'home' | 'calendar' | 'income' | 'friends' | 'profile' | 'admin';

export type RateState = {
  value: number;
  source: 'live' | 'cached';
  updatedAt: string;
};

export type VenueColors = Record<string, string>;

export interface CompanionProfile {
  id: string;
  displayName: string;
  school: string;
  region: string;
  focus: string;
  availability?: string;
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
  category: 'rent' | 'phone' | 'food' | 'transport' | 'shopping' | 'health' | 'entertainment' | 'other';
  amount: number;
  date: string;
  note: string;
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
};

export type CalendarDisplay = 'duration' | 'range';
export type { Shift };
