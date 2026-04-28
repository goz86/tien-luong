import { useState, useEffect } from 'react';
import { WheelPicker } from './WheelPicker';

interface DateWheelModalProps {
  initialDate: string; // format "YYYY-MM-DD"
  onClose: () => void;
  onConfirm: (date: string) => void;
  title: string;
}

export function DateWheelModal({ initialDate, onClose, onConfirm, title }: DateWheelModalProps) {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - 2 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  useEffect(() => {
    if (initialDate) {
      const parts = initialDate.split('-');
      if (parts.length === 3) {
        setSelectedYear(Number(parts[0]));
        setSelectedMonth(Number(parts[1]));
        setSelectedDay(Number(parts[2]));
      }
    }
  }, [initialDate]);

  // Handle day overflow when month changes
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedYear, selectedMonth, daysInMonth, selectedDay]);

  const handleConfirm = () => {
    const mStr = String(selectedMonth).padStart(2, '0');
    const dStr = String(selectedDay).padStart(2, '0');
    onConfirm(`${selectedYear}-${mStr}-${dStr}`);
  };

  return (
    <section className="calendar-modal-backdrop" onClick={onClose} style={{ zIndex: 3000 }}>
      <div className="calendar-modal time-wheel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="month-wheel-actions">
          <button type="button" onClick={onClose}>Huỷ</button>
          <strong style={{ fontSize: '16px', color: '#08162b' }}>{title}</strong>
          <button type="button" onClick={handleConfirm}>Xong</button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: 0, textAlign: 'center', fontSize: '13px', color: '#64748b', fontWeight: 700, paddingBottom: '8px', marginTop: '10px' }}>
          <div style={{ width: '100px' }}>Ngày</div>
          <div style={{ width: '100px' }}>Tháng</div>
          <div style={{ width: '100px' }}>Năm</div>
        </div>
        <div className="time-wheels-container" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
          <WheelPicker 
            options={dayOptions} 
            value={selectedDay} 
            onChange={(val) => setSelectedDay(Number(val))} 
          />
          <WheelPicker 
            options={monthOptions} 
            value={selectedMonth} 
            onChange={(val) => setSelectedMonth(Number(val))} 
          />
          <WheelPicker 
            options={yearOptions} 
            value={selectedYear} 
            onChange={(val) => setSelectedYear(Number(val))} 
          />
        </div>
      </div>
    </section>
  );
}
