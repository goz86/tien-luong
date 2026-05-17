import type { CurrencyMode } from './types';
import { formatKrw, formatVnd } from './salary';

export function formatCurrencyFlowAmount(
  amount: number,
  mode: CurrencyMode,
  krwToVndRate: number,
  converted: boolean,
) {
  if (mode === 'vnd-vnd') {
    return { text: formatVnd(amount), code: 'VND' as const };
  }

  if (mode === 'vnd-krw') {
    if (converted) return { text: formatKrw(amount / Math.max(krwToVndRate, 1)), code: 'KRW' as const };
    return { text: formatVnd(amount), code: 'VND' as const };
  }

  if (converted) return { text: formatVnd(amount * krwToVndRate), code: 'VND' as const };
  return { text: formatKrw(amount), code: 'KRW' as const };
}
