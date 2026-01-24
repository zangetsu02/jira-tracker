type StatusColor = 'success' | 'warning' | 'error' | 'neutral' | 'info'
type ConfidenceColor = 'success' | 'warning' | 'error' | 'neutral'

const STATUS_CONFIG = {
  implemented: { color: 'success' as const, label: 'Implementato', shortLabel: 'OK' },
  partial: { color: 'warning' as const, label: 'Parziale', shortLabel: 'Parziale' },
  missing: { color: 'error' as const, label: 'Mancante', shortLabel: 'Mancante' },
  unclear: { color: 'neutral' as const, label: 'Incerto', shortLabel: '-' }
} as const

const CONFIDENCE_CONFIG = {
  high: 'success',
  medium: 'warning',
  low: 'error'
} as const

export function useAnalysisStatus() {
  const getStatusColor = (status: string): StatusColor => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color ?? 'neutral'
  }

  const getStatusLabel = (status: string, short = false): string => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    if (!config) return status
    return short ? config.shortLabel : config.label
  }

  const getConfidenceColor = (confidence: string): ConfidenceColor => {
    return CONFIDENCE_CONFIG[confidence as keyof typeof CONFIDENCE_CONFIG] ?? 'neutral'
  }

  const getCoverageColor = (coverage: number): StatusColor => {
    if (coverage === 100) return 'success'
    if (coverage > 50) return 'warning'
    return 'error'
  }

  return {
    getStatusColor,
    getStatusLabel,
    getConfidenceColor,
    getCoverageColor
  }
}
