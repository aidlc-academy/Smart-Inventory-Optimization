import { useEffect, useRef, useState } from 'react';

export interface FormulaStep {
  label: string;
  value: string;
}

interface FormulaTraceProps {
  title: string;
  steps: FormulaStep[];
  ariaLabel?: string;
}

/**
 * A '?' button that toggles an inline popover showing formula steps.
 * All label text must follow UI critical rules — no AI/ML language.
 */
export default function FormulaTrace({ title, steps, ariaLabel }: FormulaTraceProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popoverId = `formula-${title.replace(/\s+/g, '-').toLowerCase()}`;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <span className="formula-trace-wrapper" ref={wrapperRef}>
      <button
        className="formula-btn"
        aria-label={ariaLabel ?? `Show formula for ${title}`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        ?
      </button>
      {open && (
        <div
          id={popoverId}
          className="formula-popover"
          role="tooltip"
          aria-label={`Formula: ${title}`}
        >
          <div className="formula-popover-title">{title}</div>
          {steps.map((step, i) => (
            <div key={i} className="formula-step">
              <strong>{step.label}:</strong> {step.value}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
