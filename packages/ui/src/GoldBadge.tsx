import React from 'react';
import { GOLD_PURITY_LABELS } from '@orflow/types';
import type { GoldPurity } from '@orflow/types';

interface GoldBadgeProps {
  purity: GoldPurity;
  className?: string;
}

export default function GoldBadge({ purity, className = '' }: GoldBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full ${className}`}>
      {GOLD_PURITY_LABELS[purity] || purity}
    </span>
  );
}
