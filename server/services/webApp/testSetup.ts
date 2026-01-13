import * as fs from "fs";
import * as path from "path";

export type TestFramework = "vitest" | "jest" | "pytest" | "rspec" | "minitest";

export interface TestConfig {
  framework?: TestFramework;
  coverage?: boolean;
  watchMode?: boolean;
  testDir?: string;
}

export interface TestSetupResult {
  filesCreated: string[];
  dependenciesToAdd: Record<string, string>;
  devDependenciesToAdd: Record<string, string>;
  scripts: Record<string, string>;
}

export function detectTestFramework(projectType: string): TestFramework {
  switch (projectType) {
    case "react":
    case "vue":
    case "svelte":
      return "vitest";
    case "nextjs":
    case "express":
      return "jest";
    case "fastapi":
      return "pytest";
    case "rails":
      return "minitest";
    default:
      return "vitest";
  }
}

export async function setupTestFramework(
  projectPath: string,
  projectType: string,
  projectName: string,
  config?: TestConfig
): Promise<TestSetupResult> {
  const framework = config?.framework || detectTestFramework(projectType);
  const result: TestSetupResult = {
    filesCreated: [],
    dependenciesToAdd: {},
    devDependenciesToAdd: {},
    scripts: {},
  };

  switch (framework) {
    case "vitest":
      await setupVitest(projectPath, projectType, projectName, result, config);
      break;
    case "jest":
      await setupJest(projectPath, projectType, projectName, result, config);
      break;
    case "pytest":
      await setupPytest(projectPath, projectName, result, config);
      break;
    case "minitest":
    case "rspec":
      await setupRubyTests(projectPath, projectName, result, framework);
      break;
  }

  return result;
}

async function setupVitest(
  projectPath: string,
  projectType: string,
  projectName: string,
  result: TestSetupResult,
  config?: TestConfig
): Promise<void> {
  result.devDependenciesToAdd["vitest"] = "^1.0.0";
  result.devDependenciesToAdd["@testing-library/react"] = "^14.0.0";
  result.devDependenciesToAdd["@testing-library/jest-dom"] = "^6.0.0";
  result.devDependenciesToAdd["jsdom"] = "^24.0.0";

  if (config?.coverage) {
    result.devDependenciesToAdd["@vitest/coverage-v8"] = "^1.0.0";
  }

  result.scripts["test"] = "vitest";
  result.scripts["test:run"] = "vitest run";
  result.scripts["test:ui"] = "vitest --ui";
  if (config?.coverage) {
    result.scripts["test:coverage"] = "vitest run --coverage";
  }

  const testDir = config?.testDir || "src/__tests__";
  const fullTestDir = path.join(projectPath, testDir);
  if (!fs.existsSync(fullTestDir)) {
    fs.mkdirSync(fullTestDir, { recursive: true });
  }

  const vitestConfig = `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],${
      config?.coverage
        ? `
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },`
        : ""
    }
  },
})
`;
  fs.writeFileSync(path.join(projectPath, "vitest.config.ts"), vitestConfig);
  result.filesCreated.push("vitest.config.ts");

  const setupFile = `import '@testing-library/jest-dom'
`;
  fs.writeFileSync(path.join(fullTestDir, "setup.ts"), setupFile);
  result.filesCreated.push(`${testDir}/setup.ts`);

  const sampleTest = `import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders welcome message', () => {
    render(<App />)
    expect(screen.getByText(/Welcome to ${projectName}/i)).toBeInTheDocument()
  })

  it('contains main container', () => {
    render(<App />)
    const container = document.querySelector('.container')
    expect(container).toBeInTheDocument()
  })
})
`;
  fs.writeFileSync(path.join(fullTestDir, "App.test.tsx"), sampleTest);
  result.filesCreated.push(`${testDir}/App.test.tsx`);

  const utilsTest = `import { describe, it, expect } from 'vitest'

describe('Utils', () => {
  it('demonstrates a passing test', () => {
    expect(1 + 1).toBe(2)
  })

  it('demonstrates array matching', () => {
    const items = ['a', 'b', 'c']
    expect(items).toHaveLength(3)
    expect(items).toContain('b')
  })
})
`;
  fs.writeFileSync(path.join(fullTestDir, "utils.test.ts"), utilsTest);
  result.filesCreated.push(`${testDir}/utils.test.ts`);
}

async function setupJest(
  projectPath: string,
  projectType: string,
  projectName: string,
  result: TestSetupResult,
  config?: TestConfig
): Promise<void> {
  result.devDependenciesToAdd["jest"] = "^29.0.0";
  result.devDependenciesToAdd["@types/jest"] = "^29.0.0";
  result.devDependenciesToAdd["ts-jest"] = "^29.0.0";

  if (projectType === "nextjs") {
    result.devDependenciesToAdd["@testing-library/react"] = "^14.0.0";
    result.devDependenciesToAdd["@testing-library/jest-dom"] = "^6.0.0";
    result.devDependenciesToAdd["jest-environment-jsdom"] = "^29.0.0";
  }

  result.scripts["test"] = "jest";
  result.scripts["test:watch"] = "jest --watch";
  if (config?.coverage) {
    result.scripts["test:coverage"] = "jest --coverage";
  }

  const testDir = config?.testDir || "__tests__";
  const fullTestDir = path.join(projectPath, testDir);
  if (!fs.existsSync(fullTestDir)) {
    fs.mkdirSync(fullTestDir, { recursive: true });
  }

  const jestConfig =
    projectType === "nextjs"
      ? `const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

module.exports = createJestConfig(customJestConfig)
`
      : `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
}
`;

  fs.writeFileSync(path.join(projectPath, "jest.config.js"), jestConfig);
  result.filesCreated.push("jest.config.js");

  if (projectType === "nextjs") {
    const jestSetup = `import '@testing-library/jest-dom'
`;
    fs.writeFileSync(path.join(projectPath, "jest.setup.js"), jestSetup);
    result.filesCreated.push("jest.setup.js");

    const pageTest = `import { render, screen } from '@testing-library/react'
import Page from '../app/page'

describe('Home Page', () => {
  it('renders welcome message', () => {
    render(<Page />)
    expect(screen.getByText(/Welcome to ${projectName}/i)).toBeInTheDocument()
  })
})
`;
    fs.writeFileSync(path.join(fullTestDir, "page.test.tsx"), pageTest);
    result.filesCreated.push(`${testDir}/page.test.tsx`);
  } else {
    const sampleTest = `describe('Sample Tests', () => {
  it('passes basic assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('handles async operations', async () => {
    const result = await Promise.resolve('hello')
    expect(result).toBe('hello')
  })
})
`;
    fs.writeFileSync(path.join(fullTestDir, "sample.test.ts"), sampleTest);
    result.filesCreated.push(`${testDir}/sample.test.ts`);
  }
}

async function setupPytest(
  projectPath: string,
  projectName: string,
  result: TestSetupResult,
  config?: TestConfig
): Promise<void> {
  const testDir = config?.testDir || "tests";
  const fullTestDir = path.join(projectPath, testDir);
  if (!fs.existsSync(fullTestDir)) {
    fs.mkdirSync(fullTestDir, { recursive: true });
  }

  const pytestIni = `[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v${config?.coverage ? " --cov=app --cov-report=html" : ""}
`;
  fs.writeFileSync(path.join(projectPath, "pytest.ini"), pytestIni);
  result.filesCreated.push("pytest.ini");

  const conftest = `import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)
`;
  fs.writeFileSync(path.join(fullTestDir, "conftest.py"), conftest);
  result.filesCreated.push(`${testDir}/conftest.py`);

  const testMain = `def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()

def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

class TestAPI:
    def test_sample_endpoint(self, client):
        response = client.get("/api/sample")
        assert response.status_code in [200, 404]
`;
  fs.writeFileSync(path.join(fullTestDir, "test_main.py"), testMain);
  result.filesCreated.push(`${testDir}/test_main.py`);

  const initPy = "";
  fs.writeFileSync(path.join(fullTestDir, "__init__.py"), initPy);
  result.filesCreated.push(`${testDir}/__init__.py`);

  const requirements = `pytest>=7.0.0
pytest-asyncio>=0.21.0
httpx>=0.24.0${config?.coverage ? "\npytest-cov>=4.0.0" : ""}
`;
  fs.writeFileSync(
    path.join(projectPath, "requirements-dev.txt"),
    requirements
  );
  result.filesCreated.push("requirements-dev.txt");

  result.scripts["test"] = "pytest";
  if (config?.coverage) {
    result.scripts["test:coverage"] = "pytest --cov=app --cov-report=html";
  }
}

async function setupRubyTests(
  projectPath: string,
  projectName: string,
  result: TestSetupResult,
  framework: "minitest" | "rspec"
): Promise<void> {
  const testDir = framework === "rspec" ? "spec" : "test";
  const fullTestDir = path.join(projectPath, testDir);
  if (!fs.existsSync(fullTestDir)) {
    fs.mkdirSync(fullTestDir, { recursive: true });
  }

  if (framework === "rspec") {
    const specHelper = `require 'rails_helper'

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
end
`;
    fs.writeFileSync(path.join(fullTestDir, "spec_helper.rb"), specHelper);
    result.filesCreated.push(`${testDir}/spec_helper.rb`);

    const modelSpec = `require 'rails_helper'

RSpec.describe 'Sample', type: :model do
  it 'passes a basic assertion' do
    expect(1 + 1).to eq(2)
  end
end
`;
    fs.writeFileSync(path.join(fullTestDir, "sample_spec.rb"), modelSpec);
    result.filesCreated.push(`${testDir}/sample_spec.rb`);
  } else {
    const testHelper = `ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
require 'rails/test_help'
require 'minitest/autorun'

class ActiveSupport::TestCase
  parallelize(workers: :number_of_processors)
  fixtures :all
end
`;
    fs.writeFileSync(path.join(fullTestDir, "test_helper.rb"), testHelper);
    result.filesCreated.push(`${testDir}/test_helper.rb`);

    const sampleTest = `require 'test_helper'

class SampleTest < ActiveSupport::TestCase
  test 'passes a basic assertion' do
    assert_equal 2, 1 + 1
  end

  test 'truth' do
    assert true
  end
end
`;
    fs.writeFileSync(path.join(fullTestDir, "sample_test.rb"), sampleTest);
    result.filesCreated.push(`${testDir}/sample_test.rb`);
  }

  result.scripts["test"] =
    framework === "rspec" ? "bundle exec rspec" : "rails test";
}

export function getTestCommand(projectType: string, pattern?: string): string {
  const framework = detectTestFramework(projectType);

  switch (framework) {
    case "vitest":
      return pattern ? `vitest run ${pattern}` : "vitest run";
    case "jest":
      return pattern ? `jest ${pattern}` : "jest";
    case "pytest":
      return pattern ? `pytest ${pattern}` : "pytest";
    case "minitest":
      return pattern ? `rails test ${pattern}` : "rails test";
    case "rspec":
      return pattern ? `bundle exec rspec ${pattern}` : "bundle exec rspec";
    default:
      return "npm test";
  }
}
