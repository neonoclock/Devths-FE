export function formatCountCompact(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '0';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue < 1000) {
    return `${value}`;
  }

  const formatWithUnit = (divisor: number, unit: string) => {
    const raw = absValue / divisor;
    const fixed = raw.toFixed(fractionDigits);
    const trimmed = fixed.replace(/\.0$/, '');
    return `${sign}${trimmed}${unit}`;
  };

  if (absValue >= 1_000_000) {
    return formatWithUnit(1_000_000, 'M');
  }

  return formatWithUnit(1000, 'K');
}

export function formatRelativeTime(dateIso: string, now = new Date()): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60 * 1000) {
    return '방금 전';
  }

  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 60) {
    return `${diffMins}분 전`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}
