export type TemplateType =
  | "business_report"
  | "technical_doc"
  | "meeting_notes"
  | "project_proposal"
  | "status_update"
  | "research_summary"
  | "executive_brief"
  | "invoice"
  | "sow"
  | "api_doc";

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  example?: string;
}

export interface DocumentTemplate {
  type: TemplateType;
  name: string;
  description: string;
  format: "docx" | "html" | "markdown";
  variables: TemplateVariable[];
  structure: string;
  styles?: Record<string, string>;
}

export const DOCUMENT_TEMPLATES: Record<TemplateType, DocumentTemplate> = {
  business_report: {
    type: "business_report",
    name: "Business Report",
    description:
      "Professional business report with executive summary, findings, and recommendations",
    format: "html",
    variables: [
      {
        name: "title",
        description: "Report title",
        required: true,
        example: "Q1 2024 Sales Analysis",
      },
      {
        name: "author",
        description: "Author name",
        required: false,
        defaultValue: "JARVIS",
      },
      { name: "date", description: "Report date", required: false },
      {
        name: "executive_summary",
        description: "High-level summary",
        required: true,
      },
      { name: "findings", description: "Key findings (array)", required: true },
      {
        name: "recommendations",
        description: "Recommendations (array)",
        required: true,
      },
      { name: "data", description: "Supporting data/charts", required: false },
      {
        name: "conclusion",
        description: "Concluding remarks",
        required: false,
      },
    ],
    structure: `# {{title}}
**Author:** {{author}} | **Date:** {{date}}

## Executive Summary
{{executive_summary}}

## Key Findings
{{#each findings}}
- {{this}}
{{/each}}

## Recommendations
{{#each recommendations}}
{{@index}}. {{this}}
{{/each}}

{{#if data}}
## Supporting Data
{{data}}
{{/if}}

{{#if conclusion}}
## Conclusion
{{conclusion}}
{{/if}}`,
  },

  technical_doc: {
    type: "technical_doc",
    name: "Technical Documentation",
    description:
      "Technical documentation with overview, architecture, and implementation details",
    format: "markdown",
    variables: [
      { name: "title", description: "Document title", required: true },
      {
        name: "version",
        description: "Version number",
        required: false,
        defaultValue: "1.0",
      },
      { name: "overview", description: "System overview", required: true },
      {
        name: "architecture",
        description: "Architecture description",
        required: true,
      },
      {
        name: "components",
        description: "Component list (array)",
        required: true,
      },
      {
        name: "api_endpoints",
        description: "API endpoints (array)",
        required: false,
      },
      {
        name: "setup_steps",
        description: "Setup instructions (array)",
        required: true,
      },
      {
        name: "configuration",
        description: "Configuration options",
        required: false,
      },
    ],
    structure: `# {{title}}
**Version:** {{version}}

## Overview
{{overview}}

## Architecture
{{architecture}}

## Components
{{#each components}}
### {{this.name}}
{{this.description}}
{{/each}}

{{#if api_endpoints}}
## API Reference
{{#each api_endpoints}}
### \`{{this.method}}\` {{this.path}}
{{this.description}}
{{/each}}
{{/if}}

## Setup
{{#each setup_steps}}
{{@index}}. {{this}}
{{/each}}

{{#if configuration}}
## Configuration
{{configuration}}
{{/if}}`,
  },

  meeting_notes: {
    type: "meeting_notes",
    name: "Meeting Notes",
    description:
      "Structured meeting notes with attendees, agenda, and action items",
    format: "docx",
    variables: [
      { name: "meeting_title", description: "Meeting title", required: true },
      { name: "date", description: "Meeting date", required: true },
      {
        name: "attendees",
        description: "List of attendees (array)",
        required: true,
      },
      { name: "agenda", description: "Agenda items (array)", required: true },
      { name: "discussion", description: "Discussion points", required: true },
      {
        name: "decisions",
        description: "Decisions made (array)",
        required: false,
      },
      {
        name: "action_items",
        description: "Action items (array with owner, task, due)",
        required: true,
      },
      {
        name: "next_meeting",
        description: "Next meeting date/time",
        required: false,
      },
    ],
    structure: `# {{meeting_title}}
**Date:** {{date}}

## Attendees
{{#each attendees}}
- {{this}}
{{/each}}

## Agenda
{{#each agenda}}
{{@index}}. {{this}}
{{/each}}

## Discussion
{{discussion}}

{{#if decisions}}
## Decisions
{{#each decisions}}
- {{this}}
{{/each}}
{{/if}}

## Action Items
| Owner | Task | Due Date |
|-------|------|----------|
{{#each action_items}}
| {{this.owner}} | {{this.task}} | {{this.due}} |
{{/each}}

{{#if next_meeting}}
## Next Meeting
{{next_meeting}}
{{/if}}`,
  },

  project_proposal: {
    type: "project_proposal",
    name: "Project Proposal",
    description:
      "Project proposal with objectives, scope, timeline, and budget",
    format: "html",
    variables: [
      { name: "project_name", description: "Project name", required: true },
      { name: "prepared_by", description: "Preparer name", required: true },
      { name: "date", description: "Proposal date", required: false },
      {
        name: "problem_statement",
        description: "Problem being solved",
        required: true,
      },
      {
        name: "objectives",
        description: "Project objectives (array)",
        required: true,
      },
      { name: "scope", description: "Project scope", required: true },
      {
        name: "out_of_scope",
        description: "Out of scope items (array)",
        required: false,
      },
      {
        name: "timeline",
        description: "Timeline/milestones (array)",
        required: true,
      },
      { name: "budget", description: "Budget breakdown", required: false },
      {
        name: "risks",
        description: "Risks and mitigations (array)",
        required: false,
      },
      {
        name: "success_criteria",
        description: "Success criteria (array)",
        required: true,
      },
    ],
    structure: `# Project Proposal: {{project_name}}
**Prepared by:** {{prepared_by}} | **Date:** {{date}}

## Problem Statement
{{problem_statement}}

## Objectives
{{#each objectives}}
- {{this}}
{{/each}}

## Scope
{{scope}}

{{#if out_of_scope}}
### Out of Scope
{{#each out_of_scope}}
- {{this}}
{{/each}}
{{/if}}

## Timeline
| Milestone | Target Date |
|-----------|-------------|
{{#each timeline}}
| {{this.milestone}} | {{this.date}} |
{{/each}}

{{#if budget}}
## Budget
{{budget}}
{{/if}}

{{#if risks}}
## Risks & Mitigations
{{#each risks}}
- **Risk:** {{this.risk}} → **Mitigation:** {{this.mitigation}}
{{/each}}
{{/if}}

## Success Criteria
{{#each success_criteria}}
{{@index}}. {{this}}
{{/each}}`,
  },

  status_update: {
    type: "status_update",
    name: "Status Update",
    description:
      "Weekly/monthly status update with progress, blockers, and next steps",
    format: "markdown",
    variables: [
      { name: "project_name", description: "Project name", required: true },
      {
        name: "reporting_period",
        description: "Reporting period",
        required: true,
      },
      {
        name: "overall_status",
        description: "Status (on-track/at-risk/blocked)",
        required: true,
      },
      {
        name: "accomplishments",
        description: "Accomplishments (array)",
        required: true,
      },
      {
        name: "in_progress",
        description: "In progress items (array)",
        required: true,
      },
      { name: "blockers", description: "Blockers (array)", required: false },
      { name: "next_steps", description: "Next steps (array)", required: true },
      { name: "metrics", description: "Key metrics", required: false },
    ],
    structure: `# Status Update: {{project_name}}
**Period:** {{reporting_period}} | **Status:** {{overall_status}}

## Accomplishments
{{#each accomplishments}}
- ✅ {{this}}
{{/each}}

## In Progress
{{#each in_progress}}
- 🔄 {{this}}
{{/each}}

{{#if blockers}}
## Blockers
{{#each blockers}}
- ⚠️ {{this}}
{{/each}}
{{/if}}

## Next Steps
{{#each next_steps}}
- 📋 {{this}}
{{/each}}

{{#if metrics}}
## Key Metrics
{{metrics}}
{{/if}}`,
  },

  research_summary: {
    type: "research_summary",
    name: "Research Summary",
    description:
      "Research summary with methodology, findings, and implications",
    format: "html",
    variables: [
      { name: "title", description: "Research title", required: true },
      { name: "researcher", description: "Researcher name", required: false },
      { name: "date", description: "Research date", required: false },
      { name: "abstract", description: "Research abstract", required: true },
      {
        name: "methodology",
        description: "Research methodology",
        required: true,
      },
      { name: "findings", description: "Key findings (array)", required: true },
      {
        name: "data_sources",
        description: "Data sources (array)",
        required: true,
      },
      { name: "limitations", description: "Limitations", required: false },
      {
        name: "implications",
        description: "Implications and recommendations",
        required: true,
      },
      {
        name: "references",
        description: "References (array)",
        required: false,
      },
    ],
    structure: `# {{title}}
**Researcher:** {{researcher}} | **Date:** {{date}}

## Abstract
{{abstract}}

## Methodology
{{methodology}}

## Key Findings
{{#each findings}}
### Finding {{@index}}
{{this}}
{{/each}}

## Data Sources
{{#each data_sources}}
- {{this}}
{{/each}}

{{#if limitations}}
## Limitations
{{limitations}}
{{/if}}

## Implications & Recommendations
{{implications}}

{{#if references}}
## References
{{#each references}}
{{@index}}. {{this}}
{{/each}}
{{/if}}`,
  },

  executive_brief: {
    type: "executive_brief",
    name: "Executive Brief",
    description:
      "Concise executive briefing with key points and recommendations",
    format: "html",
    variables: [
      { name: "title", description: "Brief title", required: true },
      { name: "date", description: "Date", required: false },
      { name: "situation", description: "Current situation", required: true },
      {
        name: "key_points",
        description: "Key points (array, max 5)",
        required: true,
      },
      {
        name: "options",
        description: "Options/alternatives (array)",
        required: false,
      },
      {
        name: "recommendation",
        description: "Recommended action",
        required: true,
      },
      {
        name: "next_steps",
        description: "Immediate next steps (array)",
        required: true,
      },
    ],
    structure: `# Executive Brief: {{title}}
**Date:** {{date}}

## Situation
{{situation}}

## Key Points
{{#each key_points}}
{{@index}}. {{this}}
{{/each}}

{{#if options}}
## Options
{{#each options}}
### Option {{@index}}: {{this.name}}
{{this.description}}
- **Pros:** {{this.pros}}
- **Cons:** {{this.cons}}
{{/each}}
{{/if}}

## Recommendation
{{recommendation}}

## Next Steps
{{#each next_steps}}
- {{this}}
{{/each}}`,
  },

  invoice: {
    type: "invoice",
    name: "Invoice",
    description: "Professional invoice with line items and totals",
    format: "html",
    variables: [
      { name: "invoice_number", description: "Invoice number", required: true },
      { name: "date", description: "Invoice date", required: true },
      { name: "due_date", description: "Due date", required: true },
      {
        name: "from_company",
        description: "Sender company name",
        required: true,
      },
      { name: "from_address", description: "Sender address", required: true },
      {
        name: "to_company",
        description: "Recipient company name",
        required: true,
      },
      { name: "to_address", description: "Recipient address", required: true },
      {
        name: "line_items",
        description: "Line items (array with description, qty, rate)",
        required: true,
      },
      { name: "subtotal", description: "Subtotal", required: true },
      { name: "tax_rate", description: "Tax rate (%)", required: false },
      { name: "tax_amount", description: "Tax amount", required: false },
      { name: "total", description: "Total amount", required: true },
      { name: "notes", description: "Additional notes", required: false },
      { name: "payment_terms", description: "Payment terms", required: false },
    ],
    structure: `# INVOICE
**Invoice #:** {{invoice_number}}
**Date:** {{date}}
**Due Date:** {{due_date}}

---

**From:**
{{from_company}}
{{from_address}}

**To:**
{{to_company}}
{{to_address}}

---

## Items

| Description | Qty | Rate | Amount |
|-------------|-----|------|--------|
{{#each line_items}}
| {{this.description}} | {{this.qty}} | {{this.rate}} | {{this.amount}} |
{{/each}}

---

| | |
|---|---|
| **Subtotal** | {{subtotal}} |
{{#if tax_amount}}
| **Tax ({{tax_rate}}%)** | {{tax_amount}} |
{{/if}}
| **Total** | **{{total}}** |

{{#if notes}}
## Notes
{{notes}}
{{/if}}

{{#if payment_terms}}
## Payment Terms
{{payment_terms}}
{{/if}}`,
  },

  sow: {
    type: "sow",
    name: "Statement of Work",
    description: "Statement of Work for project engagements",
    format: "docx",
    variables: [
      { name: "project_name", description: "Project name", required: true },
      { name: "client_name", description: "Client name", required: true },
      {
        name: "provider_name",
        description: "Service provider name",
        required: true,
      },
      { name: "effective_date", description: "Effective date", required: true },
      { name: "background", description: "Project background", required: true },
      {
        name: "objectives",
        description: "Project objectives (array)",
        required: true,
      },
      { name: "scope", description: "Scope of work", required: true },
      {
        name: "deliverables",
        description: "Deliverables (array)",
        required: true,
      },
      { name: "timeline", description: "Project timeline", required: true },
      { name: "milestones", description: "Milestones (array)", required: true },
      {
        name: "assumptions",
        description: "Assumptions (array)",
        required: true,
      },
      {
        name: "responsibilities",
        description: "Client responsibilities (array)",
        required: true,
      },
      {
        name: "acceptance_criteria",
        description: "Acceptance criteria",
        required: true,
      },
      { name: "pricing", description: "Pricing details", required: true },
      {
        name: "payment_schedule",
        description: "Payment schedule",
        required: true,
      },
    ],
    structure: `# Statement of Work
## {{project_name}}

**Client:** {{client_name}}
**Provider:** {{provider_name}}
**Effective Date:** {{effective_date}}

---

## 1. Background
{{background}}

## 2. Objectives
{{#each objectives}}
- {{this}}
{{/each}}

## 3. Scope of Work
{{scope}}

## 4. Deliverables
{{#each deliverables}}
### {{@index}}. {{this.name}}
{{this.description}}
{{/each}}

## 5. Timeline
{{timeline}}

### Milestones
| Milestone | Target Date | Deliverable |
|-----------|-------------|-------------|
{{#each milestones}}
| {{this.name}} | {{this.date}} | {{this.deliverable}} |
{{/each}}

## 6. Assumptions
{{#each assumptions}}
- {{this}}
{{/each}}

## 7. Client Responsibilities
{{#each responsibilities}}
- {{this}}
{{/each}}

## 8. Acceptance Criteria
{{acceptance_criteria}}

## 9. Pricing
{{pricing}}

## 10. Payment Schedule
{{payment_schedule}}

---

**Agreed and Accepted:**

___________________________ Date: ___________
{{client_name}}

___________________________ Date: ___________
{{provider_name}}`,
  },

  api_doc: {
    type: "api_doc",
    name: "API Documentation",
    description:
      "REST API documentation with endpoints, parameters, and examples",
    format: "markdown",
    variables: [
      { name: "api_name", description: "API name", required: true },
      { name: "version", description: "API version", required: true },
      { name: "base_url", description: "Base URL", required: true },
      { name: "description", description: "API description", required: true },
      {
        name: "authentication",
        description: "Authentication method",
        required: true,
      },
      {
        name: "endpoints",
        description: "API endpoints (array)",
        required: true,
      },
      {
        name: "error_codes",
        description: "Error codes (array)",
        required: false,
      },
      {
        name: "rate_limits",
        description: "Rate limiting info",
        required: false,
      },
    ],
    structure: `# {{api_name}} API Documentation
**Version:** {{version}}
**Base URL:** \`{{base_url}}\`

## Overview
{{description}}

## Authentication
{{authentication}}

{{#if rate_limits}}
## Rate Limits
{{rate_limits}}
{{/if}}

## Endpoints

{{#each endpoints}}
### {{this.method}} {{this.path}}
{{this.description}}

**Parameters:**
{{#each this.parameters}}
| Name | Type | Required | Description |
|------|------|----------|-------------|
| \`{{this.name}}\` | {{this.type}} | {{this.required}} | {{this.description}} |
{{/each}}

**Example Request:**
\`\`\`bash
{{this.example_request}}
\`\`\`

**Example Response:**
\`\`\`json
{{this.example_response}}
\`\`\`

---
{{/each}}

{{#if error_codes}}
## Error Codes
| Code | Description |
|------|-------------|
{{#each error_codes}}
| {{this.code}} | {{this.description}} |
{{/each}}
{{/if}}`,
  },
};

export function getTemplateByType(type: TemplateType): DocumentTemplate | null {
  return DOCUMENT_TEMPLATES[type] || null;
}

export function listTemplates(): Array<{
  type: TemplateType;
  name: string;
  description: string;
  format: string;
}> {
  return Object.values(DOCUMENT_TEMPLATES).map(t => ({
    type: t.type,
    name: t.name,
    description: t.description,
    format: t.format,
  }));
}

export function renderTemplate(
  template: DocumentTemplate,
  variables: Record<string, unknown>
): { content: string; missingRequired: string[] } {
  const missingRequired: string[] = [];

  for (const v of template.variables) {
    if (v.required && !(v.name in variables)) {
      missingRequired.push(v.name);
    }
  }

  if (missingRequired.length > 0) {
    return { content: "", missingRequired };
  }

  let content = template.structure;

  const filledVariables: Record<string, unknown> = {};
  for (const v of template.variables) {
    if (v.name in variables) {
      filledVariables[v.name] = variables[v.name];
    } else if (v.defaultValue !== undefined) {
      filledVariables[v.name] = v.defaultValue;
    }
  }

  if (!filledVariables["date"]) {
    filledVariables["date"] = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  content = content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = filledVariables[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });

  content = processConditionals(content, filledVariables);
  content = processLoops(content, filledVariables);

  content = content.replace(/\n{3,}/g, "\n\n");

  return { content, missingRequired: [] };
}

function processConditionals(
  content: string,
  variables: Record<string, unknown>
): string {
  const ifRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  return content.replace(ifRegex, (_, varName, innerContent) => {
    const value = variables[varName];
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      return innerContent;
    }
    return "";
  });
}

function processLoops(
  content: string,
  variables: Record<string, unknown>
): string {
  const eachRegex = /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return content.replace(eachRegex, (_, varName, innerContent) => {
    const arr = variables[varName];
    if (!Array.isArray(arr)) return "";

    return arr
      .map((item, index) => {
        let itemContent = innerContent;

        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index + 1));

        if (typeof item === "object" && item !== null) {
          for (const [key, val] of Object.entries(item)) {
            const regex = new RegExp(`\\{\\{this\\.${key}\\}\\}`, "g");
            itemContent = itemContent.replace(regex, String(val ?? ""));
          }
        } else {
          itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        }

        return itemContent;
      })
      .join("\n");
  });
}

export function validateTemplateVariables(
  templateType: TemplateType,
  variables: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const template = getTemplateByType(templateType);
  if (!template) {
    return { valid: false, errors: [`Unknown template type: ${templateType}`] };
  }

  const errors: string[] = [];

  for (const v of template.variables) {
    if (v.required && !(v.name in variables)) {
      errors.push(`Missing required variable: ${v.name} - ${v.description}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
