import * as z from 'zod';

/**
 * Serializes a Zod schema into a string representation
 * @param schema The Zod schema to serialize
 * @returns A string representation of the schema
 */
export function serializeZodSchema(schema: z.ZodType<any>): string {
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const shapeEntries = Object.entries(shape).map(([key, value]) => {
      if (value instanceof z.ZodString) {
        return `"${key}": z.string()`;
      }
      if (value instanceof z.ZodNumber) {
        return `"${key}": z.number()`;
      }
      // Add more types as needed
      return `"${key}": z.unknown()`;
    });
    return `{${shapeEntries.join(', ')}}`;
  }
  // Handle other schema types as needed
  return 'z.unknown()';
} 