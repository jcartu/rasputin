import { APIRequestContext } from '@playwright/test';

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
  latency: number;
}

export class ApiHelper {
  constructor(
    private request: APIRequestContext,
    private baseUrl: string = process.env.ALFIE_API_URL || 'http://localhost:3001'
  ) {}

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    options: {
      data?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    } = {}
  ): Promise<ApiResponse<T>> {
    const start = Date.now();
    const url = `${this.baseUrl}${endpoint}`;

    const requestOptions: Record<string, unknown> = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    if (options.params) {
      requestOptions.params = options.params;
    }

    if (options.data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestOptions.data = options.data;
    }

    let response: Awaited<ReturnType<APIRequestContext['get']>>;
    switch (method) {
      case 'GET':
        response = await this.request.get(url, requestOptions);
        break;
      case 'POST':
        response = await this.request.post(url, requestOptions);
        break;
      case 'PUT':
        response = await this.request.put(url, requestOptions);
        break;
      case 'DELETE':
        response = await this.request.delete(url, requestOptions);
        break;
      case 'PATCH':
        response = await this.request.patch(url, requestOptions);
        break;
    }

    const latency = Date.now() - start;
    let data: T;

    try {
      data = await response.json();
    } catch {
      data = (await response.text()) as unknown as T;
    }

    const headers: Record<string, string> = {};
    const responseHeaders = response.headers();
    for (const [key, value] of Object.entries(responseHeaders)) {
      headers[key] = value;
    }

    return {
      status: response.status(),
      data,
      headers,
      latency,
    };
  }

  get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('GET', endpoint, { params });
  }

  post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('POST', endpoint, { data });
  }

  put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('PUT', endpoint, { data });
  }

  delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('DELETE', endpoint);
  }

  patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('PATCH', endpoint, { data });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/api/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async createSession(name?: string): Promise<ApiResponse<{ id: string; name: string }>> {
    return this.post('/api/sessions', { name: name || `test_session_${Date.now()}` });
  }

  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.delete(`/api/sessions/${sessionId}`);
  }

  async sendMessage(
    sessionId: string,
    content: string,
    model?: string
  ): Promise<ApiResponse<unknown>> {
    return this.post('/api/chat', { sessionId, content, model });
  }

  async searchMemories(query: string, limit = 10): Promise<ApiResponse<unknown[]>> {
    return this.post('/api/memories/search', { query, limit });
  }

  async executeCode(
    code: string,
    language: string
  ): Promise<ApiResponse<{ output: string; exitCode: number }>> {
    return this.post('/api/execute', { code, language });
  }

  async uploadFile(filePath: string, content: string): Promise<ApiResponse<{ path: string }>> {
    return this.post('/api/files/write', { path: filePath, content });
  }

  async getSystemStats(): Promise<ApiResponse<{ cpu: number; memory: number; gpu?: unknown }>> {
    return this.get('/api/system/stats');
  }

  async getGpuStats(): Promise<ApiResponse<unknown>> {
    return this.get('/api/system/gpu');
  }
}
