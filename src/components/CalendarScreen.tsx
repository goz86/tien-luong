import { useEffect, useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Settings2, Plus, Clock } from 'lucide-react';
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
import { Logo } from './shared/Logo';
import { TimeWheelModal } from './shared/TimeWheelModal';
import { MinuteWheelModal } from './shared/MinuteWheelModal';
import { DateWheelModal } from './shared/DateWheelModal';

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
  const monthShifts = shifts.filter((shift) => shift.date.startsWith(month.slice(0, 7)));
  const [selectedVenue, setSelectedVenue] = useState('all');
  const monthWorkplaces = [...new Set(monthShifts.map((shift) => shift.label))];
  const effectiveVenue = selectedVenue === 'all' ? 'all' : (monthWorkplaces.includes(selectedVenue) ? selectedVenue : 'all');

  const filteredMonthShifts = effectiveVenue === 'all' ? monthShifts : monthShifts.filter((shift) => shift.label === effectiveVenue);
  const gridShifts = effectiveVenue === 'all' ? shifts : shifts.filter((shift) => shift.label === effectiveVenue);

  const grid = buildCalendar(month, gridShifts);
  const monthTotal = filteredMonthShifts.reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0);
  const monthHours = filteredMonthShifts.reduce((sum, shift) => sum + shiftHours(shift), 0);
  
  const [calendarDisplay, setCalendarDisplay] = useState<'duration' | 'range'>('duration');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date(`${month}T00:00:00`).getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date(`${month}T00:00:00`).getMonth() + 1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toLocaleDateString('sv-SE');
  const currentMonthISO = todayStr.slice(0, 7) + '-01';
  const isNotCurrentMonth = month.slice(0, 7) !== currentMonthISO.slice(0, 7);

  const filteredLedger = filteredMonthShifts.sort((a, b) =>
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

  // Custom Select State
  const [activeSelect, setActiveSelect] = useState<string | null>(null);

  const monthColRef = useRef<HTMLDivElement>(null);
  const yearColRef = useRef<HTMLDivElement>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<'history' | 'form'>('form');

  const [isStartTimeOpen, setIsStartTimeOpen] = useState(false);
  const [isEndTimeOpen, setIsEndTimeOpen] = useState(false);
  const [isBreakTimeOpen, setIsBreakTimeOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      if (activeSelect && !target.closest('.settings-select-wrap')) {
        setActiveSelect(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeSelect]);

  // Scroll to active month/year when picker opens
  useEffect(() => {
    if (isMonthPickerOpen) {
      const timer = setTimeout(() => {
        monthColRef.current?.querySelector('.active')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        yearColRef.current?.querySelector('.active')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMonthPickerOpen]);

  useEffect(() => {
    if (effectiveVenue !== selectedVenue) setSelectedVenue(effectiveVenue);
  }, [effectiveVenue, selectedVenue]);

  // Back button support: close modals when pressing back
  useEffect(() => {
    function handlePopstate() {
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        setActiveSelect(null);
        return;
      }
      if (isHistoryOpen) {
        setIsHistoryOpen(false);
        return;
      }
      if (isMonthPickerOpen) {
        setIsMonthPickerOpen(false);
        return;
      }
    }
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [isSettingsOpen, isHistoryOpen, isMonthPickerOpen]);

  // Push history entry when opening modals
  useEffect(() => {
    if (isSettingsOpen || isHistoryOpen || isMonthPickerOpen) {
      history.pushState({ calendarModal: true }, '');
    }
  }, [isSettingsOpen, isHistoryOpen, isMonthPickerOpen]);

  function getCalendarShiftLine(shift: Shift) {
    const trim = (value: string) => value.replace(':00', '');
    return calendarDisplay === 'range' ? `${trim(shift.startTime)}~${trim(shift.endTime)}` : formatHoursCompact(shiftHours(shift));
  }

  function shiftColor(shift: Shift) {
    return getVenueColor(shift.label, venueColors);
  }

  function startNewShift(date: string) {
    const dayShifts = shifts.filter(s => s.date === date);
    setSheetMode(dayShifts.length > 0 ? 'history' : 'form');
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
    setSheetMode('form');
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
      const el = calendarRef.current;
      const width = el.offsetWidth + 20;
      const height = el.offsetHeight + 20;

      const dataUrl = await toPng(el, {
        backgroundColor: '#ffffff',
        width: width,
        height: height,
        style: {
          borderRadius: '0',
          boxShadow: 'none',
          padding: '10px',
          margin: '0',
          width: `${width}px`,
          height: `${height}px`
        },
        pixelRatio: 3,
        filter: (node) => {
          // Ẩn 2 nút điều hướng tháng
          if (node.classList && typeof node.classList.contains === 'function') {
            if (node.classList.contains('calendar-month-nav')) return false;
            // Chỉ ẩn các chip không được chọn (giữ lại chip đang active để hiển thị tiêu đề nơi làm việc)
            if (node.classList.contains('calendar-summary-chip') && !node.classList.contains('active')) return false;
          }
          return true;
        }
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
      <header className="appbar compact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="calendar-title-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="appbar-title calendar-title-large" onClick={openMonthPicker} style={{ fontSize: '18px' }}>
              {formatCalendarMonthTitle(month)}
              <ChevronDown size={20} />
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
            {monthWorkplaces.map((venue) => {
              const isActive = effectiveVenue === venue;
              const venueColor = getVenueColor(venue, venueColors);
              return (
                <button
                  key={venue}
                  type="button"
                  className={isActive ? 'calendar-summary-chip active' : 'calendar-summary-chip'}
                  onClick={() => {
                    setSelectedVenue(isActive ? 'all' : venue);
                  }}
                  style={{
                    background: isActive ? venueColor : `${venueColor}15`,
                    color: isActive ? 'white' : venueColor,
                    boxShadow: isActive ? `0 10px 22px ${venueColor}40` : 'none',
                    border: `1px solid ${venueColor}${isActive ? '00' : '40'}`,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {venue}
                </button>
              );
            })}
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
            const isToday = cell.date === todayStr;
            const isHoliday = isKoreanHoliday(cell.date);
            const toneClass = (dayOfWeek === 0 || isHoliday) ? ' sunday' : dayOfWeek === 6 ? ' saturday' : '';
            const holidayClass = isHoliday ? ' holiday' : '';
            const outsideClass = cell.inMonth ? '' : ' outside';
            const cellClassName = `${isSelected ? 'calendar-day selected' : 'calendar-day'}${toneClass}${holidayClass}${isToday ? ' today' : ''}${outsideClass}`;

            return (
              <button key={cell.date} type="button" className={cellClassName} onClick={() => startNewShift(cell.date)}>
                <div className="calendar-day-top">
                  <span className={`calendar-date-number ${isToday ? 'today-number' : ''}`}>{cell.day}</span>
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
        <section className="calendar-modal-backdrop" onClick={() => { setIsMonthPickerOpen(false); setActiveSelect(null); }}>
          <div className="calendar-modal month-wheel-modal" onClick={(event) => event.stopPropagation()}>
            <div className="month-wheel-actions">
              <button type="button" onClick={() => setIsMonthPickerOpen(false)}>Huỷ</button>
              <button type="button" onClick={confirmMonthPicker}>Xác nhận</button>
            </div>
            <div className="month-wheel-picker">
              <div className="wheel-column" ref={monthColRef}>
                {monthOptions.map((monthNumber) => (
                  <button key={monthNumber} type="button" className={pickerMonth === monthNumber ? 'active' : ''} onClick={() => setPickerMonth(monthNumber)}>
                    Tháng {monthNumber}
                  </button>
                ))}
              </div>
              <div className="wheel-column" ref={yearColRef}>
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
        <section className="calendar-modal-backdrop" onClick={() => { setIsSettingsOpen(false); setActiveSelect(null); }}>
          <div className="calendar-modal settings-modal" onClick={(event) => event.stopPropagation()} style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom))' }}>
            <div className="sheet-handle" />
            <h3 className="settings-title">Cài đặt lịch</h3>

            <div className="settings-group">
              <label className="settings-label">Kiểu hiển thị giờ làm</label>
              <div className="settings-select-wrap">
                <button
                  type="button"
                  className="settings-select-trigger"
                  onClick={() => setActiveSelect(activeSelect === 'display' ? null : 'display')}
                >
                  {calendarDisplay === 'duration' ? 'Thời gian làm (ví dụ: 4h)' : 'Khung giờ (ví dụ: 18:00-22:00)'}
                  <ChevronDown size={16} className={`select-chevron ${activeSelect === 'display' ? 'open' : ''}`} />
                </button>
                {activeSelect === 'display' && (
                  <div className="settings-dropdown">
                    <button type="button" onClick={() => { setCalendarDisplay('duration'); setActiveSelect(null); }}>Thời gian làm (ví dụ: 4h)</button>
                    <button type="button" onClick={() => { setCalendarDisplay('range'); setActiveSelect(null); }}>Khung giờ (ví dụ: 18:00-22:00)</button>
                  </div>
                )}
              </div>
            </div>

            {monthWorkplaces.length > 0 ? (
              <div className="settings-group">
                <label className="settings-label">Màu nơi làm</label>
                <div className="venue-color-list">
                  {monthWorkplaces.map((venue) => {
                    const currentColor = getVenueColor(venue, venueColors);
                    const isOpen = activeSelect === venue;
                    return (
                      <div key={venue} className="venue-color-item">
                        <div className="venue-color-row" onClick={() => setActiveSelect(isOpen ? null : venue)} style={{ cursor: 'pointer' }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 'bold', color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {venue || 'Không có tên'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <div className="venue-color-dot" style={{ background: currentColor, width: '18px', height: '18px' }} />
                            <ChevronDown size={14} style={{ color: '#657080', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                          </div>
                        </div>
                        {isOpen && (
                          <div className="venue-color-palette">
                            {VENUE_PALETTE.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`venue-palette-dot${color === currentColor ? ' active' : ''}`}
                                style={{ background: color }}
                                onClick={() => { onSetVenueColor(venue, color); setActiveSelect(null); }}
                                title={color === '#2752ff' ? 'Xanh dương' : color === '#0d9b72' ? 'Xanh lá' : color === '#ff6b7a' ? 'Hồng' : color === '#f59e0b' ? 'Vàng' : color === '#9333ea' ? 'Tím' : color === '#0891b2' ? 'Cyan' : color === '#e11d48' ? 'Đỏ' : 'Lục'}
                              />
                            ))}
                          </div>
                        )}
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
        <section className="calendar-modal-backdrop" onClick={() => { setIsHistoryOpen(false); setActiveSelect(null); }}>
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
                    <button type="button" className="danger" onClick={() => setDeleteConfirmId(shift.id)}>Xoá</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {isSheetOpen ? (
        <section className="day-sheet-backdrop" onClick={() => { onCloseSheet(); setActiveSelect(null); }}>
          <div className="day-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head" style={{ alignItems: 'flex-end' }}>
              <div>
                <p className="section-kicker">
                  {sheetMode === 'history' ? 'Lịch sử ca làm' : (editingShiftId ? 'Sửa giờ làm' : 'Thêm giờ làm thêm')}
                </p>
                {sheetMode === 'form' ? (
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(true)}
                    style={{
                      background: 'none', border: 'none', padding: 0, margin: 0,
                      textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#08162b', margin: 0 }}>
                      {formatSelectedDate(draft.date)}
                    </h3>
                    <ChevronDown size={20} color="#64748b" />
                  </button>
                ) : (
                  <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#08162b', margin: 0 }}>
                    {formatSelectedDate(selectedDate)}
                  </h3>
                )}
              </div>
              <div className="sheet-preview">
                {sheetMode === 'history' && <span>Tổng ngày</span>}
                <strong style={{ marginTop: 0 }}>
                  {formatKrw(sheetMode === 'history' ? shifts.filter(s => s.date === selectedDate).reduce((sum, s) => sum + calculateShiftPay(s).total, 0) : quickPreview)}
                </strong>
              </div>
            </div>

            {sheetMode === 'history' ? (
              <div className="sheet-history-mode">
                <div className="sheet-history-list" style={{ marginTop: '0', maxHeight: '40vh', overflowY: 'auto' }}>
                  {shifts
                    .filter((shift) => shift.date === selectedDate)
                    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                    .map((shift) => (
                      <article key={shift.id} className="sheet-history-row">
                        <button type="button" onClick={() => startEditShift(shift)}>
                          <strong>{shift.label}</strong>
                          <span>
                            {shift.startTime}-{shift.endTime} • {formatCalendarKrw(calculateShiftPay(shift).total)}
                          </span>
                        </button>
                        <button type="button" className="danger" onClick={() => setDeleteConfirmId(shift.id)}>Xoá</button>
                      </article>
                    ))}
                </div>

                <button
                  type="button"
                  className="quick-save-button"
                  style={{ marginTop: '20px' }}
                  onClick={() => {
                    setSheetMode('form');
                    setDraft({ ...draft, note: '' });
                  }}
                >
                  <Plus size={16} />
                  Thêm ca làm mới cho ngày này
                </button>
              </div>
            ) : (
              <div className="sheet-form-mode">

                {venueSuggestions.length ? (
                  <div className="venue-presets">
                    {venueSuggestions.map((venue) => {
                      const isActive = venue === draft.venue;
                      const venueColor = getVenueColor(venue, venueColors);
                      return (
                        <button
                          key={venue}
                          type="button"
                          className={isActive ? 'preset-chip active' : 'preset-chip'}
                          onClick={() => setDraft({ ...draft, venue, label: venue })}
                          style={isActive ? {
                            background: venueColor,
                            borderColor: venueColor,
                            color: 'white',
                            boxShadow: `0 4px 12px ${venueColor}30`
                          } : {
                            borderColor: `${venueColor}40`,
                            color: venueColor,
                            background: `${venueColor}10`
                          }}
                        >
                          {venue}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="quick-grid">
                  <label className="micro-field wide">
                    <span>Nơi làm</span>
                    <input value={draft.venue} onChange={(event) => setDraft({ ...draft, venue: event.target.value })} />
                  </label>
                  <label className="micro-field wide">
                    <span>Ghi chú nhanh</span>
                    <input
                      className="premium-input"
                      value={draft.note}
                      onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                      placeholder="Nhập ghi chú..."
                    />
                  </label>
                </div>

                <div className="sheet-row">
                  <label className="micro-field">
                    <span className="field-label">Bắt đầu</span>
                    <button
                      type="button"
                      className="premium-input"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}
                      onClick={() => setIsStartTimeOpen(true)}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#08162b' }}>{draft.startTime}</span>
                      <Clock size={16} color="#657080" />
                    </button>
                  </label>
                  <label className="micro-field">
                    <span className="field-label">Kết thúc</span>
                    <button
                      type="button"
                      className="premium-input"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}
                      onClick={() => setIsEndTimeOpen(true)}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#08162b' }}>{draft.endTime}</span>
                      <Clock size={16} color="#657080" />
                    </button>
                  </label>
                </div>

                <div className="sheet-row">
                  <label className="micro-field">
                    <span className="field-label">Lương giờ</span>
                    <div className="settings-select-wrap">
                      <input
                        type="number"
                        className="premium-input"
                        value={draft.hourlyWage}
                        onChange={(event) => setDraft({ ...draft, hourlyWage: Number(event.target.value) })}
                      />
                      <span className="input-unit">KRW</span>
                    </div>
                    <button
                      type="button"
                      className="min-wage-badge-v2"
                      onClick={() => setDraft({ ...draft, hourlyWage: 10320 })}
                      style={{ marginTop: '2px' }}
                    >
                      Mức tối thiểu: 10,320
                    </button>
                  </label>
                  <label className="micro-field">
                    <span className="field-label">Thời gian nghỉ</span>
                    <div className="settings-select-wrap">
                      <button
                        type="button"
                        className="premium-input"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}
                        onClick={() => setIsBreakTimeOpen(true)}
                      >
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#08162b' }}>{draft.breakMinutes}</span>
                        <span className="input-unit" style={{ position: 'static', transform: 'none' }}>phút</span>
                      </button>
                    </div>
                  </label>
                </div>

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
                        className="premium-input"
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
            )}
          </div>
        </section>
      ) : null}

      {deleteConfirmId && (
        <section className="calendar-modal-backdrop confirm-backdrop" onClick={() => setDeleteConfirmId(null)}>
          <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="confirm-content">
              <h3>Xác nhận</h3>
              <p>Bạn có chắc chắn muốn xoá ca làm việc này không? Dữ liệu đã xoá sẽ không thể khôi phục.</p>
            </div>
            <div className="confirm-footer">
              <button type="button" className="confirm-btn cancel" onClick={() => setDeleteConfirmId(null)}>Hủy bỏ</button>
              <button
                type="button"
                className="confirm-btn danger"
                onClick={() => {
                  deleteShift(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </section>
      )}

      {isStartTimeOpen && (
        <TimeWheelModal
          initialTime={draft.startTime}
          title="Bắt đầu"
          onClose={() => setIsStartTimeOpen(false)}
          onConfirm={(time) => {
            setDraft({ ...draft, startTime: time });
            setIsStartTimeOpen(false);
          }}
        />
      )}
      {isEndTimeOpen && (
        <TimeWheelModal
          initialTime={draft.endTime}
          title="Kết thúc"
          onClose={() => setIsEndTimeOpen(false)}
          onConfirm={(time) => {
            setDraft({ ...draft, endTime: time });
            setIsEndTimeOpen(false);
          }}
        />
      )}
      {isBreakTimeOpen && (
        <MinuteWheelModal
          initialMinutes={draft.breakMinutes}
          title="Thời gian nghỉ"
          onClose={() => setIsBreakTimeOpen(false)}
          onConfirm={(minutes) => {
            setDraft({ ...draft, breakMinutes: minutes });
            setIsBreakTimeOpen(false);
          }}
        />
      )}
      {isDatePickerOpen && (
        <DateWheelModal
          title="Chọn ngày"
          initialDate={draft.date}
          onClose={() => setIsDatePickerOpen(false)}
          onConfirm={(date) => {
            setDraft({ ...draft, date });
            setIsDatePickerOpen(false);
          }}
        />
      )}
    </>
  );
}
