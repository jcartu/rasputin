import { ApiRequest, KeyValuePair } from './types';

function filterEnabled(items: KeyValuePair[]): KeyValuePair[] {
  return items.filter((item) => item.enabled && item.key);
}

function escapeString(str: string, quote: string = '"'): string {
  return str.replace(new RegExp(quote, 'g'), `\\${quote}`);
}

function buildUrl(request: ApiRequest): string {
  const params = filterEnabled(request.queryParams);
  if (params.length === 0) return request.url;

  const queryString = params
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
  return `${request.url}?${queryString}`;
}

function getAuthHeaders(request: ApiRequest): KeyValuePair[] {
  const headers: KeyValuePair[] = [];

  switch (request.auth.type) {
    case 'bearer':
      if (request.auth.bearerToken) {
        headers.push({
          id: 'auth-bearer',
          key: 'Authorization',
          value: `Bearer ${request.auth.bearerToken}`,
          enabled: true,
        });
      }
      break;
    case 'api-key':
      if (request.auth.apiKey) {
        headers.push({
          id: 'auth-apikey',
          key: request.auth.apiKeyHeader || 'X-API-Key',
          value: request.auth.apiKey,
          enabled: true,
        });
      }
      break;
    case 'basic':
      if (request.auth.basicUsername) {
        const credentials = btoa(
          `${request.auth.basicUsername}:${request.auth.basicPassword || ''}`
        );
        headers.push({
          id: 'auth-basic',
          key: 'Authorization',
          value: `Basic ${credentials}`,
          enabled: true,
        });
      }
      break;
    case 'custom':
      if (request.auth.customHeaders) {
        headers.push(...filterEnabled(request.auth.customHeaders));
      }
      break;
  }

  return headers;
}

function getAllHeaders(request: ApiRequest): KeyValuePair[] {
  return [...filterEnabled(request.headers), ...getAuthHeaders(request)];
}

export function generateCurl(request: ApiRequest): string {
  const url = buildUrl(request);
  const headers = getAllHeaders(request);
  
  const lines: string[] = [`curl -X ${request.method} '${url}'`];

  headers.forEach((h) => {
    lines.push(`  -H '${h.key}: ${escapeString(h.value, "'")}'`);
  });

  if (request.body.type !== 'none' && request.body.content) {
    if (request.body.type === 'json' || request.body.type === 'raw') {
      lines.push(`  -d '${escapeString(request.body.content, "'")}'`);
    } else if (request.body.type === 'form-data' && request.body.formData) {
      filterEnabled(request.body.formData).forEach((f) => {
        lines.push(`  -F '${f.key}=${escapeString(f.value, "'")}'`);
      });
    } else if (request.body.type === 'x-www-form-urlencoded' && request.body.formData) {
      const data = filterEnabled(request.body.formData)
        .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
        .join('&');
      lines.push(`  --data-urlencode '${data}'`);
    }
  }

  return lines.join(' \\\n');
}

export function generateJavaScript(request: ApiRequest): string {
  const url = buildUrl(request);
  const headers = getAllHeaders(request);

  const options: Record<string, unknown> = {
    method: request.method,
  };

  if (headers.length > 0) {
    options.headers = Object.fromEntries(headers.map((h) => [h.key, h.value]));
  }

  if (request.body.type !== 'none' && request.body.content) {
    if (request.body.type === 'json') {
      options.body = 'JSON.stringify(body)';
    } else if (request.body.type === 'raw') {
      options.body = `\`${escapeString(request.body.content, '`')}\``;
    } else if (request.body.type === 'form-data' && request.body.formData) {
      options.body = 'formData';
    }
  }

  let code = `// ${request.name || 'API Request'}\n`;
  code += `const url = '${url}';\n\n`;

  if (request.body.type === 'json' && request.body.content) {
    try {
      const bodyObj = JSON.parse(request.body.content);
      code += `const body = ${JSON.stringify(bodyObj, null, 2)};\n\n`;
    } catch {
      code += `const body = ${request.body.content};\n\n`;
    }
  }

  if (request.body.type === 'form-data' && request.body.formData) {
    code += `const formData = new FormData();\n`;
    filterEnabled(request.body.formData).forEach((f) => {
      code += `formData.append('${f.key}', '${escapeString(f.value)}');\n`;
    });
    code += '\n';
  }

  const headersStr = headers.length > 0
    ? `{\n${headers.map((h) => `    '${h.key}': '${escapeString(h.value)}'`).join(',\n')}\n  }`
    : '{}';

  code += `const options = {
  method: '${request.method}',
  headers: ${headersStr}`;

  if (options.body) {
    code += `,\n  body: ${options.body}`;
  }

  code += `
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error('Error:', error);
}`;

  return code;
}

export function generatePython(request: ApiRequest): string {
  const url = buildUrl(request);
  const headers = getAllHeaders(request);

  let code = `# ${request.name || 'API Request'}\n`;
  code += `import requests\n`;
  
  if (request.body.type === 'json') {
    code += `import json\n`;
  }
  
  code += `\n`;
  code += `url = "${url}"\n\n`;

  if (headers.length > 0) {
    code += `headers = {\n`;
    headers.forEach((h, i) => {
      code += `    "${h.key}": "${escapeString(h.value)}"`;
      if (i < headers.length - 1) code += ',';
      code += '\n';
    });
    code += `}\n\n`;
  }

  if (request.body.type === 'json' && request.body.content) {
    try {
      const bodyObj = JSON.parse(request.body.content);
      code += `payload = ${JSON.stringify(bodyObj, null, 4).replace(/null/g, 'None').replace(/true/g, 'True').replace(/false/g, 'False')}\n\n`;
    } catch {
      code += `payload = ${request.body.content}\n\n`;
    }
  } else if (request.body.type === 'form-data' && request.body.formData) {
    code += `data = {\n`;
    filterEnabled(request.body.formData).forEach((f, i, arr) => {
      code += `    "${f.key}": "${escapeString(f.value)}"`;
      if (i < arr.length - 1) code += ',';
      code += '\n';
    });
    code += `}\n\n`;
  }

  code += `try:\n`;
  code += `    response = requests.${request.method.toLowerCase()}(\n`;
  code += `        url,\n`;
  
  if (headers.length > 0) {
    code += `        headers=headers,\n`;
  }

  if (request.body.type === 'json' && request.body.content) {
    code += `        json=payload,\n`;
  } else if (request.body.type === 'form-data') {
    code += `        data=data,\n`;
  }

  code += `    )\n`;
  code += `    response.raise_for_status()\n`;
  code += `    data = response.json()\n`;
  code += `    print(data)\n`;
  code += `except requests.exceptions.RequestException as e:\n`;
  code += `    print(f"Error: {e}")\n`;

  return code;
}

export function generateGo(request: ApiRequest): string {
  const url = buildUrl(request);
  const headers = getAllHeaders(request);

  let code = `// ${request.name || 'API Request'}\n`;
  code += `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	url := "${url}"
`;

  if (request.body.type === 'json' && request.body.content) {
    code += `
	payload := []byte(\`${request.body.content}\`)
	req, err := http.NewRequest("${request.method}", url, bytes.NewBuffer(payload))
`;
  } else {
    code += `
	req, err := http.NewRequest("${request.method}", url, nil)
`;
  }

  code += `	if err != nil {
		fmt.Printf("Error creating request: %v\\n", err)
		return
	}
`;

  headers.forEach((h) => {
    code += `	req.Header.Set("${h.key}", "${escapeString(h.value)}")\n`;
  });

  code += `
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error making request: %v\\n", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\\n", err)
		return
	}

	fmt.Printf("Status: %s\\n", resp.Status)
	fmt.Printf("Body: %s\\n", string(body))
}`;

  return code;
}

export function generateRust(request: ApiRequest): string {
  const url = buildUrl(request);
  const headers = getAllHeaders(request);

  let code = `// ${request.name || 'API Request'}\n`;
  code += `use reqwest;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "${url}";
    
    let client = reqwest::Client::new();
    
    let response = client
        .${request.method.toLowerCase()}(url)
`;

  headers.forEach((h) => {
    code += `        .header("${h.key}", "${escapeString(h.value)}")\n`;
  });

  if (request.body.type === 'json' && request.body.content) {
    try {
      const bodyObj = JSON.parse(request.body.content);
      code += `        .json(&json!(${JSON.stringify(bodyObj)}))\n`;
    } catch {
      code += `        .body("${escapeString(request.body.content)}")\n`;
    }
  }

  code += `        .send()
        .await?;

    println!("Status: {}", response.status());
    
    let body = response.text().await?;
    println!("Body: {}", body);

    Ok(())
}`;

  return code;
}

export function generateCode(
  request: ApiRequest,
  language: 'curl' | 'javascript' | 'python' | 'go' | 'rust'
): string {
  switch (language) {
    case 'curl':
      return generateCurl(request);
    case 'javascript':
      return generateJavaScript(request);
    case 'python':
      return generatePython(request);
    case 'go':
      return generateGo(request);
    case 'rust':
      return generateRust(request);
    default:
      return generateCurl(request);
  }
}

export const CODE_LANGUAGE_INFO = {
  curl: { name: 'cURL', icon: 'Terminal', extension: 'sh' },
  javascript: { name: 'JavaScript', icon: 'FileCode', extension: 'js' },
  python: { name: 'Python', icon: 'FileCode', extension: 'py' },
  go: { name: 'Go', icon: 'FileCode', extension: 'go' },
  rust: { name: 'Rust', icon: 'FileCode', extension: 'rs' },
};
