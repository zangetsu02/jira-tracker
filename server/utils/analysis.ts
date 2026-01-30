import { join } from 'path'
import { stat } from 'fs/promises'
import type { ConfidenceLevel } from '~~/shared/utils/types'

// ============================================================================
// CONSTANTS
// ============================================================================

export const CLAUDE_TIMEOUT_MS = 600_000 // 10 minutes
export const MIN_RESPONSE_LENGTH = 100

export const LEGACY_PATH_CANDIDATES = [
  'docs/aspx',
  'docs/legacy',
  'legacy',
  'aspx'
] as const

// ============================================================================
// TYPES
// ============================================================================

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'
export type IssuePriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest'
export type IssueType
  = 'missing_implementation'
    | 'partial_implementation'
    | 'legacy_mismatch'
    | 'behavior_difference'
    | 'missing_test'
    | 'security_concern'
    | 'performance_concern'
    | 'documentation_gap'
export type EffortSize = 'XS' | 'S' | 'M' | 'L' | 'XL'
export type AnalysisStatus = 'missing' | 'partial' | 'unclear' | 'implemented'

export interface JiraIssue {
  code: string
  title: string
  type: IssueType
  severity: IssueSeverity
  priority: IssuePriority
  description: string
  relatedUseCases: string[]
  legacyReference: string | null
  microserviceReference: string | null
  acceptanceCriteria: string[]
  suggestedLabels: string[]
  estimatedEffort: EffortSize | null
}

export interface IssuesOnlyResult {
  issues: JiraIssue[]
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Find legacy code path in microservice directory
 * Checks common locations: docs/aspx, docs/legacy, legacy, aspx
 */
export async function findLegacyPath(microservicePath: string): Promise<string | null> {
  for (const candidate of LEGACY_PATH_CANDIDATES) {
    const fullPath = join(microservicePath, candidate)
    try {
      const stats = await stat(fullPath)
      if (stats.isDirectory()) {
        return fullPath
      }
    } catch {
      // Path doesn't exist, try next
    }
  }
  return null
}

/**
 * Map issue type to analysis status
 */
export function issueTypeToStatus(type: IssueType): AnalysisStatus {
  switch (type) {
    case 'missing_implementation':
      return 'missing'
    case 'partial_implementation':
      return 'partial'
    default:
      return 'unclear'
  }
}

/**
 * Map issue severity to confidence level
 */
export function severityToConfidence(severity: IssueSeverity): ConfidenceLevel {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    default:
      return 'low'
  }
}

/**
 * Build Jira wiki markup description from issue
 */
export function buildJiraDescription(issue: JiraIssue): string {
  const lines: string[] = []

  lines.push(`h3. ${issue.title}`)
  lines.push('')
  lines.push(issue.description)
  lines.push('')

  if (issue.relatedUseCases && issue.relatedUseCases.length > 0) {
    lines.push(`*Use Case correlati:* ${issue.relatedUseCases.join(', ')}`)
    lines.push('')
  }

  if (issue.legacyReference) {
    lines.push('*Riferimento Legacy:*')
    lines.push(`{code}${issue.legacyReference}{code}`)
    lines.push('')
  }

  if (issue.microserviceReference) {
    lines.push(`*Riferimento Microservizio:* {{${issue.microserviceReference}}}`)
    lines.push('')
  }

  if (issue.acceptanceCriteria.length > 0) {
    lines.push('*Criteri di Accettazione:*')
    for (const criterion of issue.acceptanceCriteria) {
      lines.push(`* ${criterion}`)
    }
    lines.push('')
  }

  if (issue.estimatedEffort) {
    lines.push(`*Effort stimato:* ${issue.estimatedEffort}`)
  }

  return lines.join('\n').trim()
}
