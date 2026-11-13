import { Sparkles } from 'lucide-react';

export function BrandMark({ small = false }) {
  return (
    <span className={`brand-mark ${small ? 'brand-mark-small' : ''}`} aria-hidden="true">
      <Sparkles size={small ? 16 : 20} strokeWidth={1.8} />
    </span>
  );
}

export function Brand() {
  return (
    <span className="brand-lockup">
      <BrandMark />
      <span className="brand-name">hydrogen<span className="brand-period">.</span></span>
    </span>
  );
}
