import { useState, useEffect } from 'react';
import { WheelPicker } from './WheelPicker';

interface TimeWheelModalProps {
  initialTime: string; // format "HH:mm"
  onClose: () => void;
  onConfirm: (time: string) => void;
  title: string;
}

export function TimeWheelModal({ initialTime, onClose, onConfirm, title }: TimeWheelModalProps) {
  const hoursOptions = Array.from({ length: 24 }, (_, i) => i);
  const minutesOptions = Array.from({ length: 60 }, (_, i) => i);

  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedMinute, setSelectedMinute] = useState(0);

  useEffect(() => {
    if (initialTime) {
      const [h, m] = initialTime.split(':').map(Number);
      if (!isNaN(h)) setSelectedHour(h);
      if (!isNaN(m)) setSelectedMinute(m);
    }
  }, [initialTime]);

  const handleConfirm = () => {
    const hStr = String(selectedHour).padStart(2, '0');
    const mStr = String(selectedMinute).padStart(2, '0');
    onConfirm(`${hStr}:${mStr}`);
  };

  return (
    <section className="calendar-modal-backdrop" onClick={onClose}>
      <div className="calendar-modal time-wheel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="month-wheel-actions">
          <button type="button" onClick={onClose}>Huỷ</button>
          <strong style={{ fontSize: '16px', color: '#08162b' }}>{title}</strong>
          <button type="button" onClick={handleConfirm}>Xong</button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', textAlign: 'center', fontSize: '13px', color: '#64748b', fontWeight: 700, paddingBottom: '8px', marginTop: '10px' }}>
          <div style={{ width: '100px' }}>Giờ</div>
          <div style={{ width: '14px' }}></div>
          <div style={{ width: '100px' }}>Phút</div>
        </div>
        <div className="time-wheels-container">
          <WheelPicker 
            options={hoursOptions} 
            value={selectedHour} 
            onChange={(val) => setSelectedHour(Number(val))} 
          />
          <span className="time-wheel-separator" style={{ width: '14px', textAlign: 'center', display: 'inline-block' }}>:</span>
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
