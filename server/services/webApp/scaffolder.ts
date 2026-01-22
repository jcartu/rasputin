/**
 * Web App Scaffolder - Generate project structure for new web applications
 * Supports React, Next.js, Vue, Svelte, Express, FastAPI, Rails
 */

import * as fs from "fs";
import * as path from "path";

import { integrateUILibrary, type UIConfig } from "./uiComponents";
import { setupTestFramework, type TestConfig } from "./testSetup";
import {
  setupDocker,
  generateNginxConf,
  type DockerConfig,
} from "./dockerSetup";

export interface ScaffoldConfig {
  projectName: string;
  projectType:
    | "react"
    | "nextjs"
    | "vue"
    | "svelte"
    | "express"
    | "fastapi"
    | "rails";
  database?: "postgresql" | "mysql" | "mongodb" | "sqlite";
  authentication?: "jwt" | "oauth" | "session";
  features?: string[];
  outputPath: string;
  ui?: UIConfig;
  testing?: TestConfig | boolean;
  docker?: DockerConfig | boolean;
}

export interface ScaffoldResult {
  success: boolean;
  projectPath: string;
  filesCreated: string[];
  error?: string;
}

/**
 * Generate a new web app project structure
 */
export async function scaffoldProject(
  config: ScaffoldConfig
): Promise<ScaffoldResult> {
  try {
    const projectPath = path.join(config.outputPath, config.projectName);

    // Create project directory
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    const filesCreated: string[] = [];

    // Generate common files
    filesCreated.push(...(await generateCommonFiles(projectPath, config)));

    // Generate framework-specific files
    switch (config.projectType) {
      case "react":
        filesCreated.push(...(await generateReactFiles(projectPath, config)));
        break;
      case "nextjs":
        filesCreated.push(...(await generateNextjsFiles(projectPath, config)));
        break;
      case "vue":
        filesCreated.push(...(await generateVueFiles(projectPath, config)));
        break;
      case "svelte":
        filesCreated.push(...(await generateSvelteFiles(projectPath, config)));
        break;
      case "express":
        filesCreated.push(...(await generateExpressFiles(projectPath, config)));
        break;
      case "fastapi":
        filesCreated.push(...(await generateFastAPIFiles(projectPath, config)));
        break;
      case "rails":
        filesCreated.push(...(await generateRailsFiles(projectPath, config)));
        break;
    }

    const frontendTypes = ["react", "nextjs", "vue", "svelte"];
    if (config.ui && frontendTypes.includes(config.projectType)) {
      const uiResult = await integrateUILibrary(
        projectPath,
        config.projectType,
        config.ui
      );
      filesCreated.push(...uiResult.filesCreated);

      if (
        Object.keys(uiResult.dependenciesToAdd).length > 0 ||
        Object.keys(uiResult.devDependenciesToAdd).length > 0
      ) {
        await updatePackageJson(
          projectPath,
          uiResult.dependenciesToAdd,
          uiResult.devDependenciesToAdd
        );
      }
    }

    if (config.testing) {
      const testConfig =
        typeof config.testing === "boolean" ? {} : config.testing;
      const testResult = await setupTestFramework(
        projectPath,
        config.projectType,
        config.projectName,
        testConfig
      );
      filesCreated.push(...testResult.filesCreated);

      if (
        Object.keys(testResult.dependenciesToAdd).length > 0 ||
        Object.keys(testResult.devDependenciesToAdd).length > 0 ||
        Object.keys(testResult.scripts).length > 0
      ) {
        await updatePackageJson(
          projectPath,
          testResult.dependenciesToAdd,
          testResult.devDependenciesToAdd,
          testResult.scripts
        );
      }
    }

    if (config.docker) {
      const dockerConfig =
        typeof config.docker === "boolean" ? {} : config.docker;
      const dockerResult = await setupDocker(
        projectPath,
        config.projectType,
        config.projectName,
        dockerConfig
      );
      filesCreated.push(...dockerResult.filesCreated);

      const spaTypes = ["react", "vue", "svelte"];
      if (spaTypes.includes(config.projectType)) {
        const port = dockerConfig.exposePort || 80;
        const nginxConf = generateNginxConf(port);
        fs.writeFileSync(path.join(projectPath, "nginx.conf"), nginxConf);
        filesCreated.push("nginx.conf");
      }
    }

    return {
      success: true,
      projectPath,
      filesCreated,
    };
  } catch (error) {
    return {
      success: false,
      projectPath: "",
      filesCreated: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate common files (README, .gitignore, package.json, etc.)
 */
async function generateCommonFiles(
  projectPath: string,
  config: ScaffoldConfig
): Promise<string[]> {
  const files: string[] = [];

  // .gitignore
  const gitignore = `node_modules/
.env
.env.local
dist/
build/
.DS_Store
*.log
.vscode/
.idea/
`;
  fs.writeFileSync(path.join(projectPath, ".gitignore"), gitignore);
  files.push(".gitignore");

  // README.md
  const readme = `# ${config.projectName}

${config.projectType.toUpperCase()} application.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

${config.features?.map(f => `- ${f}`).join("\n") || "- Basic setup"}

## Tech Stack

- Framework: ${config.projectType}
- Database: ${config.database || "None"}
- Authentication: ${config.authentication || "None"}
`;
  fs.writeFileSync(path.join(projectPath, "README.md"), readme);
  files.push("README.md");

  // .env.example
  const envExample = `# Database
DATABASE_URL=

# Authentication
JWT_SECRET=

# API Keys
API_KEY=
`;
  fs.writeFileSync(path.join(projectPath, ".env.example"), envExample);
  files.push(".env.example");

  return files;
}

/**
 * Generate React project files
 */
async function generateReactFiles(
  projectPath: string,
  config: ScaffoldConfig
): Promise<string[]> {
  const files: string[] = [];

  // Create directories
  const dirs = [
    "src",
    "src/components",
    "src/pages",
    "src/hooks",
    "src/utils",
    "public",
  ];
  dirs.forEach(dir => {
    const fullPath = path.join(projectPath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  // package.json
  const packageJson = {
    name: config.projectName,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
      test: "vitest",
    },
    dependencies: {
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
    devDependencies: {
      "@vitejs/plugin-react": "^4.0.0",
      vite: "^5.0.0",
      vitest: "^1.0.0",
    },
  };
  fs.writeFileSync(
    path.join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  files.push("package.json");

  // vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
})
`;
  fs.writeFileSync(path.join(projectPath, "vite.config.ts"), viteConfig);
  files.push("vite.config.ts");

  // src/main.tsx
  const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;
  fs.writeFileSync(path.join(projectPath, "src/main.tsx"), mainTsx);
  files.push("src/main.tsx");

  // src/App.tsx
  const appTsx = `export default function App() {
  return (
    <div className="container">
      <h1>Welcome to ${config.projectName}</h1>
      <p>React application</p>
    </div>
  )
}
`;
  fs.writeFileSync(path.join(projectPath, "src/App.tsx"), appTsx);
  files.push("src/App.tsx");

  // src/index.css
  const indexCss = `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
`;
  fs.writeFileSync(path.join(projectPath, "src/index.css"), indexCss);
  files.push("src/index.css");

  // index.html
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(projectPath, "index.html"), indexHtml);
  files.push("index.html");

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      strictFunctionTypes: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      baseUrl: ".",
      paths: {
        "@/*": ["src/*"],
      },
    },
    include: ["src"],
    references: [{ path: "./tsconfig.node.json" }],
  };
  fs.writeFileSync(
    path.join(projectPath, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2)
  );
  files.push("tsconfig.json");

  return files;
}

/**
 * Generate Next.js project files
 */
async function generateNextjsFiles(
  projectPath: string,
  config: ScaffoldConfig
): Promise<string[]> {
  const files: string[] = [];

  // Create directories
  const dirs = ["app", "app/api", "components", "lib", "public"];
  dirs.forEach(dir => {
    const fullPath = path.join(projectPath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  // package.json
  const packageJson = {
    name: config.projectName,
    version: "0.1.0",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
    dependencies: {
      next: "^14.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      typescript: "^5",
    },
  };
  fs.writeFileSync(
    path.join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  files.push("package.json");

  // next.config.js
  const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
`;
  fs.writeFileSync(path.join(projectPath, "next.config.js"), nextConfig);
  files.push("next.config.js");

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "es5",
      lib: ["dom", "dom.iterable", "esnext"],
      jsx: "preserve",
      module: "esnext",
      moduleResolution: "bundler",
      allowJs: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      incremental: true,
      plugins: [{ name: "next" }],
      paths: {
        "@/*": ["./*"],
      },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };
  fs.writeFileSync(
    path.join(projectPath, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2)
  );
  files.push("tsconfig.json");

  // app/layout.tsx
  const layout = `export const metadata = {
  title: '${config.projectName}',
  description: 'Generated by RASPUTIN',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`;
  fs.writeFileSync(path.join(projectPath, "app/layout.tsx"), layout);
  files.push("app/layout.tsx");

  // app/page.tsx
  const page = `export default function Home() {
  return (
    <main>
      <h1>Welcome to ${config.projectName}</h1>
      <p>Next.js application</p>
    </main>
  )
}
`;
  fs.writeFileSync(path.join(projectPath, "app/page.tsx"), page);
  files.push("app/page.tsx");

  return files;
}

/**
 * Generate Vue project files
 */
async function generateVueFiles(
  projectPath: string,
  config: ScaffoldConfig
): Promise<string[]> {
  const files: string[] = [];

  const dirs = ["src", "src/components", "src/views", "public"];
  dirs.forEach(dir => {
    const fullPath = path.join(projectPath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  // package.json
  const packageJson = {
    name: config.projectName,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: {
      vue: "^3.3.0",
    },
    devDependencies: {
      "@vitejs/plugin-vue": "^4.0.0",
      vite: "^5.0.0",
      typescript: "^5.0.0",
    },
  };
  fs.writeFileSync(
    path.join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  files.push("package.json");

  // vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
`;
  fs.writeFileSync(path.join(projectPath, "vite.config.ts"), viteConfig);
  files.push("vite.config.ts");

  // src/App.vue
  const appVue = `<template>
  <div id="app">
    <h1>Welcome to {{ projectName }}</h1>
    <p>Vue application</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const projectName = ref('${config.projectName}')
</script>

<style scoped>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  text-align: center;
  color: #2c3e50;
}
</style>
`;
  fs.writeFileSync(path.join(projectPath, "src/App.vue"), appVue);
  files.push("src/App.vue");

  // src/main.ts
  const mainTs = `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
`;
  fs.writeFileSync(path.join(projectPath, "src/main.ts"), mainTs);
  files.push("src/main.ts");

  // index.html
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.projectName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(projectPath, "index.html"), indexHtml);
  files.push("index.html");

  return files;
}

/**
 * Generate Svelte project files
 */
async function generateSvelteFiles(
  projectPath: string,
  config: ScaffoldConfig
): Promise<string[]> {
  const files: string[] = [];

  const dirs = ["src", "src/components", "src/lib", "public"];
  dirs.forEach(dir => {
    const fullPath = path.join(projectPath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  // package.json
  const packageJson = {
    name: config.projectName,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: {
      svelte: "^4.0.0",
    },
    devDependencies: {
      "@sveltejs/vite-plugin-svelte": "^2.0.0",
      vite: "^5.0.0",
      svelte: "^4.0.0",
    },
  };
  fs.writeFileSync(
    path.join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  files.push("package.json");

  // vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
})
`;
  fs.writeFileSync(path.join(projectPath, "vite.config.ts"), viteConfig);
  files.push("vite.config.ts");

  // src/App.svelte
  const appSvelte = `<script>
  let name = '${config.projectName}'
</script>

<main>
  <h1>Welcome to {name}</h1>
  <p>Svelte application</p>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }

  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }
</style>
`;
  fs.writeFileSync(path.join(projectPath, "src/App.svelte"), appSvelte);
  files.push("src/App.svelte");

  // src/main.ts
  const mainTs = `import App from './App.svelte'

const app = new App({
  target: document.getElementById('app')!,
})

export default app
`;
  fs.writeFileSync(path.join(projectPath, "src/main.ts"), mainTs);
  files.push("src/main.ts");

  // index.html
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.projectName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(projectPath, "index.html"), indexHtml);
  files.push("index.html");

  return files;
}

/**
 * Generate Express project files
 */
async function generateExpressFiles(
  projectPath: string,
  config: ScaffoldConfig
): Promise<string[]> {
  const files: string[] = [];

  const dirs = ["src", "src/routes", "src/middleware", "src/controllers"];
  dirs.forEach(dir => {
    const fullPath = path.join(projectPath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  // package.json
  const packageJson = {
    name: config.projectName,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js",
    },
    dependencies: {
      express: "^4.18.0",
      cors: "^2.8.0",
    },
    devDependencies: {
      "@types/express": "^4.17.0",
      "@types/node": "^20.0.0",
      typescript: "^5.0.0",
      tsx: "^4.0.0",
    },
  };
  fs.writeFileSync(
    path.join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  files.push("package.json");

  // src/index.ts
  const indexTs = `import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ${config.projectName}' })
})

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`)
})
`;
  fs.writeFileSync(path.join(projectPath, "src/index.ts"), indexTs);
  files.push("src/index.ts");

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      lib: ["ES2020"],
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ["src"],
    exclude: ["node_modules"],
  };
  fs.writeFileSync(
    path.join(projectPath, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2)
  );
  files.push("tsconfig.json");

  return files;
}

/**
 * Generate FastAPI project files
 */
async function generateFastAPIFiles(
  projectPath: string,
  config: ScaffoldConfig
): Promise<string[]> {
  const files: string[] = [];

  const dirs = ["app", "app/api", "app/models", "tests"];
  dirs.forEach(dir => {
    const fullPath = path.join(projectPath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  // requirements.txt
  const requirements = `fastapi==0.104.0
uvicorn==0.24.0
pydantic==2.5.0
python-dotenv==1.0.0
`;
  fs.writeFileSync(path.join(projectPath, "requirements.txt"), requirements);
  files.push("requirements.txt");

  // app/main.py
  const mainPy = `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="${config.projectName}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to ${config.projectName}"}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;
  fs.writeFileSync(path.join(projectPath, "app/main.py"), mainPy);
  files.push("app/main.py");

  // .env.example
  const envExample = `DATABASE_URL=
DEBUG=True
`;
  fs.writeFileSync(path.join(projectPath, ".env.example"), envExample);
  files.push(".env.example");

  return files;
}

/**
 * Generate Rails project files
 */
async function generateRailsFiles(
  projectPath: string,
  _config: ScaffoldConfig
): Promise<string[]> {
  const files: string[] = [];

  /* eslint-disable no-useless-escape */
  const gemfile = `source "https://rubygems.org"
git_source(:github) { |repo| "https://github.com/\#{repo}.git" }

ruby "3.2.0"

gem "rails", "~> 7.0.0"
gem "pg", "~> 1.1"
gem "puma", "~> 5.0"
gem "sass-rails", ">= 6"
gem "webpacker", "~> 5.0"
gem "turbolinks", "~> 5"
gem "jbuilder", "~> 2.7"
gem "redis", "~> 4.0"
gem "bcrypt", "~> 3.1.7"
gem "image_processing", "~> 1.2"
gem "aws-sdk-s3", require: false
gem "rack-cors"

group :development, :test do
  gem "byebug", platforms: [:mri, :mingw, :x64_mingw]
  gem "rspec-rails"
end

group :development do
  gem "web-console", ">= 4.1.0"
end
`;
  /* eslint-enable no-useless-escape */
  fs.writeFileSync(path.join(projectPath, "Gemfile"), gemfile);
  files.push("Gemfile");

  return files;
}

async function updatePackageJson(
  projectPath: string,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  scripts?: Record<string, string>
): Promise<void> {
  const packageJsonPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) return;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  if (Object.keys(dependencies).length > 0) {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...dependencies,
    };
  }

  if (Object.keys(devDependencies).length > 0) {
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      ...devDependencies,
    };
  }

  if (scripts && Object.keys(scripts).length > 0) {
    packageJson.scripts = {
      ...packageJson.scripts,
      ...scripts,
    };
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}
