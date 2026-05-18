export type WallpaperKey = 'default' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'rose' | 'vietnam' | 'korea' | 'futureCat';
export type AppLang = 'vi' | 'ko';

export const WALLPAPERS: { key: WallpaperKey; label_vi: string; label_ko: string; gradient: string; preview: string }[] = [
  { key: 'default', label_vi: 'Mặc định', label_ko: '기본', gradient: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,249,253,0.96) 48%, #f3f6fb 100%)', preview: 'linear-gradient(135deg, #f8fafc, #e2e8f0)' },
  { key: 'ocean', label_vi: 'Đại dương', label_ko: '바다', gradient: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 48%, #7dd3fc 100%)', preview: 'linear-gradient(135deg, #bae6fd, #38bdf8)' },
  { key: 'sunset', label_vi: 'Hoàng hôn', label_ko: '노을', gradient: 'linear-gradient(180deg, #fef3c7 0%, #fde68a 30%, #fdba74 70%, #fb923c 100%)', preview: 'linear-gradient(135deg, #fde68a, #fb923c)' },
  { key: 'forest', label_vi: 'Rừng xanh', label_ko: '숲', gradient: 'linear-gradient(180deg, #dcfce7 0%, #bbf7d0 48%, #86efac 100%)', preview: 'linear-gradient(135deg, #bbf7d0, #4ade80)' },
  { key: 'lavender', label_vi: 'Lavender', label_ko: '라벤더', gradient: 'linear-gradient(180deg, #f3e8ff 0%, #e9d5ff 48%, #d8b4fe 100%)', preview: 'linear-gradient(135deg, #e9d5ff, #a855f7)' },
  { key: 'rose', label_vi: 'Hoa hồng', label_ko: '로즈', gradient: 'linear-gradient(180deg, #fff1f2 0%, #fecdd3 48%, #fda4af 100%)', preview: 'linear-gradient(135deg, #fecdd3, #fb7185)' },
  {
    key: 'vietnam',
    label_vi: 'Việt Nam',
    label_ko: '베트남',
    gradient: 'radial-gradient(circle at 18% 10%, rgba(255, 213, 79, 0.44) 0 8%, transparent 9%), radial-gradient(ellipse at 86% 18%, rgba(255, 255, 255, 0.58), transparent 24%), radial-gradient(ellipse at 15% 78%, rgba(244, 63, 94, 0.24), transparent 34%), radial-gradient(ellipse at 82% 86%, rgba(16, 185, 129, 0.18), transparent 30%), linear-gradient(180deg, #fff7ed 0%, #fecaca 40%, #f87171 100%)',
    preview: 'radial-gradient(circle at 22% 22%, #facc15 0 12%, transparent 13%), linear-gradient(135deg, #ef4444, #fef3c7 62%, #22c55e)',
  },
  {
    key: 'korea',
    label_vi: 'Hàn Quốc',
    label_ko: '한국',
    gradient: 'radial-gradient(circle at 78% 12%, rgba(239, 68, 68, 0.26), transparent 18%), radial-gradient(circle at 22% 18%, rgba(37, 99, 235, 0.25), transparent 20%), radial-gradient(ellipse at 84% 82%, rgba(20, 184, 166, 0.18), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #dbeafe 44%, #bfdbfe 100%)',
    preview: 'radial-gradient(circle at 32% 38%, #ef4444 0 18%, transparent 19%), radial-gradient(circle at 60% 58%, #2563eb 0 18%, transparent 19%), linear-gradient(135deg, #f8fafc, #93c5fd)',
  },
  {
    key: 'futureCat',
    label_vi: 'Mèo máy xanh',
    label_ko: '파란 로봇 고양이',
    gradient: 'radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.72), transparent 18%), radial-gradient(circle at 16% 18%, rgba(14, 165, 233, 0.34), transparent 22%), radial-gradient(circle at 86% 72%, rgba(245, 158, 11, 0.22), transparent 22%), linear-gradient(180deg, #e0f7ff 0%, #93c5fd 45%, #38bdf8 100%)',
    preview: 'radial-gradient(circle at 52% 30%, #ffffff 0 16%, transparent 17%), linear-gradient(135deg, #38bdf8, #2563eb 70%, #facc15)',
  },
];
