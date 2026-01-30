import type { user, microservices, usecases, analysisResults, jiraConfig, appSettings, analysisPrompts } from '~~/server/database/schema'

export type User = typeof user.$inferSelect
export type Microservice = typeof microservices.$inferSelect
export type UseCase = typeof usecases.$inferSelect
export type AnalysisResult = typeof analysisResults.$inferSelect
export type JiraConfig = typeof jiraConfig.$inferSelect
export type AppSettings = typeof appSettings.$inferSelect
export type AnalysisPrompt = typeof analysisPrompts.$inferSelect

export interface MicroserviceWithStatus extends Microservice {
  hasAnalysis: boolean
  lastAnalysisStatus?: 'success' | 'partial' | 'issues'
  useCaseCount?: number
  implementedCount?: number
}

export interface AnalysisResultWithUseCase extends AnalysisResult {
  usecase?: UseCase
}

export type UseCaseStatus = 'implemented' | 'partial' | 'missing' | 'unclear'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
