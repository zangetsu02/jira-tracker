// Types
export interface JiraUser {
  accountId: string
  displayName: string
  avatarUrl?: string
}

export interface JiraAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
  content: string
  thumbnail?: string
  created: string
}

export interface JiraIssue {
  key: string
  url: string
  summary: string
  description?: string
  status: string
  priority?: string
  assignee?: string | { displayName: string, name?: string, accountId?: string, avatarUrl?: string }
  assigneeId?: string
  reporter?: string | { displayName: string, avatarUrl?: string }
  labels: string[]
  updated: string
  created: string
  issueType?: string
  attachments?: JiraAttachment[]
}

export interface JiraComment {
  id: string
  body: string
  author: {
    displayName: string
    avatarUrl?: string
  }
  created: string
  updated: string
}

export interface JiraIssuesResponse {
  total: number
  issues: JiraIssue[]
}

export interface JiraCommentsResponse {
  total: number
  comments: JiraComment[]
}

export interface JiraTransition {
  id: string
  name: string
  to: {
    id: string
    name: string
    statusCategory: {
      id: number
      key: string
      name: string
    }
  }
}

export interface JiraTransitionsResponse {
  transitions: JiraTransition[]
}

// Composable
export function useJiraHelpers() {
  // Helper to get assignee name from string or object
  const getAssigneeName = (assignee: string | { displayName: string } | undefined | null): string | null => {
    if (!assignee) return null
    if (typeof assignee === 'string') return assignee
    return assignee.displayName || null
  }

  // Helper to get assignee avatar from object
  const getAssigneeAvatar = (assignee: string | { displayName: string, avatarUrl?: string } | undefined | null): string | undefined => {
    if (!assignee || typeof assignee === 'string') return undefined
    return assignee.avatarUrl
  }

  // Helper to get assignee ID from object
  const getAssigneeId = (assignee: string | { displayName: string, accountId?: string } | undefined | null): string | undefined => {
    if (!assignee || typeof assignee === 'string') return undefined
    return assignee.accountId
  }

  // Helper to get reporter name from string or object
  const getReporterName = (reporter: string | { displayName: string } | undefined | null): string | null => {
    if (!reporter) return null
    if (typeof reporter === 'string') return reporter
    return reporter.displayName || null
  }

  // Helper to get reporter avatar
  const getReporterAvatar = (reporter: string | { displayName: string, avatarUrl?: string } | undefined | null): string | undefined => {
    if (!reporter || typeof reporter === 'string') return undefined
    return reporter.avatarUrl
  }

  // Status helpers
  const getStatusColor = (status: string): 'success' | 'info' | 'warning' | 'neutral' => {
    const s = status.toLowerCase()
    if (['done', 'closed', 'resolved', 'fatto', 'chiuso', 'risolto'].includes(s)) return 'success'
    if (['in progress', 'in development', 'in review', 'in corso'].includes(s)) return 'info'
    if (['open', 'to do', 'backlog', 'new', 'aperto', 'da fare'].includes(s)) return 'warning'
    return 'neutral'
  }

  const getStatusDotClass = (status: string): string => {
    const color = getStatusColor(status)
    const classes: Record<string, string> = {
      success: 'bg-green-500 dark:bg-green-400',
      info: 'bg-blue-500 dark:bg-blue-400',
      warning: 'bg-amber-500 dark:bg-amber-400',
      neutral: 'bg-gray-400 dark:bg-gray-500'
    }
    return classes[color] || classes.neutral
  }

  // Priority helpers
  const getPriorityColor = (priority?: string): 'error' | 'warning' | 'info' | 'success' | 'neutral' => {
    if (!priority) return 'neutral'
    const p = priority.toLowerCase()
    if (p === 'highest' || p === 'critico') return 'error'
    if (p === 'high' || p === 'alta') return 'warning'
    if (p === 'medium' || p === 'media') return 'info'
    if (p === 'low' || p === 'bassa') return 'success'
    if (p === 'lowest' || p === 'minima') return 'neutral'
    return 'neutral'
  }

  const getPriorityIcon = (priority?: string): string => {
    if (!priority) return 'i-lucide-minus'
    const p = priority.toLowerCase()
    if (p === 'highest' || p === 'critico') return 'i-lucide-chevrons-up'
    if (p === 'high' || p === 'alta') return 'i-lucide-chevron-up'
    if (p === 'low' || p === 'bassa') return 'i-lucide-chevron-down'
    if (p === 'lowest' || p === 'minima') return 'i-lucide-chevrons-down'
    return 'i-lucide-minus'
  }

  // Date helpers
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m fa`
    if (diffHours < 24) return `${diffHours}h fa`
    if (diffDays < 7) return `${diffDays}g fa`
    return formatDate(dateString)
  }

  // Priority options for select
  const priorityOptions = [
    { label: 'Highest', value: 'Highest' },
    { label: 'High', value: 'High' },
    { label: 'Medium', value: 'Medium' },
    { label: 'Low', value: 'Low' },
    { label: 'Lowest', value: 'Lowest' }
  ]

  return {
    // Assignee helpers
    getAssigneeName,
    getAssigneeAvatar,
    getAssigneeId,
    // Reporter helpers
    getReporterName,
    getReporterAvatar,
    // Status helpers
    getStatusColor,
    getStatusDotClass,
    // Priority helpers
    getPriorityColor,
    getPriorityIcon,
    priorityOptions,
    // Date helpers
    formatDate,
    formatRelativeDate
  }
}
