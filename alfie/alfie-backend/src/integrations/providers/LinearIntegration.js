import BaseIntegration from '../BaseIntegration.js';

const AUTH_URL = 'https://linear.app/oauth/authorize';
const TOKEN_URL = 'https://api.linear.app/oauth/token';
const GRAPHQL_URL = 'https://api.linear.app/graphql';

const DEFAULT_SCOPES = ['read', 'write', 'issues:create', 'comments:create'];

const GRAPHQL_QUERIES = {
  teams: `query Teams {
    teams {
      nodes {
        id
        name
        key
        description
        createdAt
      }
    }
  }`,
  projects: `query Projects($teamId: String!) {
    projects(filter: { team: { id: { eq: $teamId } } }) {
      nodes {
        id
        name
        description
        state
        progress
        startDate
        targetDate
        team {
          id
          name
        }
      }
    }
  }`,
  issues: `query Issues($filter: IssueFilter, $first: Int, $after: String, $includeArchived: Boolean) {
    issues(filter: $filter, first: $first, after: $after, includeArchived: $includeArchived) {
      nodes {
        id
        identifier
        title
        description
        priority
        estimate
        url
        createdAt
        updatedAt
        state {
          id
          name
          type
        }
        assignee {
          id
          name
          email
        }
        project {
          id
          name
        }
        labels {
          nodes {
            id
            name
            color
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }`,
  users: `query Users {
    users {
      nodes {
        id
        name
        email
        displayName
        active
      }
    }
  }`,
  labels: `query Labels($teamId: String!) {
    labels(filter: { team: { id: { eq: $teamId } } }) {
      nodes {
        id
        name
        color
        description
      }
    }
  }`,
  states: `query WorkflowStates($teamId: String!) {
    workflowStates(filter: { team: { id: { eq: $teamId } } }) {
      nodes {
        id
        name
        type
        position
      }
    }
  }`
};

export class LinearIntegration extends BaseIntegration {
  constructor(options = {}) {
    super(options);
    this.authUrl = AUTH_URL;
    this.tokenUrl = TOKEN_URL;
    this.graphqlUrl = GRAPHQL_URL;
    this.defaultScopes = DEFAULT_SCOPES;
  }

  getAuthUrl(redirectUri = this.redirectUri, scopes = this.defaultScopes) {
    if (!this.clientId) {
      throw new Error('Linear clientId is required');
    }
    const state = this.createState({ redirectUri, scopes });
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state
    });
    return { url: `${this.authUrl}?${params.toString()}`, state };
  }

  async handleCallback(code, redirectUri = this.redirectUri) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Linear client credentials are required');
    }
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Linear token exchange failed: ${error}`);
    }

    const tokens = await response.json();
    this.setTokens(tokens);
    return tokens;
  }

  async refreshToken() {
    if (!this.refreshToken) {
      throw new Error('Linear refresh token not available');
    }
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Linear token refresh failed: ${error}`);
    }

    const tokens = await response.json();
    this.setTokens(tokens);
    return tokens;
  }

  async graphqlQuery(query, variables = {}) {
    const response = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthorizationHeader()
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json();
    if (!response.ok) {
      const error = result?.errors?.map(err => err.message).join(', ') || response.statusText;
      throw new Error(`Linear GraphQL error: ${error}`);
    }
    if (result.errors?.length) {
      throw new Error(`Linear GraphQL error: ${result.errors.map(err => err.message).join(', ')}`);
    }
    return result.data;
  }

  async listTeams() {
    const data = await this.graphqlQuery(GRAPHQL_QUERIES.teams);
    return data.teams?.nodes || [];
  }

  async listProjects(teamId) {
    if (!teamId) {
      throw new Error('teamId is required');
    }
    const data = await this.graphqlQuery(GRAPHQL_QUERIES.projects, { teamId });
    return data.projects?.nodes || [];
  }

  async listIssues(projectId, options = {}) {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    const filter = {
      project: { id: { eq: projectId } }
    };

    if (options.stateIds?.length) {
      filter.state = { id: { in: options.stateIds } };
    }
    if (options.assigneeIds?.length) {
      filter.assignee = { id: { in: options.assigneeIds } };
    }
    if (options.labelIds?.length) {
      filter.labels = { id: { in: options.labelIds } };
    }
    if (options.search) {
      filter.title = { containsIgnoreCase: options.search };
    }
    if (options.priority != null) {
      filter.priority = { eq: options.priority };
    }

    const variables = {
      filter,
      first: options.first || 50,
      after: options.after || null,
      includeArchived: Boolean(options.includeArchived)
    };

    const data = await this.graphqlQuery(GRAPHQL_QUERIES.issues, variables);
    return data.issues || { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
  }

  async createIssue(teamId, title, description = '', options = {}) {
    if (!teamId || !title) {
      throw new Error('teamId and title are required');
    }

    const input = {
      teamId,
      title,
      description
    };

    if (options.projectId) input.projectId = options.projectId;
    if (options.assigneeId) input.assigneeId = options.assigneeId;
    if (options.priority != null) input.priority = options.priority;
    if (options.estimate != null) input.estimate = options.estimate;
    if (options.labelIds?.length) input.labelIds = options.labelIds;
    if (options.stateId) input.stateId = options.stateId;
    if (options.dueDate) input.dueDate = options.dueDate;

    const mutation = `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        issue {
          id
          identifier
          title
          description
          url
          state { id name type }
          assignee { id name email }
          project { id name }
        }
      }
    }`;

    const data = await this.graphqlQuery(mutation, { input });
    const issue = data.issueCreate?.issue;
    if (issue) {
      this.emit('issue_created', issue);
    }
    return issue;
  }

  async updateIssue(issueId, updates = {}) {
    if (!issueId) {
      throw new Error('issueId is required');
    }

    const mutation = `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        issue {
          id
          identifier
          title
          description
          url
          state { id name type }
          assignee { id name email }
          project { id name }
          updatedAt
        }
      }
    }`;

    const data = await this.graphqlQuery(mutation, { id: issueId, input: updates });
    const issue = data.issueUpdate?.issue;
    if (issue) {
      this.emit('issue_updated', issue);
    }
    return issue;
  }

  async addComment(issueId, body) {
    if (!issueId || !body) {
      throw new Error('issueId and body are required');
    }

    const mutation = `mutation AddComment($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        comment {
          id
          body
          createdAt
          issue { id identifier title }
        }
      }
    }`;

    const data = await this.graphqlQuery(mutation, { input: { issueId, body } });
    const comment = data.commentCreate?.comment;
    if (comment) {
      this.emit('comment_added', comment);
    }
    return comment;
  }

  async createWebhook(url, teamId, resourceTypes = ['Issue', 'Comment']) {
    if (!url || !teamId) {
      throw new Error('url and teamId are required');
    }

    const mutation = `mutation CreateWebhook($input: WebhookCreateInput!) {
      webhookCreate(input: $input) {
        webhook {
          id
          url
          resourceTypes
          enabled
          createdAt
        }
      }
    }`;

    const input = {
      url,
      teamId,
      resourceTypes
    };

    const data = await this.graphqlQuery(mutation, { input });
    return data.webhookCreate?.webhook || null;
  }

  handleWebhook(payload, signature) {
    const verification = this.verifyWebhookSignature(payload, signature, { prefix: 'sha256=' });
    if (!verification.valid) {
      throw new Error(`Invalid Linear webhook signature: ${verification.reason}`);
    }

    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const type = data?.type;
    const action = data?.action;
    const entity = data?.data;

    let event = null;
    if (type === 'Issue' && action === 'create') event = 'issue_created';
    if (type === 'Issue' && action === 'update') event = 'issue_updated';
    if (type === 'Comment' && action === 'create') event = 'comment_added';

    if (event) {
      this.emit(event, entity || data);
    }

    return { event, payload: data };
  }
}

export const LinearQueries = GRAPHQL_QUERIES;
export default LinearIntegration;
