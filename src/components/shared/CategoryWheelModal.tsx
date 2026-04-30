import { useState } from 'react';
import { WheelPicker } from './WheelPicker';

interface CategoryWheelModalProps {
  options: { value: string; label: string }[];
  value: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
}

export function CategoryWheelModal({ options, value, onClose, onConfirm, title }: CategoryWheelModalProps) {
  const [localValue, setLocalValue] = useState(value);

  const labels = options.map(o => o.label);
  const currentLabel = options.find(o => o.value === localValue)?.label || labels[0];

  const handleConfirm = () => {
    onConfirm(localValue);
  };

  return (
    <section className="calendar-modal-backdrop" onClick={onClose} style={{ zIndex: 3000 }}>
      <div className="calendar-modal time-wheel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="month-wheel-actions">
          <button type="button" onClick={onClose}>Huỷ</button>
          <strong style={{ fontSize: '16px', color: '#08162b' }}>{title}</strong>
          <button type="button" onClick={handleConfirm}>Xong</button>
        </div>
        
        <div className="time-wheels-container" style={{ gridTemplateColumns: '1fr', gap: 0, marginTop: '20px' }}>
          <WheelPicker 
            options={labels} 
            value={currentLabel} 
            onChange={(label) => {
              const selected = options.find(o => o.label === label);
              if (selected) {
                setLocalValue(selected.value);
              }
            }} 
          />
        </div>
      </div>
    </section>
  );
}
