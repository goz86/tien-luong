import type { Shift } from './lib/salary';

export type CompanionProfile = {
  id: string;
  displayName: string;
  school: string;
  region: string;
  focus: string;
  availability: string;
  tags: string[];
};

export type ProfileDraft = {
  displayName: string;
  school: string;
  region: string;
  note: string;
};

export const regions = ['Seoul - Hongdae', 'Seoul - Konkuk', 'Seoul - Gangnam', 'Suwon', 'Incheon', 'Busan', 'Daegu'];

export const demoShifts: Shift[] = [
  {
    id: 'shift-1',
    date: '2026-04-20',
    label: 'Việc làm thêm',
    startTime: '18:00',
    endTime: '22:00',
    hourlyWage: 11000,
    breakMinutes: 0,
    notes: 'Ca tối quán ăn gần trường.'
  },
  {
    id: 'shift-2',
    date: '2026-04-20',
    label: 'Việc làm thêm',
    startTime: '13:00',
    endTime: '17:00',
    hourlyWage: 11000,
    breakMinutes: 0,
    notes: 'Ca trưa hỗ trợ phục vụ.'
  },
  {
    id: 'shift-3',
    date: '2026-04-26',
    label: 'Cafe',
    startTime: '18:00',
    endTime: '23:30',
    hourlyWage: 12000,
    breakMinutes: 30,
    notes: 'Ca tối cuối tuần, đông khách hơn.'
  }
];

export const demoCompanions: CompanionProfile[] = [
  {
    id: 'friend-1',
    displayName: 'Minh Anh',
    school: 'Yonsei KLI',
    region: 'Seoul - Hongdae',
    focus: 'Thích học tiếng Hàn buổi sáng và hẹn cafe cuối tuần.',
    availability: 'Tối thứ 4 hoặc cuối tuần',
    tags: ['TOPIK', 'Cafe', 'Học nhóm']
  },
  {
    id: 'friend-2',
    displayName: 'Gia Hân',
    school: 'Konkuk University',
    region: 'Seoul - Konkuk',
    focus: 'Quan tâm việc làm thêm, chi tiêu tiết kiệm và săn đồ Việt.',
    availability: 'Sau 18:00 hằng ngày',
    tags: ['Part-time', 'Budget', 'Ăn uống']
  },
  {
    id: 'friend-3',
    displayName: 'Tuấn',
    school: 'Ajou University',
    region: 'Suwon',
    focus: 'Mới sang Hàn, muốn tìm bạn cùng khu để đỡ lạc lõng.',
    availability: 'Tối thứ 6',
    tags: ['Suwon', 'Mới sang', 'Tiếng Hàn']
  }
];

export const demoProfile: ProfileDraft = {
  displayName: 'Linh Nguyễn',
  school: 'Korea University',
  region: 'Seoul - Hongdae',
  note: 'Mình muốn tìm bạn cùng học tiếng Hàn, đi chợ Việt và chia sẻ kinh nghiệm việc làm thêm.'
};
