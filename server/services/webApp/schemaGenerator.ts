import Anthropic from "@anthropic-ai/sdk";

export interface EntityDefinition {
  name: string;
  fields: FieldDefinition[];
  relations?: RelationDefinition[];
}

export interface FieldDefinition {
  name: string;
  type:
    | "int"
    | "string"
    | "text"
    | "boolean"
    | "timestamp"
    | "decimal"
    | "json"
    | "enum";
  primaryKey?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  default?: string | number | boolean;
  unique?: boolean;
  enumValues?: string[];
  length?: number;
  precision?: number;
  scale?: number;
}

export interface RelationDefinition {
  type: "one-to-many" | "many-to-one" | "many-to-many";
  targetEntity: string;
  fieldName: string;
  foreignKey?: string;
  throughTable?: string;
}

export interface SchemaGenerationResult {
  success: boolean;
  schema: string;
  entities: EntityDefinition[];
  error?: string;
}

export async function generateSchemaFromDescription(
  description: string,
  databaseType: "mysql" | "postgresql" | "sqlite" = "mysql"
): Promise<SchemaGenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      schema: "",
      entities: [],
      error: "ANTHROPIC_API_KEY not configured",
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const entitiesJson = await extractEntitiesFromDescription(
      anthropic,
      description
    );
    const entities: EntityDefinition[] = JSON.parse(entitiesJson);

    const schema = generateDrizzleSchema(entities, databaseType);

    return {
      success: true,
      schema,
      entities,
    };
  } catch (error) {
    return {
      success: false,
      schema: "",
      entities: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function extractEntitiesFromDescription(
  anthropic: Anthropic,
  description: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Analyze this application description and extract database entities with their fields and relationships.

Description: ${description}

Return ONLY a JSON array of entities in this exact format (no markdown, no explanation):
[
  {
    "name": "EntityName",
    "fields": [
      {"name": "id", "type": "int", "primaryKey": true, "autoIncrement": true},
      {"name": "fieldName", "type": "string", "notNull": true, "length": 255},
      {"name": "createdAt", "type": "timestamp", "notNull": true, "default": "now()"}
    ],
    "relations": [
      {"type": "one-to-many", "targetEntity": "OtherEntity", "fieldName": "items"}
    ]
  }
]

Field types: int, string, text, boolean, timestamp, decimal, json, enum
Relation types: one-to-many, many-to-one, many-to-many

Always include:
- id field (int, primaryKey, autoIncrement)
- createdAt timestamp
- updatedAt timestamp where appropriate

For enums, include "enumValues": ["value1", "value2"]
For decimals, include "precision" and "scale"
For strings, include "length" (default 255)`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  let jsonStr = content.text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "");
  }

  return jsonStr;
}

function generateDrizzleSchema(
  entities: EntityDefinition[],
  databaseType: "mysql" | "postgresql" | "sqlite"
): string {
  const imports = getDrizzleImports(databaseType);
  const tableDefinitions = entities
    .map(entity => generateTableDefinition(entity, databaseType))
    .join("\n\n");
  const relationDefinitions = entities
    .filter(e => e.relations && e.relations.length > 0)
    .map(entity => generateRelationDefinitions(entity))
    .join("\n\n");
  const typeExports = entities
    .map(entity => generateTypeExports(entity))
    .join("\n");

  return `${imports}

${tableDefinitions}

${relationDefinitions ? `// Relations\n${relationDefinitions}` : ""}

// Type exports
${typeExports}
`;
}

function getDrizzleImports(databaseType: string): string {
  if (databaseType === "mysql") {
    return `import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  json,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";`;
  } else if (databaseType === "postgresql") {
    return `import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  json,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";`;
  } else {
    return `import {
  sqliteTable,
  integer,
  text,
  blob,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";`;
  }
}

function generateTableDefinition(
  entity: EntityDefinition,
  databaseType: string
): string {
  const tableName = camelToSnake(entity.name);
  const tableFunc =
    databaseType === "mysql"
      ? "mysqlTable"
      : databaseType === "postgresql"
        ? "pgTable"
        : "sqliteTable";

  const fields = entity.fields
    .map(field => generateFieldDefinition(field, databaseType))
    .join(",\n  ");

  return `export const ${entity.name.charAt(0).toLowerCase() + entity.name.slice(1)}s = ${tableFunc}("${tableName}s", {
  ${fields}
});`;
}

function generateFieldDefinition(
  field: FieldDefinition,
  databaseType: string
): string {
  const columnName = camelToSnake(field.name);
  let definition = "";

  switch (field.type) {
    case "int":
      if (databaseType === "postgresql" && field.autoIncrement) {
        definition = `${field.name}: serial("${columnName}")`;
      } else {
        definition = `${field.name}: int("${columnName}")`;
        if (field.autoIncrement) definition += ".autoincrement()";
      }
      break;

    case "string":
      const length = field.length || 255;
      definition = `${field.name}: varchar("${columnName}", { length: ${length} })`;
      break;

    case "text":
      definition = `${field.name}: text("${columnName}")`;
      break;

    case "boolean":
      if (databaseType === "sqlite") {
        definition = `${field.name}: integer("${columnName}", { mode: "boolean" })`;
      } else {
        definition = `${field.name}: boolean("${columnName}")`;
      }
      break;

    case "timestamp":
      if (databaseType === "sqlite") {
        definition = `${field.name}: integer("${columnName}", { mode: "timestamp" })`;
      } else {
        definition = `${field.name}: timestamp("${columnName}")`;
      }
      break;

    case "decimal":
      const precision = field.precision || 10;
      const scale = field.scale || 2;
      definition = `${field.name}: decimal("${columnName}", { precision: ${precision}, scale: ${scale} })`;
      break;

    case "json":
      if (databaseType === "sqlite") {
        definition = `${field.name}: text("${columnName}", { mode: "json" })`;
      } else {
        definition = `${field.name}: json("${columnName}")`;
      }
      break;

    case "enum":
      if (field.enumValues && field.enumValues.length > 0) {
        const enumValues = field.enumValues.map(v => `"${v}"`).join(", ");
        if (databaseType === "mysql") {
          definition = `${field.name}: mysqlEnum("${columnName}", [${enumValues}])`;
        } else if (databaseType === "postgresql") {
          definition = `${field.name}: pgEnum("${columnName}", [${enumValues}])`;
        } else {
          definition = `${field.name}: text("${columnName}")`;
        }
      } else {
        definition = `${field.name}: text("${columnName}")`;
      }
      break;

    default:
      definition = `${field.name}: text("${columnName}")`;
  }

  if (field.primaryKey) definition += ".primaryKey()";
  if (field.notNull) definition += ".notNull()";
  if (field.unique) definition += ".unique()";

  if (field.default !== undefined) {
    if (field.default === "now()") {
      definition += ".defaultNow()";
    } else if (typeof field.default === "string") {
      definition += `.default("${field.default}")`;
    } else if (typeof field.default === "boolean") {
      definition += `.default(${field.default})`;
    } else {
      definition += `.default(${field.default})`;
    }
  }

  return definition;
}

function generateRelationDefinitions(entity: EntityDefinition): string {
  if (!entity.relations || entity.relations.length === 0) return "";

  const entityVar =
    entity.name.charAt(0).toLowerCase() + entity.name.slice(1) + "s";
  const relationFields = entity.relations
    .map(rel => {
      const targetVar =
        rel.targetEntity.charAt(0).toLowerCase() +
        rel.targetEntity.slice(1) +
        "s";
      if (rel.type === "one-to-many") {
        return `  ${rel.fieldName}: many(${targetVar})`;
      } else if (rel.type === "many-to-one") {
        return `  ${rel.fieldName}: one(${targetVar}, { fields: [${entityVar}.${rel.foreignKey || rel.fieldName + "Id"}], references: [${targetVar}.id] })`;
      }
      return "";
    })
    .filter(Boolean)
    .join(",\n");

  if (!relationFields) return "";

  return `export const ${entityVar}Relations = relations(${entityVar}, ({ one, many }) => ({
${relationFields}
}));`;
}

function generateTypeExports(entity: EntityDefinition): string {
  const entityVar =
    entity.name.charAt(0).toLowerCase() + entity.name.slice(1) + "s";
  const typeName = entity.name;
  return `export type ${typeName} = typeof ${entityVar}.$inferSelect;
export type Insert${typeName} = typeof ${entityVar}.$inferInsert;`;
}

function camelToSnake(str: string): string {
  return str
    .replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    .replace(/^_/, "");
}

export function generateSchemaFromEntities(
  entities: EntityDefinition[],
  databaseType: "mysql" | "postgresql" | "sqlite" = "mysql"
): string {
  return generateDrizzleSchema(entities, databaseType);
}
