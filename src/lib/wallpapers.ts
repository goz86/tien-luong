export type WallpaperKey = 'default' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'rose';
export type AppLang = 'vi' | 'ko';

export const WALLPAPERS: { key: WallpaperKey; label_vi: string; label_ko: string; gradient: string; preview: string }[] = [
  { key: 'default', label_vi: 'Mặc định', label_ko: '기본', gradient: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,249,253,0.96) 48%, #f3f6fb 100%)', preview: 'linear-gradient(135deg, #f8fafc, #e2e8f0)' },
  { key: 'ocean', label_vi: 'Đại dương', label_ko: '바다', gradient: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 48%, #7dd3fc 100%)', preview: 'linear-gradient(135deg, #bae6fd, #38bdf8)' },
  { key: 'sunset', label_vi: 'Hoàng hôn', label_ko: '노을', gradient: 'linear-gradient(180deg, #fef3c7 0%, #fde68a 30%, #fdba74 70%, #fb923c 100%)', preview: 'linear-gradient(135deg, #fde68a, #fb923c)' },
  { key: 'forest', label_vi: 'Rừng xanh', label_ko: '숲', gradient: 'linear-gradient(180deg, #dcfce7 0%, #bbf7d0 48%, #86efac 100%)', preview: 'linear-gradient(135deg, #bbf7d0, #4ade80)' },
  { key: 'lavender', label_vi: 'Lavender', label_ko: '라벤더', gradient: 'linear-gradient(180deg, #f3e8ff 0%, #e9d5ff 48%, #d8b4fe 100%)', preview: 'linear-gradient(135deg, #e9d5ff, #a855f7)' },
  { key: 'rose', label_vi: 'Hoa hồng', label_ko: '로즈', gradient: 'linear-gradient(180deg, #fff1f2 0%, #fecdd3 48%, #fda4af 100%)', preview: 'linear-gradient(135deg, #fecdd3, #fb7185)' },
];
