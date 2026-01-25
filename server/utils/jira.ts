export interface JiraClientConfig {
  url: string
  username: string
  password: string
  defaultProject?: string
}

export interface CreateIssueParams {
  project: string
  summary: string
  description: string
  issueType?: string
  priority?: string
  labels?: string[]
  assignee?: string
}

export interface JiraUser {
  accountId?: string
  name?: string
  key?: string
  displayName: string
  emailAddress?: string
  avatarUrls?: Record<string, string>
}

export interface JiraIssueResponse {
  key: string
  id: string
  self: string
}

export class JiraClient {
  private auth: string
  private baseUrl: string

  constructor(config: JiraClientConfig) {
    this.auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')
    this.baseUrl = config.url.replace(/\/$/, '')
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Jira API error (${res.status}): ${error}`)
    }

    return res.json()
  }

  async testConnection(): Promise<{ success: boolean, user?: string, error?: string }> {
    try {
      const result = await this.request<{ name: string, displayName: string }>('/rest/api/2/myself')
      return { success: true, user: result.displayName || result.name }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  async getProjects(): Promise<{ key: string, name: string }[]> {
    return this.request('/rest/api/2/project')
  }

  async getIssueTypes(projectKey: string): Promise<{ id: string, name: string, subtask: boolean }[]> {
    const project = await this.request<{ issueTypes: { id: string, name: string, subtask: boolean }[] }>(`/rest/api/2/project/${projectKey}`)
    return project.issueTypes || []
  }

  async getAssignableUsers(projectKey: string, query?: string): Promise<JiraUser[]> {
    // Jira Server uses 'username', Jira Cloud uses 'query'
    // Try with 'username' first (works on both), then fallback to 'query' for Cloud
    const usernameParam = query ? `&username=${encodeURIComponent(query)}` : ''
    try {
      return await this.request<JiraUser[]>(`/rest/api/2/user/assignable/search?project=${projectKey}${usernameParam}&maxResults=50`)
    } catch {
      // Fallback: try with 'query' param for Jira Cloud
      const queryParam = query ? `&query=${encodeURIComponent(query)}` : ''
      return await this.request<JiraUser[]>(`/rest/api/2/user/assignable/search?project=${projectKey}${queryParam}&maxResults=50`)
    }
  }

  async createIssue(params: CreateIssueParams): Promise<JiraIssue> {
    // Get valid issue type - try the provided one, or find a valid one
    let issueTypeName = params.issueType || 'Task'

    try {
      const issueTypes = await this.getIssueTypes(params.project)
      const validTypes = issueTypes.filter(t => !t.subtask)

      // Check if the requested type exists
      const typeExists = validTypes.some(t =>
        t.name.toLowerCase() === issueTypeName.toLowerCase()
      )

      if (!typeExists && validTypes.length > 0) {
        // Try common alternatives
        const alternatives = ['Task', 'Attività', 'Story', 'Bug', 'Issue']
        const found = validTypes.find(t =>
          alternatives.some(alt => t.name.toLowerCase() === alt.toLowerCase())
        )
        issueTypeName = found?.name || validTypes[0].name
        console.log(`Issue type fallback: using "${issueTypeName}" instead of "${params.issueType || 'Task'}"`)
      }
    } catch (e) {
      console.warn('Could not fetch issue types, using default:', e)
    }

    const body = {
      fields: {
        project: { key: params.project },
        summary: params.summary,
        description: params.description,
        issuetype: { name: issueTypeName },
        ...(params.priority && { priority: { name: params.priority } }),
        ...(params.labels && params.labels.length > 0 && { labels: params.labels }),
        // Jira Cloud uses accountId, Jira Server uses name
        ...(params.assignee && {
          assignee: params.assignee.startsWith('5') || params.assignee.includes(':')
            ? { accountId: params.assignee }
            : { name: params.assignee }
        })
      }
    }

    return this.request('/rest/api/2/issue', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async getIssue(issueKey: string): Promise<JiraIssue & { fields: Record<string, unknown> }> {
    return this.request(`/rest/api/2/issue/${issueKey}`)
  }

  async searchByLabel(label: string, maxResults = 50): Promise<JiraSearchResult> {
    const jql = encodeURIComponent(`labels = "${label}" ORDER BY updated DESC`)
    return this.request(`/rest/api/2/search?jql=${jql}&maxResults=${maxResults}&fields=key,summary,status,priority,assignee,updated,created`)
  }

  buildIssueUrl(issueKey: string): string {
    return `${this.baseUrl}/browse/${issueKey}`
  }
}

export interface JiraSearchResult {
  total: number
  issues: Array<{
    key: string
    fields: {
      summary: string
      status: { name: string }
      priority?: { name: string }
      assignee?: { displayName: string }
      updated: string
      created: string
    }
  }>
}

export function createJiraClient(config: JiraConfig): JiraClient {
  return new JiraClient(config)
}
