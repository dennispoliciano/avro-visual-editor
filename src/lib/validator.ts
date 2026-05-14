import type {
  AvroFieldNode,
  AvroTypeNode,
  RootSchema,
  ValidationError,
} from '../types/avro';

// ─────────────────────────────────────────────────────────────────────────────
// Name pattern
// ─────────────────────────────────────────────────────────────────────────────

/** Valid Avro identifier: starts with letter or underscore, followed by letters, digits, underscores. */
const NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Default compatibility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when `value` is compatible with the given Avro type node.
 * Only called for required fields (optional fields always default to null).
 */
function isDefaultCompatible(type: AvroTypeNode, value: unknown): boolean {
  if (value === undefined) return true; // no default — always valid

  switch (type.kind) {
    case 'primitive':
      switch (type.type) {
        case 'null':    return value === null;
        case 'boolean': return typeof value === 'boolean';
        case 'int':
        case 'long':    return typeof value === 'number' && Number.isInteger(value);
        case 'float':
        case 'double':  return typeof value === 'number';
        case 'string':  return typeof value === 'string';
      }
      break;
    case 'enum':
      return typeof value === 'string' && type.symbols.includes(value);
    case 'logical':
    case 'record':
    case 'array':
      // Defaults for complex types are not validated beyond type presence
      return true;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateType
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates an AvroTypeNode and returns any errors found.
 *
 * Rules:
 * - RecordTypeNode: name must be valid; each child field is validated recursively
 * - EnumTypeNode:   name must be valid; must have at least 1 symbol
 * - ArrayTypeNode:  items must be defined (not undefined)
 * - PrimitiveTypeNode / LogicalTypeNode: always valid
 *
 * @param type  The type node to validate.
 * @param path  Human-readable path prefix for error messages (e.g. "fields[0].type").
 * @param fieldId  The id of the owning AvroFieldNode (used in ValidationError.fieldId).
 */
export function validateType(
  type: AvroTypeNode,
  path: string,
  fieldId: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (type.kind) {
    case 'primitive':
    case 'logical':
      // No structural validation needed
      break;

    case 'record': {
      if (!type.name || !isValidName(type.name)) {
        errors.push({
          fieldId,
          path: `${path}.name`,
          message: type.name
            ? `Invalid record name: "${type.name}". Use only letters, digits and underscores, starting with a letter or underscore.`
            : 'Record name is required.',
        });
      }
      type.fields.forEach((child, i) => {
        errors.push(...validateField(child, `${path}.fields[${i}]`));
      });
      break;
    }

    case 'enum': {
      if (!type.name || !isValidName(type.name)) {
        errors.push({
          fieldId,
          path: `${path}.name`,
          message: type.name
            ? `Invalid enum name: "${type.name}". Use only letters, digits and underscores, starting with a letter or underscore.`
            : 'Enum name is required.',
        });
      }
      if (type.symbols.length === 0) {
        errors.push({
          fieldId,
          path: `${path}.symbols`,
          message: 'Enum must have at least 1 symbol.',
        });
      }
      break;
    }

    case 'array': {
      if ((type.items as unknown) === undefined) {
        errors.push({
          fieldId,
          path: `${path}.items`,
          message: 'Array item type is required.',
        });
      } else {
        errors.push(...validateType(type.items, `${path}.items`, fieldId));
      }
      break;
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateField
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a single AvroFieldNode and returns any errors found.
 *
 * Rules:
 * - `name` must be non-empty and match `^[a-zA-Z_][a-zA-Z0-9_]*$`
 * - `default` must be compatible with the field type (required fields only)
 * - The field's type node is validated recursively via `validateType`
 *
 * @param field  The field node to validate.
 * @param path   Human-readable path prefix (e.g. "fields[0]").
 */
export function validateField(field: AvroFieldNode, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate name
  if (!field.name) {
    errors.push({
      fieldId: field.id,
      path: `${path}.name`,
      message: 'Field name is required.',
    });
  } else if (!isValidName(field.name)) {
    errors.push({
      fieldId: field.id,
      path: `${path}.name`,
      message: `Invalid field name: "${field.name}". Use only letters, digits and underscores, starting with a letter or underscore.`,
    });
  }

  if (field.required && field.default !== undefined) {
    if (!isDefaultCompatible(field.type, field.default)) {
      errors.push({
        fieldId: field.id,
        path: `${path}.default`,
        message: `Default value is incompatible with type "${field.type.kind === 'primitive' ? field.type.type : field.type.kind}".`,
      });
    }
  }

  // Validate the type node recursively
  errors.push(...validateType(field.type, `${path}.type`, field.id));

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateSchema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates the complete editor state and returns all validation errors.
 *
 * Rules:
 * - Root `name` must be non-empty and match the Avro name pattern
 * - Each field in `fields` is validated via `validateField`
 *
 * This function is pure and idempotent: calling it twice with the same
 * arguments always returns the same set of errors (P4).
 *
 * @param root    The root schema header.
 * @param fields  The list of top-level fields.
 */
export function validateSchema(
  root: RootSchema,
  fields: AvroFieldNode[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate root name
  if (!root.name) {
    errors.push({
      fieldId: 'root',
      path: 'root.name',
      message: 'Schema name is required.',
    });
  } else if (!isValidName(root.name)) {
    errors.push({
      fieldId: 'root',
      path: 'root.name',
      message: `Invalid schema name: "${root.name}". Use only letters, digits and underscores, starting with a letter or underscore.`,
    });
  }

  // Validate each top-level field
  fields.forEach((field, i) => {
    errors.push(...validateField(field, `fields[${i}]`));
  });

  return errors;
}
