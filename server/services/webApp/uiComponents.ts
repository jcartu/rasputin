import * as fs from "fs";
import * as path from "path";

export type UILibrary = "shadcn" | "radix" | "headless" | "none";

export interface UIConfig {
  library: UILibrary;
  theme?: "light" | "dark" | "system";
  components?: string[];
  customColors?: Record<string, string>;
}

export interface UIIntegrationResult {
  filesCreated: string[];
  dependenciesToAdd: Record<string, string>;
  devDependenciesToAdd: Record<string, string>;
}

export async function integrateUILibrary(
  projectPath: string,
  projectType: string,
  config: UIConfig
): Promise<UIIntegrationResult> {
  const result: UIIntegrationResult = {
    filesCreated: [],
    dependenciesToAdd: {},
    devDependenciesToAdd: {},
  };

  if (config.library === "none") return result;

  result.devDependenciesToAdd["tailwindcss"] = "^3.4.0";
  result.devDependenciesToAdd["postcss"] = "^8.4.0";
  result.devDependenciesToAdd["autoprefixer"] = "^10.4.0";

  result.filesCreated.push(...generateTailwindConfig(projectPath, config));

  if (config.library === "shadcn") {
    const shadcnResult = await integrateShadcn(
      projectPath,
      projectType,
      config
    );
    result.filesCreated.push(...shadcnResult.filesCreated);
    Object.assign(result.dependenciesToAdd, shadcnResult.dependencies);
    Object.assign(result.devDependenciesToAdd, shadcnResult.devDependencies);
  } else if (config.library === "radix") {
    const radixResult = integrateRadix(config);
    Object.assign(result.dependenciesToAdd, radixResult.dependencies);
  } else if (config.library === "headless") {
    result.dependenciesToAdd["@headlessui/react"] = "^2.0.0";
  }

  return result;
}

function generateTailwindConfig(
  projectPath: string,
  config: UIConfig
): string[] {
  const files: string[] = [];

  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        ${config.customColors ? generateCustomColors(config.customColors) : ""}
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
`;
  fs.writeFileSync(
    path.join(projectPath, "tailwind.config.js"),
    tailwindConfig
  );
  files.push("tailwind.config.js");

  const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
  fs.writeFileSync(path.join(projectPath, "postcss.config.js"), postcssConfig);
  files.push("postcss.config.js");

  const globalsCss = generateGlobalsCss(config.theme || "dark");
  const cssDir = projectPath.includes("nextjs") ? "app" : "src";
  const cssPath = path.join(projectPath, cssDir);
  if (!fs.existsSync(cssPath)) {
    fs.mkdirSync(cssPath, { recursive: true });
  }
  fs.writeFileSync(path.join(cssPath, "globals.css"), globalsCss);
  files.push(`${cssDir}/globals.css`);

  return files;
}

function generateCustomColors(colors: Record<string, string>): string {
  return Object.entries(colors)
    .map(([name, value]) => `        "${name}": "${value}",`)
    .join("\n");
}

function generateGlobalsCss(theme: "light" | "dark" | "system"): string {
  const lightVars = `  --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;`;

  const darkVars = `  --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --radius: 0.5rem;`;

  if (theme === "light") {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
${lightVars}
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;
  } else if (theme === "dark") {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
${darkVars}
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;
  } else {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
${lightVars}
  }

  .dark {
${darkVars}
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;
  }
}

async function integrateShadcn(
  projectPath: string,
  projectType: string,
  config: UIConfig
): Promise<{
  filesCreated: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}> {
  const result = {
    filesCreated: [] as string[],
    dependencies: {
      "class-variance-authority": "^0.7.0",
      clsx: "^2.1.0",
      "tailwind-merge": "^2.2.0",
      "lucide-react": "^0.312.0",
      "@radix-ui/react-slot": "^1.0.2",
    } as Record<string, string>,
    devDependencies: {
      "tailwindcss-animate": "^1.0.7",
    } as Record<string, string>,
  };

  const componentsDir = path.join(projectPath, "src/components/ui");
  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
  }

  const libDir = path.join(projectPath, "src/lib");
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  const utilsContent = `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`;
  fs.writeFileSync(path.join(libDir, "utils.ts"), utilsContent);
  result.filesCreated.push("src/lib/utils.ts");

  const componentsToGenerate = config.components || [
    "button",
    "card",
    "input",
    "label",
  ];

  for (const component of componentsToGenerate) {
    const componentCode = getComponentCode(component);
    if (componentCode) {
      const fileName = `${component}.tsx`;
      fs.writeFileSync(path.join(componentsDir, fileName), componentCode.code);
      result.filesCreated.push(`src/components/ui/${fileName}`);

      if (componentCode.dependencies) {
        Object.assign(result.dependencies, componentCode.dependencies);
      }
    }
  }

  return result;
}

function integrateRadix(config: UIConfig): {
  dependencies: Record<string, string>;
} {
  const baseDeps: Record<string, string> = {
    "@radix-ui/react-slot": "^1.0.2",
  };

  const componentDeps: Record<string, Record<string, string>> = {
    button: {},
    dialog: { "@radix-ui/react-dialog": "^1.0.5" },
    dropdown: { "@radix-ui/react-dropdown-menu": "^2.0.6" },
    checkbox: { "@radix-ui/react-checkbox": "^1.0.4" },
    select: { "@radix-ui/react-select": "^2.0.0" },
    tabs: { "@radix-ui/react-tabs": "^1.0.4" },
    tooltip: { "@radix-ui/react-tooltip": "^1.0.7" },
    accordion: { "@radix-ui/react-accordion": "^1.1.2" },
    avatar: { "@radix-ui/react-avatar": "^1.0.4" },
    switch: { "@radix-ui/react-switch": "^1.0.3" },
  };

  const components = config.components || ["dialog", "dropdown", "checkbox"];
  const deps = { ...baseDeps };

  for (const comp of components) {
    if (componentDeps[comp]) {
      Object.assign(deps, componentDeps[comp]);
    }
  }

  return { dependencies: deps };
}

interface ComponentCode {
  code: string;
  dependencies?: Record<string, string>;
}

function getComponentCode(component: string): ComponentCode | null {
  const components: Record<string, ComponentCode> = {
    button: {
      code: `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
`,
    },
    card: {
      code: `import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
`,
    },
    input: {
      code: `import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
`,
    },
    label: {
      code: `import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
`,
      dependencies: {
        "@radix-ui/react-label": "^2.0.2",
      },
    },
    badge: {
      code: `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
`,
    },
  };

  return components[component] || null;
}

export function getAvailableComponents(): string[] {
  return ["button", "card", "input", "label", "badge"];
}

export function getUILibraryInfo(library: UILibrary): {
  name: string;
  description: string;
  components: string[];
} {
  const info: Record<
    UILibrary,
    { name: string; description: string; components: string[] }
  > = {
    shadcn: {
      name: "shadcn/ui",
      description:
        "Beautifully designed components built with Radix UI and Tailwind CSS",
      components: ["button", "card", "input", "label", "badge"],
    },
    radix: {
      name: "Radix UI",
      description:
        "Unstyled, accessible components for building design systems",
      components: [
        "dialog",
        "dropdown",
        "checkbox",
        "select",
        "tabs",
        "tooltip",
        "accordion",
        "avatar",
        "switch",
      ],
    },
    headless: {
      name: "Headless UI",
      description:
        "Completely unstyled, fully accessible UI components by Tailwind Labs",
      components: [
        "dialog",
        "disclosure",
        "listbox",
        "menu",
        "popover",
        "radio-group",
        "switch",
        "tabs",
      ],
    },
    none: {
      name: "None",
      description: "No UI library",
      components: [],
    },
  };

  return info[library];
}
