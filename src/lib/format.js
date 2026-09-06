export function formatCurrency(value, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

export function formatPercent(value) {
  const number = Number(value) || 0
  return `${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(number)}%`
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
