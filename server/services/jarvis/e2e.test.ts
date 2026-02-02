import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { scaffoldProject, type ScaffoldConfig } from "../webApp/scaffolder";

const TEST_OUTPUT_DIR = "/tmp/jarvis-e2e-test";

describe("JARVIS E2E: Build Todo App Workflow", () => {
  beforeAll(async () => {
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  });

  it("scaffolds a complete React todo app with all features", async () => {
    const config: ScaffoldConfig = {
      projectName: "todo-app",
      projectType: "react",
      outputPath: TEST_OUTPUT_DIR,
      database: "sqlite",
      authentication: "jwt",
      features: ["api", "forms"],
      ui: {
        library: "shadcn",
        theme: "light",
        components: ["button", "input", "card", "checkbox"],
      },
      testing: { coverage: true },
      docker: {
        includeDocker: true,
        includeCompose: true,
      },
    };

    const result = await scaffoldProject(config);

    expect(result.success).toBe(true);
    expect(result.projectPath).toBeDefined();
    expect(result.filesCreated.length).toBeGreaterThan(5);

    const projectPath = result.projectPath!;

    const packageJsonExists = await fs
      .access(path.join(projectPath, "package.json"))
      .then(() => true)
      .catch(() => false);
    expect(packageJsonExists).toBe(true);

    const srcExists = await fs
      .access(path.join(projectPath, "src"))
      .then(() => true)
      .catch(() => false);
    expect(srcExists).toBe(true);

    const dockerfileExists = await fs
      .access(path.join(projectPath, "Dockerfile"))
      .then(() => true)
      .catch(() => false);
    expect(dockerfileExists).toBe(true);

    const packageJson = JSON.parse(
      await fs.readFile(path.join(projectPath, "package.json"), "utf-8")
    );
    expect(packageJson.name).toBe("todo-app");
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.scripts.dev).toBeDefined();
    expect(packageJson.scripts.test).toBeDefined();
  }, 30000);

  it("scaffolds a Next.js todo app with database", async () => {
    const config: ScaffoldConfig = {
      projectName: "nextjs-todo",
      projectType: "nextjs",
      outputPath: TEST_OUTPUT_DIR,
      database: "postgresql",
      authentication: "oauth",
      features: ["api"],
    };

    const result = await scaffoldProject(config);

    expect(result.success).toBe(true);
    expect(result.filesCreated.length).toBeGreaterThan(3);

    const projectPath = result.projectPath!;

    const nextConfigExists = await fs
      .access(path.join(projectPath, "next.config.js"))
      .then(() => true)
      .catch(() => false);

    const nextConfigMjsExists = await fs
      .access(path.join(projectPath, "next.config.mjs"))
      .then(() => true)
      .catch(() => false);

    expect(nextConfigExists || nextConfigMjsExists).toBe(true);
  }, 30000);

  it("scaffolds a FastAPI backend for todo API", async () => {
    const config: ScaffoldConfig = {
      projectName: "todo-api",
      projectType: "fastapi",
      outputPath: TEST_OUTPUT_DIR,
      database: "postgresql",
      features: ["api"],
      docker: {
        includeDocker: true,
        includeCompose: true,
      },
    };

    const result = await scaffoldProject(config);

    expect(result.success).toBe(true);

    const projectPath = result.projectPath!;

    const mainPyExists = await fs
      .access(path.join(projectPath, "main.py"))
      .then(() => true)
      .catch(() => false);

    const appMainExists = await fs
      .access(path.join(projectPath, "app", "main.py"))
      .then(() => true)
      .catch(() => false);

    expect(mainPyExists || appMainExists).toBe(true);

    const requirementsExists = await fs
      .access(path.join(projectPath, "requirements.txt"))
      .then(() => true)
      .catch(() => false);
    expect(requirementsExists).toBe(true);
  }, 30000);
});

describe("JARVIS E2E: Build SaaS Fitness Tracking", () => {
  beforeAll(async () => {
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  });

  it("scaffolds a full-stack SaaS application", async () => {
    const config: ScaffoldConfig = {
      projectName: "fitness-tracker",
      projectType: "nextjs",
      outputPath: TEST_OUTPUT_DIR,
      database: "postgresql",
      authentication: "oauth",
      features: ["api", "forms", "payments"],
      ui: {
        library: "shadcn",
        theme: "dark",
        components: ["button", "input", "card", "table", "chart"],
      },
      testing: { coverage: true },
      docker: {
        includeDocker: true,
        includeCompose: true,
      },
    };

    const result = await scaffoldProject(config);

    expect(result.success).toBe(true);
    expect(result.projectPath).toBeDefined();

    const projectPath = result.projectPath!;

    const packageJson = JSON.parse(
      await fs.readFile(path.join(projectPath, "package.json"), "utf-8")
    );
    expect(packageJson.name).toBe("fitness-tracker");

    const appDirExists = await fs
      .access(path.join(projectPath, "app"))
      .then(() => true)
      .catch(() => false);

    const srcDirExists = await fs
      .access(path.join(projectPath, "src"))
      .then(() => true)
      .catch(() => false);

    expect(appDirExists || srcDirExists).toBe(true);
  }, 30000);
});
