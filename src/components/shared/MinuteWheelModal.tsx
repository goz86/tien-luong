import { useState, useEffect } from 'react';
import { WheelPicker } from './WheelPicker';

interface MinuteWheelModalProps {
  initialMinutes: number;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
  title: string;
}

export function MinuteWheelModal({ initialMinutes, onClose, onConfirm, title }: MinuteWheelModalProps) {
  // 0, 5, 10 ... 120
  const minutesOptions = Array.from({ length: 25 }, (_, i) => i * 5);

  const [selectedMinute, setSelectedMinute] = useState(0);

  useEffect(() => {
    // Snap initial to nearest 5
    const snapped = Math.round(initialMinutes / 5) * 5;
    const safeValue = Math.min(Math.max(snapped, 0), 120);
    setSelectedMinute(safeValue);
  }, [initialMinutes]);

  const handleConfirm = () => {
    onConfirm(selectedMinute);
  };

  return (
    <section className="calendar-modal-backdrop" onClick={onClose}>
      <div className="calendar-modal time-wheel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="month-wheel-actions">
          <button type="button" onClick={onClose}>Huỷ</button>
          <strong style={{ fontSize: '16px', color: '#08162b' }}>{title}</strong>
          <button type="button" onClick={handleConfirm}>Xong</button>
        </div>
        
        <div style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', fontWeight: 700, paddingBottom: '8px', marginTop: '10px' }}>
          Phút
        </div>
        <div className="time-wheels-container single-wheel">
          <WheelPicker 
            options={minutesOptions} 
            value={selectedMinute} 
            onChange={(val) => setSelectedMinute(Number(val))} 
          />
        </div>
      </div>
    </section>
  );
}
