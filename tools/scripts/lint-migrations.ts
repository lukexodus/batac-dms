import {
  parse,
  astVisitor,
  Statement,
  CreateTableStatement,
  CreateIndexStatement,
  AlterTableStatement,
  DeleteStatement,
  DropStatement,
} from 'pgsql-ast-parser';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Record the parser choice: pgsql-ast-parser is used because it provides a lightweight,
// pure TypeScript AST structure and helper visitors, running entirely in-process.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const migrationsDir = path.join(rootDir, 'packages/database/migrations');

// Helper to check if column name suggests a timestamp
function isTimestampName(name: string): boolean {
  const lower = name.toLowerCase();
  // Exclude ID and user/actor references (e.g. deleted_by, city_id)
  if (lower.endsWith('_by') || lower.endsWith('_id')) {
    return false;
  }
  // All project timestamps use the _at, _on, or _timestamp suffix convention.
  return lower.endsWith('_at') || lower.endsWith('_on') || lower.endsWith('_timestamp');
}

// Helper to determine the 1-based line number for a character offset
function getLineNumber(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (content[i] === '\n') {
      line++;
    }
  }
  return line;
}

// Helper to find the exact line number of a column or constraint
function getColumnLineNumber(lines: string[], startLine: number, columnName: string): number {
  const colLower = columnName.toLowerCase();
  for (let i = startLine - 1; i < lines.length; i++) {
    const lineText = lines[i].toLowerCase();
    const regex = new RegExp(`\\b${colLower}\\b`);
    if (regex.test(lineText)) {
      return i + 1;
    }
  }
  return startLine;
}

// Helper to retrieve preceding comments for a statement's line
function getPrecedingComments(lines: string[], startLine: number): string[] {
  const comments: string[] = [];
  let idx = startLine - 2; // Line immediately preceding the statement is idx = startLine - 2
  while (idx >= 0) {
    const line = lines[idx].trim();
    if (line === '') {
      idx--;
      continue;
    }
    if (line.startsWith('--')) {
      comments.push(line);
      idx--;
    } else {
      break;
    }
  }
  return comments;
}

interface SuppressionResult {
  suppressed: boolean;
  error?: string;
}

// Helper to inspect preceding comments for a suppression instruction
function checkSuppression(comments: string[], ruleName: string): SuppressionResult {
  const pattern = new RegExp(`--\\s*linter:\\s*${ruleName}(?:\\s+reason=["'](.*?)["'])?`);
  for (const comment of comments) {
    const match = comment.match(pattern);
    if (match) {
      const reason = match[1]?.trim();
      if (!reason) {
        return {
          suppressed: true,
          error: `Suppression comment missing reason.`,
        };
      }
      return { suppressed: true };
    }
  }
  return { suppressed: false };
}

function runLinter() {
  console.log('Running database migrations linter...');
  if (!fs.existsSync(migrationsDir)) {
    console.log('Migrations directory does not exist. Skipping migration linting.');
    process.exit(0);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL migration files found. Skipping migration linting.');
    process.exit(0);
  }

  let hasFailures = false;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const createdTablesInFile = new Set<string>();

    let ast: Statement[];
    let skippedChunks: { line: number; preview: string }[] = [];
    try {
      ast = parse(content);
    } catch {
      // Fallback: split on Drizzle's statement-breakpoint markers and parse
      // each chunk individually. Statements the parser cannot handle (CREATE
      // TRIGGER, CREATE POLICY, SECURITY DEFINER, GRANT/REVOKE variants,
      // ALTER COLUMN ... SET DATA TYPE with a schema-qualified target type
      // and a USING cast — e.g. `ALTER TABLE t ALTER COLUMN c SET DATA TYPE
      // "schema"."enum_name" USING c::"schema"."enum_name"`, confirmed by
      // migration 0011_lumpy_goblin_queen.sql — etc.) are skipped with a
      // warning; the remaining parseable statements still receive invariant
      // checks. Skipped statements are NOT linted — the invariant checks
      // (soft-delete columns, city_id, expand-contract comments, index
      // concurrency, etc.) never ran against them. A "passed successfully"
      // result only means the parseable portion passed.
      ast = [];
      const breakpoint = '--> statement-breakpoint';
      const ranges: [number, number][] = [];
      let scanPos = 0;
      while (scanPos < content.length) {
        const bpIdx = content.indexOf(breakpoint, scanPos);
        if (bpIdx === -1) {
          ranges.push([scanPos, content.length]);
          break;
        }
        ranges.push([scanPos, bpIdx]);
        scanPos = bpIdx + breakpoint.length;
      }
      for (const [rangeStart, rangeEnd] of ranges) {
        const chunk = content.slice(rangeStart, rangeEnd);
        if (!chunk.trim()) continue;
        try {
          const groupAst = parse(chunk);
          for (const stmt of groupAst) {
            if (stmt._location) {
              stmt._location = {
                ...stmt._location,
                start: stmt._location.start + rangeStart,
                end: (stmt._location.end ?? stmt._location.start) + rangeStart,
              };
            }
          }
          ast.push(...groupAst);
        } catch {
          const line = getLineNumber(content, rangeStart);
          const firstLine = chunk.trim().split('\n')[0]?.trim().substring(0, 80) || '(empty)';
          skippedChunks.push({ line, preview: firstLine });
        }
      }
      if (skippedChunks.length > 0) {
        const locs = skippedChunks.map((c) => `  line ~${c.line}: ${c.preview}`).join('\n');
        console.warn(
          `[WARN] ${file}: ${skippedChunks.length} statement(s) skipped — unparseable by pgsql-ast-parser.\n${locs}\n  Linting rules were applied to parseable portions only.`,
        );
      }
      if (ast.length === 0) {
        console.error(
          `[FAIL] ${file}: no parseable statements found — file contains only constructs the parser cannot handle.`,
        );
        hasFailures = true;
        continue;
      }
    }

    const visitor = astVisitor((v) => ({
      createTable: (node: CreateTableStatement) => {
        const offset = node._location?.start ?? 0;
        const lineNum = getLineNumber(content, offset);
        const precedingComments = getPrecedingComments(lines, lineNum);

        const tableName = node.name.name;
        const tableSchema = node.name.schema;
        const fullTableName = tableSchema ? `${tableSchema}.${tableName}` : tableName;

        createdTablesInFile.add(tableName);
        if (tableSchema) createdTablesInFile.add(fullTableName);

        // Check city_id for core schemas (iam, organization, documents, workflow, tracking, records)
        const coreSchemas = ['iam', 'organization', 'documents', 'workflow', 'tracking', 'records'];
        if (tableSchema && coreSchemas.includes(tableSchema.toLowerCase())) {
          const hasCityId = node.columns.some(
            (col) =>
              col.kind === 'column' &&
              col.name.name.toLowerCase() === 'city_id' &&
              col.dataType.kind === undefined &&
              col.dataType.name.toLowerCase() === 'uuid' &&
              col.constraints?.some((c) => c.type === 'not null'),
          );
          if (!hasCityId) {
            const supp = checkSuppression(precedingComments, 'skip-city-id');
            if (supp.error) {
              console.error(`[FAIL] Suppression comment missing reason.
  File: ${file}
  Line ${lineNum}: ${lines[lineNum - 1]?.trim() || ''}
  Every suppression must include a reason.`);
              hasFailures = true;
            } else if (!supp.suppressed) {
              console.warn(`[WARN] Missing city_id column.
  File: ${file}
  Line ${lineNum}: CREATE TABLE ${fullTableName}
  Tables in core schema '${tableSchema}' must include city_id UUID NOT NULL.`);
            }
          }
        }

        // Check soft-delete columns (deleted_at and deleted_by)
        const hasDeletedAt = node.columns.some(
          (col) =>
            col.kind === 'column' &&
            col.name.name.toLowerCase() === 'deleted_at' &&
            col.dataType.kind === undefined &&
            (col.dataType.name.toLowerCase() === 'timestamptz' ||
              col.dataType.name.toLowerCase().includes('timezone')),
        );
        const hasDeletedBy = node.columns.some(
          (col) =>
            col.kind === 'column' &&
            col.name.name.toLowerCase() === 'deleted_by' &&
            col.dataType.kind === undefined &&
            col.dataType.name.toLowerCase() === 'uuid',
        );
        if (!hasDeletedAt || !hasDeletedBy) {
          const supp = checkSuppression(precedingComments, 'skip-soft-delete');
          if (supp.error) {
            console.error(`[FAIL] Suppression comment missing reason.
  File: ${file}
  Line ${lineNum}: ${lines[lineNum - 1]?.trim() || ''}
  Every suppression must include a reason.`);
            hasFailures = true;
          } else if (!supp.suppressed) {
            console.warn(`[WARN] Missing soft-delete columns.
  File: ${file}
  Line ${lineNum}: CREATE TABLE ${fullTableName}
  All tables must contain both deleted_at TIMESTAMPTZ and deleted_by UUID columns.`);
          }
        }

        // Check primary keys (Invariant #6)
        let tableHasPK = false;
        let pkColumns: string[] = [];

        const tablePKConstraint = node.constraints?.find((c) => c.type === 'primary key');
        if (tablePKConstraint && tablePKConstraint.type === 'primary key') {
          tableHasPK = true;
          pkColumns = tablePKConstraint.columns.map((col) => col.name.toLowerCase());
        }

        for (const col of node.columns) {
          if (col.kind !== 'column') continue;
          const colName = col.name.name.toLowerCase();

          const colLineNum = getColumnLineNumber(lines, lineNum, col.name.name);
          const colPrecedingComments = getPrecedingComments(lines, colLineNum);
          const colLineText = lines[colLineNum - 1]?.trim() || '';

          const isInlinePK = col.constraints?.some((c) => c.type === 'primary key');
          const isPartOfTablePK = pkColumns.includes(colName);
          const isPK = isInlinePK || isPartOfTablePK;

          if (isPK) {
            tableHasPK = true;
          }

          if (isPK) {
            if (
              tablePKConstraint &&
              tablePKConstraint.type === 'primary key' &&
              tablePKConstraint.columns.length > 1
            ) {
              // Composite Primary Key (junction tables)
              const isUuid =
                col.dataType.kind === undefined && col.dataType.name.toLowerCase() === 'uuid';
              if (!isUuid) {
                console.error(`[INVARIANT-06] Non-UUID primary key detected.
  File: ${file}
  Line ${colLineNum}: ${colLineText}
  All primary keys must be UUID v4: id UUID NOT NULL DEFAULT gen_random_uuid()`);
                hasFailures = true;
              }
            } else {
              // Single PK column
              const isUuid =
                col.dataType.kind === undefined && col.dataType.name.toLowerCase() === 'uuid';
              if (!isUuid) {
                console.error(`[INVARIANT-06] Non-UUID primary key detected.
  File: ${file}
  Line ${colLineNum}: ${colLineText}
  All primary keys must be UUID v4: id UUID NOT NULL DEFAULT gen_random_uuid()`);
                hasFailures = true;
              } else {
                const defaultConstraint = col.constraints?.find((c) => c.type === 'default');
                if (!defaultConstraint || defaultConstraint.type !== 'default') {
                  console.error(`[INVARIANT-06] UUID primary key missing gen_random_uuid() default.
  File: ${file}
  Line ${colLineNum}: ${colLineText}
  UUID primary keys must carry DEFAULT gen_random_uuid().`);
                  hasFailures = true;
                } else {
                  const defExpr = defaultConstraint.default;
                  if (defExpr.type === 'call') {
                    const fnName = defExpr.function.name.toLowerCase();
                    if (fnName === 'uuid_generate_v4') {
                      console.warn(`[WARN] UUID primary key uses uuid_generate_v4() default.
  File: ${file}
  Line ${colLineNum}: ${colLineText}
  uuid_generate_v4() is functionally equivalent, but gen_random_uuid() is the project standard (no uuid-ossp extension needed).`);
                    } else if (fnName !== 'gen_random_uuid') {
                      console.error(`[INVARIANT-06] UUID primary key missing gen_random_uuid() default.
  File: ${file}
  Line ${colLineNum}: ${colLineText}
  UUID primary keys must carry DEFAULT gen_random_uuid().`);
                      hasFailures = true;
                    }
                  } else {
                    console.error(`[INVARIANT-06] UUID primary key missing gen_random_uuid() default.
  File: ${file}
  Line ${colLineNum}: ${colLineText}
  UUID primary keys must carry DEFAULT gen_random_uuid().`);
                    hasFailures = true;
                  }
                }
              }
            }
          }

          // Check Invariant #7: TIMESTAMPTZ for timestamps (FAIL for TIMESTAMP, WARN for DATE)
          if (isTimestampName(col.name.name)) {
            const typeName = col.dataType.kind === undefined ? col.dataType.name.toLowerCase() : '';
            const isTimestamptz =
              typeName === 'timestamptz' ||
              typeName === 'timestamp with time zone' ||
              typeName.includes('timezone') ||
              typeName.includes('with time zone');
            if (!isTimestamptz) {
              if (typeName === 'date') {
                const supp = checkSuppression(colPrecedingComments, 'allow-date');
                if (supp.error) {
                  console.error(`[FAIL] Suppression comment missing reason.
  File: ${file}
  Line ${colLineNum}: ${colLineText}
  Every suppression must include a reason.`);
                  hasFailures = true;
                } else if (!supp.suppressed) {
                  console.warn(`[WARN] Undecorated DATE column detected.
  File: ${file}
  Line ${colLineNum}: ${colLineText}
  Column '${col.name.name}' is of type DATE. If time component is meaningless, suppress with '-- linter: allow-date reason="..."'`);
                }
              } else {
                console.error(`[INVARIANT-07] Non-timezone-aware timestamp column detected.
  File: ${file}
  Line ${colLineNum}: ${colLineText}
  All timestamp columns must use TIMESTAMPTZ (TIMESTAMP WITH TIME ZONE).`);
                hasFailures = true;
              }
            }
          }

          // Check Invariant #1: No cross-schema foreign keys (inline REFERENCE)
          const refConstraint = col.constraints?.find((c) => c.type === 'reference');
          if (refConstraint && refConstraint.type === 'reference') {
            const refSchema = refConstraint.foreignTable.schema;
            const owningSchemaForRef = tableSchema || 'public';
            if (refSchema && refSchema.toLowerCase() !== owningSchemaForRef.toLowerCase()) {
              const refComments = getPrecedingComments(lines, colLineNum);
              const refSupp = checkSuppression(refComments, 'allow-cross-schema-fk');
              if (refSupp.error) {
                console.error(`[FAIL] Suppression comment missing reason.
  File: ${file}
  Line ${colLineNum}: ${lines[colLineNum - 1]?.trim() || ''}
  Every suppression must include a reason.`);
                hasFailures = true;
              } else if (!refSupp.suppressed) {
                console.error(`[INVARIANT-01] Cross-schema foreign key detected.
  File: ${file}
  Line ${colLineNum}: REFERENCES ${refSchema}.${refConstraint.foreignTable.name}(${refConstraint.foreignColumns.map((c) => c.name).join(', ')})
  Tables in schema '${owningSchemaForRef}' may not reference tables in schema '${refSchema}'.
  Cross-schema relationships must be resolved at the application layer:
  store the UUID and resolve in code, or communicate via the event bus.`);
                hasFailures = true;
              }
            }
          }
        }

        // Check table-level foreign keys for Invariant #1
        if (node.constraints) {
          for (const constr of node.constraints) {
            if (constr.type === 'foreign key') {
              const refSchema = constr.foreignTable.schema;
              const owningSchemaForRef = tableSchema || 'public';
              const constrLineNum = getColumnLineNumber(lines, lineNum, constr.foreignTable.name);
              if (refSchema && refSchema.toLowerCase() !== owningSchemaForRef.toLowerCase()) {
                const fkComments = getPrecedingComments(lines, constrLineNum);
                const fkSupp = checkSuppression(fkComments, 'allow-cross-schema-fk');
                if (fkSupp.error) {
                  console.error(`[FAIL] Suppression comment missing reason.
  File: ${file}
  Line ${constrLineNum}: ${lines[constrLineNum - 1]?.trim() || ''}
  Every suppression must include a reason.`);
                  hasFailures = true;
                } else if (!fkSupp.suppressed) {
                  console.error(`[INVARIANT-01] Cross-schema foreign key detected.
  File: ${file}
  Line ${constrLineNum}: REFERENCES ${refSchema}.${constr.foreignTable.name}(${constr.foreignColumns.map((c) => c.name).join(', ')})
  Tables in schema '${owningSchemaForRef}' may not reference tables in schema '${refSchema}'.
  Cross-schema relationships must be resolved at the application layer:
  store the UUID and resolve in code, or communicate via the event bus.`);
                  hasFailures = true;
                }
              }
            }
          }
        }

        if (!tableHasPK) {
          console.error(`[INVARIANT-06] Table missing primary key.
  File: ${file}
  Line ${lineNum}: CREATE TABLE ${fullTableName}
  All tables must have a primary key.`);
          hasFailures = true;
        }

        v.super().createTable(node);
      },

      alterTable: (node: AlterTableStatement) => {
        const offset = node._location?.start ?? 0;
        const lineNum = getLineNumber(content, offset);

        const owningTable = node.table.name;
        const owningSchema = node.table.schema;

        for (const change of node.changes) {
          if (change.type === 'add column') {
            const col = change.column;
            const changeLineNum = getColumnLineNumber(lines, lineNum, col.name.name);
            const colPrecedingComments = getPrecedingComments(lines, changeLineNum);
            const changeLineText = lines[changeLineNum - 1]?.trim() || '';

            // Check Invariant #7: TIMESTAMPTZ for timestamps (FAIL for TIMESTAMP, WARN for DATE)
            if (isTimestampName(col.name.name)) {
              const typeName =
                col.dataType.kind === undefined ? col.dataType.name.toLowerCase() : '';
              const isTimestamptz =
                typeName === 'timestamptz' ||
                typeName === 'timestamp with time zone' ||
                typeName.includes('timezone') ||
                typeName.includes('with time zone');
              if (!isTimestamptz) {
                if (typeName === 'date') {
                  const supp = checkSuppression(colPrecedingComments, 'allow-date');
                  if (supp.error) {
                    console.error(`[FAIL] Suppression comment missing reason.
  File: ${file}
  Line ${changeLineNum}: ${changeLineText}
  Every suppression must include a reason.`);
                    hasFailures = true;
                  } else if (!supp.suppressed) {
                    console.warn(`[WARN] Undecorated DATE column detected.
  File: ${file}
  Line ${changeLineNum}: ${changeLineText}
  Column '${col.name.name}' is of type DATE. If time component is meaningless, suppress with '-- linter: allow-date reason="..."'`);
                  }
                } else {
                  console.error(`[INVARIANT-07] Non-timezone-aware timestamp column detected.
  File: ${file}
  Line ${changeLineNum}: ${changeLineText}
  All timestamp columns must use TIMESTAMPTZ (TIMESTAMP WITH TIME ZONE).`);
                  hasFailures = true;
                }
              }
            }

            // Check Invariant #1: No cross-schema foreign keys (inline references)
            const refConstraint = col.constraints?.find((c) => c.type === 'reference');
            if (refConstraint && refConstraint.type === 'reference') {
              const refSchema = refConstraint.foreignTable.schema;
              const owningSchemaForRef = owningSchema || 'public';
              if (refSchema && refSchema.toLowerCase() !== owningSchemaForRef.toLowerCase()) {
                const refComments = getPrecedingComments(lines, changeLineNum);
                const refSupp = checkSuppression(refComments, 'allow-cross-schema-fk');
                if (refSupp.error) {
                  console.error(`[FAIL] Suppression comment missing reason.
  File: ${file}
  Line ${changeLineNum}: ${lines[changeLineNum - 1]?.trim() || ''}
  Every suppression must include a reason.`);
                  hasFailures = true;
                } else if (!refSupp.suppressed) {
                  console.error(`[INVARIANT-01] Cross-schema foreign key detected.
  File: ${file}
  Line ${changeLineNum}: REFERENCES ${refSchema}.${refConstraint.foreignTable.name}(${refConstraint.foreignColumns.map((c) => c.name).join(', ')})
  Tables in schema '${owningSchemaForRef}' may not reference tables in schema '${refSchema}'.
  Cross-schema relationships must be resolved at the application layer:
  store the UUID and resolve in code, or communicate via the event bus.`);
                  hasFailures = true;
                }
              }
            }
          }

          if (change.type === 'add constraint') {
            const constr = change.constraint;
            if (constr.type === 'foreign key') {
              const refSchema = constr.foreignTable.schema;
              const owningSchemaForRef = owningSchema || 'public';
              const changeLineNum = getColumnLineNumber(lines, lineNum, constr.foreignTable.name);
              if (refSchema && refSchema.toLowerCase() !== owningSchemaForRef.toLowerCase()) {
                // Find the actual ALTER TABLE line by searching for it, since _location
                // is undefined in this pgsql-ast-parser version and lineNum is unreliable.
                let alterTableLine = changeLineNum;
                for (let i = 0; i < lines.length; i++) {
                  if (
                    lines[i].trim().startsWith('ALTER TABLE') &&
                    lines[i].includes(`"${constr.foreignTable.name}"`)
                  ) {
                    alterTableLine = i + 1;
                    break;
                  }
                }
                const fkComments = getPrecedingComments(lines, alterTableLine);
                const fkSupp = checkSuppression(fkComments, 'allow-cross-schema-fk');
                if (fkSupp.error) {
                  console.error(`[FAIL] Suppression comment missing reason.
  File: ${file}
  Line ${changeLineNum}: ${lines[changeLineNum - 1]?.trim() || ''}
  Every suppression must include a reason.`);
                  hasFailures = true;
                } else if (!fkSupp.suppressed) {
                  console.error(`[INVARIANT-01] Cross-schema foreign key detected.
  File: ${file}
  Line ${changeLineNum}: REFERENCES ${refSchema}.${constr.foreignTable.name}(${constr.foreignColumns.map((c) => c.name).join(', ')})
  Tables in schema '${owningSchemaForRef}' may not reference tables in schema '${refSchema}'.
  Cross-schema relationships must be resolved at the application layer:
  store the UUID and resolve in code, or communicate via the event bus.`);
                  hasFailures = true;
                }
              }
            }
          }

          if (change.type === 'drop column') {
            const changeLineNum = getColumnLineNumber(lines, lineNum, change.column.name);
            const precedingComments = getPrecedingComments(lines, changeLineNum);
            const changeLineText = lines[changeLineNum - 1]?.trim() || '';
            const hasExpandContract = precedingComments.some((c) =>
              /--\s*expand-contract:\s*contract phase/.test(c),
            );
            if (!hasExpandContract) {
              console.warn(`[WARN] DROP COLUMN statement detected without expand-contract comment.
  File: ${file}
  Line ${changeLineNum}: ${changeLineText}
  Any DROP must carry a '-- expand-contract: contract phase' comment.`);
            }
          }
        }

        v.super().alterTable(node);
      },

      drop: (node: DropStatement) => {
        const offset = node._location?.start ?? 0;
        const lineNum = getLineNumber(content, offset);
        const precedingComments = getPrecedingComments(lines, lineNum);
        const changeLineText = lines[lineNum - 1]?.trim() || '';

        const isTableOrIndexOrTrigger =
          node.type.includes('table') ||
          node.type.includes('index') ||
          node.type.includes('trigger');
        if (isTableOrIndexOrTrigger) {
          const hasExpandContract = precedingComments.some((c) =>
            /--\s*expand-contract:\s*contract phase/.test(c),
          );
          if (!hasExpandContract) {
            console.warn(`[WARN] DROP statement detected without expand-contract comment.
  File: ${file}
  Line ${lineNum}: ${changeLineText}
  Any DROP must carry a '-- expand-contract: contract phase' comment.`);
          }
        }
        v.super().drop(node);
      },

      delete: (node: DeleteStatement) => {
        const offset = node._location?.start ?? 0;
        const lineNum = getLineNumber(content, offset);
        const changeLineText = lines[lineNum - 1]?.trim() || '';

        console.error(`[FAIL] DML DELETE statement detected.
  File: ${file}
  Line ${lineNum}: ${changeLineText}
  Migrations must not contain row-deleting DML.`);
        hasFailures = true;
        v.super().delete(node);
      },

      createIndex: (node: CreateIndexStatement) => {
        const offset = node._location?.start ?? 0;
        const lineNum = getLineNumber(content, offset);

        const targetTable = node.table.name;
        const targetSchema = node.table.schema;
        const fullTargetTable = targetSchema ? `${targetSchema}.${targetTable}` : targetTable;

        if (!node.concurrently) {
          const wasCreatedInFile =
            createdTablesInFile.has(targetTable) || createdTablesInFile.has(fullTargetTable);
          if (!wasCreatedInFile) {
            console.warn(`[WARN] CREATE INDEX without CONCURRENTLY on an existing table.
  File: ${file}
  Line ${lineNum}: ${lines[lineNum - 1]?.trim() || ''}
  CREATE INDEX on existing table '${fullTargetTable}' must use CONCURRENTLY.`);
          }
        }
        v.super().createIndex(node);
      },
    }));

    for (const statement of ast) {
      visitor.statement(statement);
    }
  }

  if (hasFailures) {
    console.error('Migration invariant linting failed.');
    process.exit(1);
  } else {
    console.log('Migration invariant linting passed successfully.');
    process.exit(0);
  }
}

runLinter();
