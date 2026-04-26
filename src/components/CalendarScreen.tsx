import { useEffect, useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Settings2, Plus } from 'lucide-react';
import { calculateShiftPay, shiftHours, formatKrw } from '../lib/salary';
import { Shift, ShiftDraft, VenueColors } from '../lib/types';
import { 
  buildCalendar, 
  formatCalendarKrw, 
  formatCalendarMonthTitle, 
  formatDateChip, 
  formatHoursCompact, 
  formatSelectedDate, 
  shiftMonth,
  getVenueColor,
  isKoreanHoliday
} from '../utils/helpers';

export function CalendarScreen({
  shifts,
  selectedDate,
  month,
  venueSuggestions,
  draft,
  setDraft,
  editingShiftId,
  setEditingShiftId,
  isSheetOpen,
  onCloseSheet,
  onPrevMonth,
  onNextMonth,
  onSetMonth,
  onSelectDate,
  onQuickSave,
  onUpdateShift,
  onDeleteShift,
  venueColors,
  onSetVenueColor
}: {
  shifts: Shift[];
  selectedDate: string;
  month: string;
  venueSuggestions: string[];
  draft: ShiftDraft;
  setDraft: (next: ShiftDraft) => void;
  editingShiftId: string | null;
  setEditingShiftId: (id: string | null) => void;
  isSheetOpen: boolean;
  onCloseSheet: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSetMonth: (monthIso: string) => void;
  onSelectDate: (date: string) => void;
  onQuickSave: () => void;
  onUpdateShift: (shift: Shift) => void;
  onDeleteShift: (id: string) => void;
  venueColors: VenueColors;
  onSetVenueColor: (venue: string, color: string) => void;
}) {
  const VENUE_PALETTE = ['#2752ff', '#0d9b72', '#ff6b7a', '#f59e0b', '#9333ea', '#0891b2', '#e11d48', '#16a34a'];
  const grid = buildCalendar(month, shifts);
  const monthShifts = shifts.filter((shift) => shift.date.startsWith(month.slice(0, 7)));
  const monthTotal = monthShifts.reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0);
  const monthHours = monthShifts.reduce((sum, shift) => sum + shiftHours(shift), 0);
  const [selectedVenue, setSelectedVenue] = useState('all');
  const [calendarDisplay, setCalendarDisplay] = useState<'duration' | 'range'>('duration');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date(`${month}T00:00:00`).getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date(`${month}T00:00:00`).getMonth() + 1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  const currentMonthISO = new Date().toISOString().slice(0, 7) + '-01';
  const isNotCurrentMonth = month.slice(0, 7) !== currentMonthISO.slice(0, 7);
  
  const monthWorkplaces = [...new Set(monthShifts.map((shift) => shift.label))];
  const monthWorkplaceKey = monthWorkplaces.join('|');
  const effectiveVenue = monthWorkplaces.includes(selectedVenue) ? selectedVenue : monthWorkplaces[0] ?? '';
  const filteredLedger = (effectiveVenue ? monthShifts.filter((shift) => shift.label === effectiveVenue) : []).sort((a, b) =>
    `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)
  );
  
  const calendarYear = new Date(`${month}T00:00:00`).getFullYear();
  const yearOptions = Array.from({ length: 9 }, (_, index) => calendarYear - 4 + index);
  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  
  const quickPreview = calculateShiftPay({
    id: 'quick-preview',
    date: draft.date,
    label: draft.venue,
    startTime: draft.startTime,
    endTime: draft.endTime,
    hourlyWage: draft.hourlyWage,
    breakMinutes: draft.breakMinutes,
    notes: draft.note,
    nightShift: draft.nightShift,
    taxDeduction: draft.taxDeduction,
    holidayAllowance: draft.holidayAllowance
  }).total;

  useEffect(() => {
    if (effectiveVenue !== selectedVenue) setSelectedVenue(effectiveVenue);
  }, [effectiveVenue, monthWorkplaceKey, selectedVenue]);

  function getCalendarShiftLine(shift: Shift) {
    const trim = (value: string) => value.replace(':00', '');
    return calendarDisplay === 'range' ? `${trim(shift.startTime)}~${trim(shift.endTime)}` : formatHoursCompact(shiftHours(shift));
  }

  function shiftColor(shift: Shift) {
    return getVenueColor(shift.label, venueColors);
  }

  function startNewShift(date: string) {
    setEditingShiftId(null);
    onSelectDate(date);
  }

  function startEditShift(shift: Shift) {
    setEditingShiftId(shift.id);
    setDraft({
      venue: shift.label,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      hourlyWage: shift.hourlyWage,
      label: shift.notes,
      note: shift.notes,
      nightShift: shift.nightShift,
      taxDeduction: shift.taxDeduction,
      holidayAllowance: shift.holidayAllowance
    });
    setIsHistoryOpen(false);
    onSelectDate(shift.date);
  }

  function deleteShift(id: string) {
    onDeleteShift(id);
    if (editingShiftId === id) {
      setEditingShiftId(null);
      onCloseSheet();
    }
  }

  function saveSheetShift() {
    if (!editingShiftId) {
      onQuickSave();
      return;
    }

    onUpdateShift({
      id: editingShiftId,
      date: draft.date,
      label: draft.venue,
      startTime: draft.startTime,
      endTime: draft.endTime,
      hourlyWage: draft.hourlyWage,
      breakMinutes: draft.breakMinutes,
      notes: draft.note || draft.label,
      nightShift: draft.nightShift,
      taxDeduction: draft.taxDeduction,
      holidayAllowance: draft.holidayAllowance
    });
    setEditingShiftId(null);
    onCloseSheet();
  }

  function openMonthPicker() {
    const current = new Date(`${month}T00:00:00`);
    setPickerYear(current.getFullYear());
    setPickerMonth(current.getMonth() + 1);
    setIsMonthPickerOpen(true);
  }

  function confirmMonthPicker() {
    onSetMonth(`${pickerYear}-${String(pickerMonth).padStart(2, '0')}-01`);
    setIsMonthPickerOpen(false);
  }

  function handleCalendarSwipe(endX: number, endY: number) {
    if (touchStart === null) return;
    const deltaX = endX - touchStart.x;
    const deltaY = endY - touchStart.y;
    setTouchStart(null);
    if (Math.abs(deltaX) < 80) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 2) return;
    if (deltaX > 0) onPrevMonth();
    else onNextMonth();
  }

  async function downloadCalendarImage() {
    if (!calendarRef.current) return;
    
    try {
      const dataUrl = await toPng(calendarRef.current, {
        backgroundColor: '#ffffff',
        style: {
          borderRadius: '0',
          boxShadow: 'none',
          padding: '20px'
        },
        pixelRatio: 2
      });
      
      const link = document.createElement('a');
      link.download = `lich-lam-viec-${formatCalendarMonthTitle(month)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Lỗi khi tải ảnh:', error);
    }
  }

  return (
    <>
      <header className="appbar compact">
        <div>
          <p className="appbar-kicker">Lịch làm việc</p>
          <div className="calendar-title-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="appbar-title calendar-title-large" onClick={openMonthPicker}>
              {formatCalendarMonthTitle(month)}
              <ChevronDown size={24} />
            </button>
            {isNotCurrentMonth && (
              <button 
                type="button" 
                className="today-pill-btn" 
                onClick={() => onSetMonth(currentMonthISO)}
                style={{
                  background: '#eff6ff',
                  color: '#2752ff',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                TODAY
              </button>
            )}
          </div>
        </div>
        <div className="calendar-head-actions">
          <button type="button" className="calendar-icon-button" onClick={downloadCalendarImage} aria-label="Tải ảnh lịch">
            <Download size={22} />
          </button>
          <button type="button" className="calendar-icon-button" onClick={() => setIsSettingsOpen(true)} aria-label="Cài đặt lịch">
            <Settings2 size={22} />
          </button>
        </div>
      </header>

      <section
        ref={calendarRef}
        className="calendar-surface"
        onTouchStart={(event) => setTouchStart({ x: event.touches[0]?.clientX ?? 0, y: event.touches[0]?.clientY ?? 0 })}
        onTouchEnd={(event) => handleCalendarSwipe(event.changedTouches[0]?.clientX ?? 0, event.changedTouches[0]?.clientY ?? 0)}
      >
        <div className="calendar-toolbar">
          <button type="button" className="calendar-month-nav" onClick={onPrevMonth} aria-label="Tháng trước">
            <ChevronLeft size={18} />
          </button>
          <div className="calendar-chip-track">
            {monthWorkplaces.map((venue) => (
              <button
                key={venue}
                type="button"
                className={effectiveVenue === venue ? 'calendar-summary-chip active' : 'calendar-summary-chip'}
                onClick={() => {
                  setSelectedVenue(venue);
                  setIsHistoryOpen(true);
                }}
              >
                {venue}
              </button>
            ))}
          </div>
          <strong className="calendar-total-fixed">{formatCalendarKrw(monthTotal)}</strong>
          <button type="button" className="calendar-month-nav" onClick={onNextMonth} aria-label="Tháng sau">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-weekdays">
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {grid.map((cell, index) => {
            const dayOfWeek = index % 7;
            if (!cell) return <div key={`empty-${index}`} className="calendar-empty" />;

            const isSelected = cell.date === selectedDate;
            const isToday = cell.date === new Date().toISOString().slice(0, 10);
            const isHoliday = isKoreanHoliday(cell.date);
            const toneClass = (dayOfWeek === 0 || isHoliday) ? ' sunday' : dayOfWeek === 6 ? ' saturday' : '';
            const holidayClass = isHoliday ? ' holiday' : '';
            const outsideClass = cell.inMonth ? '' : ' outside';
            const cellClassName = `${isSelected ? 'calendar-day selected' : 'calendar-day'}${toneClass}${holidayClass}${isToday ? ' today' : ''}${outsideClass}`;

            return (
              <button key={cell.date} type="button" className={cellClassName} onClick={() => startNewShift(cell.date)}>
                <div className="calendar-day-top">
                  <span className="calendar-date-number">{cell.day}</span>
                  {isToday ? <span className="calendar-today-dot" /> : null}
                </div>
                <div className="calendar-shift-lines">
                  {cell.items.slice(0, 2).map((shift, lineIndex) => (
                    <span
                      key={`${cell.date}-${lineIndex}`}
                      className="calendar-shift-line"
                      style={{ background: shiftColor(shift) }}
                    >
                      {getCalendarShiftLine(shift)}
                    </span>
                  ))}
                  {cell.items.length > 2 ? <span className="calendar-shift-more">+{cell.items.length - 2} ca</span> : null}
                </div>
                {cell.total > 0 ? <strong className="calendar-amount">{formatCalendarKrw(cell.total)}</strong> : <span className="calendar-placeholder" />}
              </button>
            );
          })}
        </div>
      </section>

      {isMonthPickerOpen ? (
        <section className="calendar-modal-backdrop" onClick={() => setIsMonthPickerOpen(false)}>
          <div className="calendar-modal month-wheel-modal" onClick={(event) => event.stopPropagation()}>
            <div className="month-wheel-actions">
              <button type="button" onClick={() => setIsMonthPickerOpen(false)}>Huỷ</button>
              <button type="button" onClick={confirmMonthPicker}>Xác nhận</button>
            </div>
            <div className="month-wheel-picker">
              <div className="wheel-column">
                {monthOptions.map((monthNumber) => (
                  <button key={monthNumber} type="button" className={pickerMonth === monthNumber ? 'active' : ''} onClick={() => setPickerMonth(monthNumber)}>
                    Tháng {monthNumber}
                  </button>
                ))}
              </div>
              <div className="wheel-column">
                {yearOptions.map((year) => (
                  <button key={year} type="button" className={pickerYear === year ? 'active' : ''} onClick={() => setPickerYear(year)}>
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isSettingsOpen ? (
        <section className="calendar-modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="calendar-modal settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="settings-title">Cài đặt lịch</h3>

            <div className="settings-group">
              <label className="settings-label">Kiểu hiển thị giờ làm</label>
              <div className="settings-select-wrap">
                <select
                  className="settings-select"
                  value={calendarDisplay}
                  onChange={(e) => setCalendarDisplay(e.target.value as 'duration' | 'range')}
                >
                  <option value="duration">Thời lượng (ví dụ: 4h)</option>
                  <option value="range">Khung giờ (ví dụ: 18:00-22:00)</option>
                </select>
                <ChevronDown size={16} className="select-chevron" />
              </div>
            </div>

            {monthWorkplaces.length > 0 ? (
              <div className="settings-group">
                <label className="settings-label">Màu nơi làm</label>
                <div className="venue-color-list">
                  {monthWorkplaces.map((venue) => {
                    const currentColor = getVenueColor(venue, venueColors);
                    return (
                      <div key={venue} className="venue-color-row">
                        <div className="venue-color-preview" style={{ background: currentColor }} />
                        <span className="venue-color-name">{venue}</span>
                        <div className="settings-select-wrap mini">
                          <select
                            className="settings-select"
                            value={currentColor}
                            onChange={(e) => onSetVenueColor(venue, e.target.value)}
                            style={{ paddingLeft: 12 }}
                          >
                            {VENUE_PALETTE.map((color) => (
                              <option key={color} value={color} style={{ color }}>
                                {color === '#2752ff' ? '🔵 Xanh dương' : color === '#0d9b72' ? '🟢 Xanh lá' : color === '#ff6b7a' ? '🔴 Hồng' : color === '#f59e0b' ? '🟡 Vàng' : color === '#9333ea' ? '🟣 Tím' : color === '#0891b2' ? '🔵 Cyan' : color === '#e11d48' ? '🔴 Đỏ' : '🟢 Lục'}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="select-chevron" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {isHistoryOpen ? (
        <section className="calendar-modal-backdrop" onClick={() => setIsHistoryOpen(false)}>
          <div className="calendar-modal history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="calendar-modal-head">
              <strong>{effectiveVenue || 'Lịch sử làm việc'}</strong>
              <span>{filteredLedger.length} ca</span>
            </div>
            <div className="history-list">
              {filteredLedger.map((shift) => (
                <article key={shift.id} className="history-row">
                  <button type="button" className="history-main" onClick={() => startEditShift(shift)}>
                    <strong>{formatDateChip(shift.date)}</strong>
                    <span>
                      {shift.startTime}-{shift.endTime} • {formatHoursCompact(shiftHours(shift))}
                    </span>
                  </button>
                  <strong className="history-pay">{formatCalendarKrw(calculateShiftPay(shift).total)}</strong>
                  <div className="history-actions">
                    <button type="button" onClick={() => startEditShift(shift)}>Sửa</button>
                    <button type="button" className="danger" onClick={() => deleteShift(shift.id)}>Xoá</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {isSheetOpen ? (
        <section className="day-sheet-backdrop" onClick={onCloseSheet}>
          <div className="day-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <div>
                <p className="section-kicker">{editingShiftId ? 'Sửa giờ làm' : 'Thêm giờ làm thêm'}</p>
                <h3>{formatSelectedDate(selectedDate)}</h3>
              </div>
              <div className="sheet-preview">
                <span>Ước tính</span>
                <strong>{formatKrw(quickPreview)}</strong>
              </div>
            </div>

            <div className="sheet-history-list">
              {shifts
                .filter((shift) => shift.date === draft.date)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((shift) => (
                  <article key={shift.id} className={editingShiftId === shift.id ? 'sheet-history-row active' : 'sheet-history-row'}>
                    <button type="button" onClick={() => startEditShift(shift)}>
                      <strong>{shift.label}</strong>
                      <span>
                        {shift.startTime}-{shift.endTime} • {formatCalendarKrw(calculateShiftPay(shift).total)}
                      </span>
                    </button>
                    <button type="button" className="danger" onClick={() => deleteShift(shift.id)}>Xoá</button>
                  </article>
                ))}
            </div>

            {venueSuggestions.length ? (
              <div className="venue-presets">
                {venueSuggestions.map((venue) => (
                  <button
                    key={venue}
                    type="button"
                    className={venue === draft.venue ? 'preset-chip active' : 'preset-chip'}
                    onClick={() => setDraft({ ...draft, venue, label: venue })}
                  >
                    {venue}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="quick-grid">
              <label className="micro-field wide">
                <span>Nơi làm</span>
                <input value={draft.venue} onChange={(event) => setDraft({ ...draft, venue: event.target.value })} />
              </label>
              <label className="micro-field wide">
                <span>Ghi chú nhanh</span>
                <input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
              </label>
              <label className="micro-field">
                <span>Bắt đầu</span>
                <input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} />
              </label>
              <label className="micro-field">
                <span>Kết thúc</span>
                <input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} />
              </label>
              <label className="micro-field">
                <span>Lương giờ</span>
                <input type="number" value={draft.hourlyWage} onChange={(event) => setDraft({ ...draft, hourlyWage: Number(event.target.value) })} />
              </label>
              <label className="micro-field">
                <span>Nghỉ</span>
                <input type="number" value={draft.breakMinutes} onChange={(event) => setDraft({ ...draft, breakMinutes: Number(event.target.value) })} />
              </label>
            </div>
            
            {/* NEW: Luật lao động Hàn Quốc */}
            <div className="korean-law-fields" style={{ marginTop: '16px', background: '#f5f7fa', padding: '16px', borderRadius: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 800, color: '#08162b', marginBottom: '12px' }}>Cài đặt tính lương (Luật HQ)</p>
              
              <label className="korean-law-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '14px', color: '#08162b' }}>Thuế 3.3%</strong>
                  <span style={{ fontSize: '12px', color: '#657080' }}>Dành cho freelancer/Alba</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={draft.taxDeduction || false} 
                  onChange={(event) => setDraft({ ...draft, taxDeduction: event.target.checked })} 
                  style={{ width: '20px', height: '20px', accentColor: '#2752ff' }}
                />
              </label>

              <label className="korean-law-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '14px', color: '#08162b' }}>Phụ cấp ca đêm (x1.5)</strong>
                  <span style={{ fontSize: '12px', color: '#657080' }}>Thường áp dụng sau 22:00</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={draft.nightShift || false} 
                  onChange={(event) => setDraft({ ...draft, nightShift: event.target.checked })} 
                  style={{ width: '20px', height: '20px', accentColor: '#2752ff' }}
                />
              </label>

              <label className="korean-law-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <strong style={{ fontSize: '14px', color: '#08162b' }}>Phụ cấp nghỉ / Cuối tuần (주휴수당)</strong>
                <div className="settings-select-wrap">
                  <input 
                    type="number" 
                    className="settings-select"
                    style={{ background: 'white' }}
                    value={draft.holidayAllowance || ''} 
                    onChange={(event) => setDraft({ ...draft, holidayAllowance: Number(event.target.value) })} 
                    placeholder="Nhập số tiền phụ cấp (nếu có)" 
                  />
                  <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#657080', fontSize: '13px', fontWeight: 700 }}>KRW</span>
                </div>
              </label>
            </div>

            <button type="button" className="quick-save-button" onClick={saveSheetShift} style={{ marginTop: '16px' }}>
              <Plus size={16} />
              {editingShiftId ? 'Lưu thay đổi' : 'Lưu ca cho ngày này'}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
