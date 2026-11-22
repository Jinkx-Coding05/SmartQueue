export type InsightConfidence = 'low' | 'medium' | 'high'

export type InsightMetric = { key: string; value: number | null }

export type AdminAiRecommendation = {
  type: string
  department?: string | null
  severity: 'low' | 'medium' | 'high'
  title: string
  reason: string
  suggestedAction: string
  supportingDatabaseMetrics: InsightMetric[]
  confidence: InsightConfidence
  source: 'gemini' | 'rule-based'
}

export type AdminAiInsights = {
  dataSource: string
  peakHours: Array<{ hour: number; bookings: number }>
  waiting: { count: number; averageEstimatedWaitMinutes: number }
  departmentPerformance: Array<{ department: { name: string }; tokens: number; avgWaitEstimate: number }>
  recommendations: AdminAiRecommendation[]
  operationalSummary: {
    activeCounters: number
    appointments: { total: number; completed: number; cancelled: number; completionRate: number; cancellationRate: number }
    tokenOutcomes: { completed: number; cancelled: number; completionRate: number; cancellationRate: number }
  }
  queuePressure: Array<{ department: string; waitingTokens: number; activeCounters: number; waitingPerCounter: number; level: InsightConfidence }>
  historicalQueueTrend: Array<{ date: string; tokens: number; waiting: number; completed: number; cancelled: number }>
  analysis: {
    provider: 'gemini' | 'rule-based'
    model: string | null
    timestamp: string
    fallbackReason?: string
  }
  generatedAnalysis: { summary: string; historicalPattern: string; departmentNotes: Array<{ department: string; note: string }> } | null
  peakPeriodAnalysis: {
    historical: { busiestHours: Array<{ hour: number; bookings: number }>; busiestDays: Array<{ weekday: number; bookings: number; observedDays: number }> }
    forecast: { status: 'available' | 'insufficient-historical-data'; method: string; minimumObservedDays: number; observedDays: number; historicalTokenCount: number; expectedByWeekday: Array<{ weekday: number; averageTokens: number; observedDays: number }> }
  }
  waitTimeAnalysis: {
    timestamp: string
    disclaimer: string
    departments: Array<{
      department: string
      estimatedWaitingTimeMinutes: number
      confidence: InsightConfidence
      reliability: 'historical-completed-service-duration' | 'stored-estimate-fallback'
      status: 'estimated' | 'insufficient-service-duration-history'
      factors: Array<{ name: string; value: number }>
    }>
  }
  explanation: string
}
