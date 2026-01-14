import * as fs from "fs";
import * as path from "path";

export interface DockerConfig {
  includeDocker?: boolean;
  includeCompose?: boolean;
  nodeVersion?: string;
  pythonVersion?: string;
  rubyVersion?: string;
  exposePort?: number;
  envVars?: string[];
  volumes?: string[];
  services?: DockerService[];
}

export interface DockerService {
  name: string;
  image: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  dependsOn?: string[];
}

export interface DockerSetupResult {
  filesCreated: string[];
}

export async function setupDocker(
  projectPath: string,
  projectType: string,
  projectName: string,
  config?: DockerConfig
): Promise<DockerSetupResult> {
  const result: DockerSetupResult = {
    filesCreated: [],
  };

  if (config?.includeDocker === false) return result;

  const dockerfile = generateDockerfile(projectType, config);
  fs.writeFileSync(path.join(projectPath, "Dockerfile"), dockerfile);
  result.filesCreated.push("Dockerfile");

  const dockerignore = generateDockerignore(projectType);
  fs.writeFileSync(path.join(projectPath, ".dockerignore"), dockerignore);
  result.filesCreated.push(".dockerignore");

  if (config?.includeCompose !== false) {
    const compose = generateDockerCompose(projectType, projectName, config);
    fs.writeFileSync(path.join(projectPath, "docker-compose.yml"), compose);
    result.filesCreated.push("docker-compose.yml");
  }

  return result;
}

function generateDockerfile(
  projectType: string,
  config?: DockerConfig
): string {
  switch (projectType) {
    case "react":
    case "vue":
    case "svelte":
      return generateSPADockerfile(config);
    case "nextjs":
      return generateNextjsDockerfile(config);
    case "express":
      return generateExpressDockerfile(config);
    case "fastapi":
      return generateFastAPIDockerfile(config);
    case "rails":
      return generateRailsDockerfile(config);
    default:
      return generateSPADockerfile(config);
  }
}

function generateSPADockerfile(config?: DockerConfig): string {
  const nodeVersion = config?.nodeVersion || "20-alpine";
  const port = config?.exposePort || 80;

  return `# Build stage
FROM node:${nodeVersion} AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE ${port}

CMD ["nginx", "-g", "daemon off;"]
`;
}

function generateNextjsDockerfile(config?: DockerConfig): string {
  const nodeVersion = config?.nodeVersion || "20-alpine";
  const port = config?.exposePort || 3000;

  return `# Build stage
FROM node:${nodeVersion} AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production stage
FROM node:${nodeVersion} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE ${port}

ENV PORT=${port}
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
`;
}

function generateExpressDockerfile(config?: DockerConfig): string {
  const nodeVersion = config?.nodeVersion || "20-alpine";
  const port = config?.exposePort || 3000;

  return `FROM node:${nodeVersion}

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build || true

ENV NODE_ENV=production
ENV PORT=${port}

EXPOSE ${port}

RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 expressjs && \\
    chown -R expressjs:nodejs /app

USER expressjs

CMD ["node", "dist/index.js"]
`;
}

function generateFastAPIDockerfile(config?: DockerConfig): string {
  const pythonVersion = config?.pythonVersion || "3.11-slim";
  const port = config?.exposePort || 8000;

  return `FROM python:${pythonVersion}

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN adduser --system --group appuser && \\
    chown -R appuser:appuser /app

USER appuser

EXPOSE ${port}

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${port}"]
`;
}

function generateRailsDockerfile(config?: DockerConfig): string {
  const rubyVersion = config?.rubyVersion || "3.2-slim";
  const port = config?.exposePort || 3000;

  return `FROM ruby:${rubyVersion}

WORKDIR /app

RUN apt-get update -qq && \\
    apt-get install -y --no-install-recommends \\
    build-essential \\
    libpq-dev \\
    nodejs \\
    yarn \\
    && rm -rf /var/lib/apt/lists/*

COPY Gemfile Gemfile.lock ./
RUN bundle config set --local deployment 'true' && \\
    bundle config set --local without 'development test' && \\
    bundle install

COPY . .

RUN bundle exec rails assets:precompile || true

ENV RAILS_ENV=production
ENV RAILS_LOG_TO_STDOUT=true
ENV RAILS_SERVE_STATIC_FILES=true

RUN adduser --system --group rails && \\
    chown -R rails:rails /app

USER rails

EXPOSE ${port}

CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "${port}"]
`;
}

function generateDockerignore(projectType: string): string {
  const common = `# Dependencies
node_modules/
vendor/
__pycache__/
*.pyc
.bundle/

# Build outputs
dist/
build/
.next/
out/
tmp/

# Environment
.env
.env.*
!.env.example

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Testing
coverage/
.nyc_output/
.pytest_cache/

# Git
.git/
.gitignore

# Docker
Dockerfile*
docker-compose*
.docker/

# Documentation
*.md
docs/
`;

  const typeSpecific: Record<string, string> = {
    react: `
# React specific
public/mockServiceWorker.js
`,
    nextjs: `
# Next.js specific
.next/cache/
`,
    fastapi: `
# Python specific
*.egg-info/
.eggs/
venv/
.venv/
`,
    rails: `
# Rails specific
log/
storage/
tmp/
`,
  };

  return common + (typeSpecific[projectType] || "");
}

function generateDockerCompose(
  projectType: string,
  projectName: string,
  config?: DockerConfig
): string {
  const port = config?.exposePort || getDefaultPort(projectType);
  const services: string[] = [];

  const appService = `  ${projectName}:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${port}:${port}"
    environment:
      - NODE_ENV=production${config?.envVars?.map(e => `\n      - ${e}`).join("") || ""}
    restart: unless-stopped`;

  services.push(appService);

  if (config?.services) {
    for (const service of config.services) {
      const svc = generateComposeService(service);
      services.push(svc);
    }
  }

  return `version: "3.8"

services:
${services.join("\n\n")}

networks:
  default:
    driver: bridge
`;
}

function generateComposeService(service: DockerService): string {
  const lines = [`  ${service.name}:`, `    image: ${service.image}`];

  if (service.ports && service.ports.length > 0) {
    lines.push("    ports:");
    for (const port of service.ports) {
      lines.push(`      - "${port}"`);
    }
  }

  if (service.environment && Object.keys(service.environment).length > 0) {
    lines.push("    environment:");
    for (const [key, value] of Object.entries(service.environment)) {
      lines.push(`      - ${key}=${value}`);
    }
  }

  if (service.volumes && service.volumes.length > 0) {
    lines.push("    volumes:");
    for (const vol of service.volumes) {
      lines.push(`      - ${vol}`);
    }
  }

  if (service.dependsOn && service.dependsOn.length > 0) {
    lines.push("    depends_on:");
    for (const dep of service.dependsOn) {
      lines.push(`      - ${dep}`);
    }
  }

  lines.push("    restart: unless-stopped");

  return lines.join("\n");
}

function getDefaultPort(projectType: string): number {
  switch (projectType) {
    case "react":
    case "vue":
    case "svelte":
      return 80;
    case "nextjs":
    case "express":
    case "rails":
      return 3000;
    case "fastapi":
      return 8000;
    default:
      return 3000;
  }
}

export function generateNginxConf(port: number = 80): string {
  return `server {
    listen ${port};
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;
}

export const COMMON_DOCKER_SERVICES: Record<string, DockerService> = {
  postgres: {
    name: "postgres",
    image: "postgres:15-alpine",
    ports: ["5432:5432"],
    environment: {
      POSTGRES_USER: "app",
      POSTGRES_PASSWORD: "password",
      POSTGRES_DB: "app_db",
    },
    volumes: ["postgres_data:/var/lib/postgresql/data"],
  },
  mysql: {
    name: "mysql",
    image: "mysql:8",
    ports: ["3306:3306"],
    environment: {
      MYSQL_ROOT_PASSWORD: "rootpassword",
      MYSQL_DATABASE: "app_db",
      MYSQL_USER: "app",
      MYSQL_PASSWORD: "password",
    },
    volumes: ["mysql_data:/var/lib/mysql"],
  },
  redis: {
    name: "redis",
    image: "redis:7-alpine",
    ports: ["6379:6379"],
    volumes: ["redis_data:/data"],
  },
  mongodb: {
    name: "mongodb",
    image: "mongo:6",
    ports: ["27017:27017"],
    environment: {
      MONGO_INITDB_ROOT_USERNAME: "root",
      MONGO_INITDB_ROOT_PASSWORD: "password",
    },
    volumes: ["mongo_data:/data/db"],
  },
};
