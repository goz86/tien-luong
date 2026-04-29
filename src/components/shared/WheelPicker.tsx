import { useEffect, useRef, useState } from 'react';

export interface WheelPickerProps {
  options: (string | number)[];
  value: string | number;
  onChange: (value: string | number) => void;
  itemHeight?: number;
  visibleItems?: number;
  label?: string;
}

export function WheelPicker({
  options,
  value,
  onChange,
  itemHeight = 44,
  visibleItems = 5,
  label
}: WheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Determine padding so first and last items can be centered
  const halfVisible = Math.floor(visibleItems / 2);
  const paddingVertical = halfVisible * itemHeight - 2;

  useEffect(() => {
    // Initial scroll to the selected value
    if (containerRef.current) {
      const index = options.indexOf(value);
      if (index !== -1) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    }
  }, [value, options, itemHeight]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    
    setIsScrolling(true);
    
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false);
      if (containerRef.current) {
        const scrollTop = containerRef.current.scrollTop;
        const index = Math.round(scrollTop / itemHeight);
        
        // Ensure index is within bounds
        const safeIndex = Math.max(0, Math.min(index, options.length - 1));
        
        if (options[safeIndex] !== value) {
          onChange(options[safeIndex]);
        }
      }
    }, 150); // wait for scroll to stop
  };

  return (
    <div 
      className="wheel-picker-wrapper"
      style={{ height: `${itemHeight * visibleItems}px` }}
    >
      <div className="wheel-picker-overlay"></div>
      <div 
        className="wheel-picker-container" 
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          paddingTop: `${paddingVertical}px`,
          paddingBottom: `${paddingVertical}px`,
          boxSizing: 'border-box'
        }}
      >
        {options.map((opt, i) => {
          const isSelected = opt === value;
          return (
            <div 
              key={i} 
              className={`wheel-picker-item ${isSelected ? 'selected' : ''}`}
              style={{ height: `${itemHeight}px` }}
              onClick={() => {
                if (containerRef.current) {
                  containerRef.current.scrollTo({
                    top: i * itemHeight,
                    behavior: 'smooth'
                  });
                }
              }}
            >
              {typeof opt === 'number' ? String(opt).padStart(2, '0') : opt}
              {label && isSelected && <span className="wheel-picker-label">{label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
