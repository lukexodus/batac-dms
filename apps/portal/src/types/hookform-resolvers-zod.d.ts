/**
 * Override for @hookform/resolvers/zod's zodResolver() type overloads, which
 * are version-branded against Zod's internal `_zod.version.minor` literal
 * and only accept exactly Zod 4.0.x. This project uses Zod ^4.4.3; the
 * runtime behavior is unaffected (the resolver correctly detects and
 * validates any Zod v4 schema), but the type-level overload match fails.
 *
 * Upstream: https://github.com/react-hook-form/resolvers/issues/842
 * (see also https://github.com/react-hook-form/resolvers/issues/813)
 */
declare module '@hookform/resolvers/zod' {
  import type { FieldValues, Resolver } from 'react-hook-form';
  import type { z } from 'zod';

  export function zodResolver<TSchema extends z.ZodType>(
    schema: TSchema,
    schemaOptions?: Record<string, unknown>,
    resolverOptions?: { mode?: 'async' | 'sync'; raw?: false },
  ): Resolver<z.input<TSchema> & FieldValues, unknown, z.output<TSchema>>;

  export function zodResolver<TSchema extends z.ZodType>(
    schema: TSchema,
    schemaOptions?: Record<string, unknown>,
    resolverOptions: { mode?: 'async' | 'sync'; raw: true },
  ): Resolver<z.input<TSchema> & FieldValues, unknown, z.input<TSchema> & FieldValues>;
}
