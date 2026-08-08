import { z } from "zod";

function jsonTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesJsonType(value: unknown, type: string): boolean {
  const actual = jsonTypeOf(value);
  if (type === "integer")
    return actual === "number" && Number.isInteger(value as number);
  return actual === type;
}

function validateMetadataNode(
  value: unknown,
  schema: unknown,
  path: string,
  errors: string[],
): void {
  if (schema == null || typeof schema !== "object") return;
  const s = schema as Record<string, unknown>;

  if ("type" in s) {
    const types = Array.isArray(s["type"])
      ? (s["type"] as string[])
      : [s["type"] as string];
    if (!types.some((t) => matchesJsonType(value, t))) {
      errors.push(
        `${path}: expected type ${types.join(" | ")}, got ${jsonTypeOf(value)}`,
      );
      return;
    }
  }

  if (
    Array.isArray(s["enum"]) &&
    !s["enum"].some((e: unknown) => JSON.stringify(e) === JSON.stringify(value))
  ) {
    errors.push(`${path}: value not permitted by enum`);
  }

  if (jsonTypeOf(value) === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    if (s["properties"] && typeof s["properties"] === "object") {
      for (const [key, propSchema] of Object.entries(
        s["properties"] as Record<string, unknown>,
      )) {
        if (
          !(key in obj) &&
          propSchema &&
          typeof propSchema === "object" &&
          "default" in propSchema
        ) {
          obj[key] = (propSchema as Record<string, unknown>)["default"];
        }
      }
    }

    if (Array.isArray(s["required"])) {
      for (const key of s["required"] as string[]) {
        if (!(key in obj))
          errors.push(`${path}.${key}: required property missing`);
      }
    }
    if (s["properties"] && typeof s["properties"] === "object") {
      for (const [key, propSchema] of Object.entries(
        s["properties"] as Record<string, unknown>,
      )) {
        if (key in obj)
          validateMetadataNode(obj[key], propSchema, `${path}.${key}`, errors);
      }
    }
    if (
      s["additionalProperties"] === false &&
      s["properties"] &&
      typeof s["properties"] === "object"
    ) {
      const allowed = new Set(
        Object.keys(s["properties"] as Record<string, unknown>),
      );
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key))
          errors.push(
            `${path}.${key}: additional property not allowed by schema`,
          );
      }
    }
  }

  if (jsonTypeOf(value) === "array" && s["items"]) {
    (value as unknown[]).forEach((item, i) =>
      validateMetadataNode(item, s["items"], `${path}[${i}]`, errors),
    );
  }
}

export function buildMetadataZodSchema(
  jsonSchema: Record<string, unknown> | null | undefined,
): z.ZodType<Record<string, unknown>> {
  return z.record(z.string(), z.unknown()).superRefine((metadata, ctx) => {
    if (!jsonSchema || Object.keys(jsonSchema).length === 0) return;
    const errors: string[] = [];
    validateMetadataNode(metadata, jsonSchema, "metadata", errors);
    for (const message of errors) {
      // message format from validateMetadataNode is "metadata.path[.sub]: reason"
      // or "metadata[N]: reason" for array indices. Convert the dotted/bracketed
      // path into a Zod issue path array so RHF surfaces the error on the
      // specific field, not as a single form-level string.
      const pathPart = message.slice("metadata".length, message.indexOf(":"));
      const reason = message.slice(message.indexOf(":") + 2);
      const segments = pathPart
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .filter(Boolean);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: reason,
        path: segments,
      });
    }
  });
}
