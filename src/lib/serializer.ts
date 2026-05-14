import type {
  AvroFieldNode,
  AvroTypeNode,
  RootSchema,
} from '../types/avro';
import { DEFAULT_NAMESPACE } from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// Kafka Connect logical type metadata
// ─────────────────────────────────────────────────────────────────────────────

const LOGICAL_TYPE_META: Record<string, { baseType: string; connectName: string }> = {
  'date': {
    baseType: 'int',
    connectName: 'org.apache.kafka.connect.data.Date',
  },
  'timestamp-millis': {
    baseType: 'long',
    connectName: 'org.apache.kafka.connect.data.Timestamp',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// serializeType
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializes an AvroTypeNode to its JSON representation.
 *
 * When `required` is false the result is wrapped in a union:
 *   ["null", <serialized type>]
 *
 * Rules:
 * - PrimitiveTypeNode  → string, e.g. "string"
 * - LogicalTypeNode    → Kafka Connect object, e.g.:
 *     { "type": "int", "connect.version": 1,
 *       "connect.name": "org.apache.kafka.connect.data.Date",
 *       "logicalType": "date" }
 * - RecordTypeNode     → { "name": logicalName|name, "type": "record", "fields": [...] }
 * - EnumTypeNode       → { "name": logicalName|name, "type": "enum", "symbols": [...] }
 * - ArrayTypeNode      → { "type": "array", "items": <serialized items (always required)> }
 */
export function serializeType(type: AvroTypeNode, required: boolean): unknown {
  const inner = serializeTypeInner(type);
  if (required) {
    return inner;
  }
  return ['null', inner];
}

/** Serializes the type node itself, always as a required (non-union) value. */
function serializeTypeInner(type: AvroTypeNode): unknown {
  switch (type.kind) {
    case 'primitive':
      return type.type;

    case 'logical': {
      const meta = LOGICAL_TYPE_META[type.logicalType];
      return {
        type: meta.baseType,
        'connect.version': 1,
        'connect.name': meta.connectName,
        logicalType: type.logicalType,
      };
    }

    case 'record':
      return {
        name: type.logicalName ?? type.name,
        type: 'record',
        fields: type.fields.map(serializeField),
      };

    case 'enum':
      return {
        name: type.logicalName ?? type.name,
        type: 'enum',
        symbols: [...type.symbols],
      };

    case 'array':
      return {
        type: 'array',
        items: serializeTypeInner(type.items),
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// serializeField
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializes a single AvroFieldNode to its JSON object representation.
 *
 * - `id` is never included in the output.
 * - `doc` is omitted when empty/undefined.
 * - When `required` is false, `"default": null` is always added.
 */
export function serializeField(field: AvroFieldNode): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: field.name,
    type: serializeType(field.type, field.required),
  };

  if (field.doc !== undefined && field.doc !== '') {
    result.doc = field.doc;
  }

  if (!field.required) {
    // Optional fields always get "default": null (null is first in the union)
    result.default = null;
  } else if (field.default !== undefined) {
    result.default = field.default;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// serializeSchema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializes the complete editor state to a valid Avro Value schema JSON object.
 *
 * Output order: type → name → namespace → doc → fields → connect.name
 *
 * - `name`      → `root.name` + suffix based on `root.schemaType`:
 *                 `'Value'` → `<name>Value`, `'Key'` → `<name>Key`, `'None'` → `<name>`.
 * - `namespace` → `root.namespace` when non-empty, otherwise `DEFAULT_NAMESPACE`
 *                 ("com.example"). Always present in the output.
 * - `doc`       → omitted when empty/undefined.
 * - `connect.name` → `root.connectName` when non-empty, otherwise auto-derived
 *                    as `"<namespace>.<name>"`. Always present in the output.
 * - Does NOT mutate the input `fields` array (P5).
 */
export function serializeSchema(
  root: RootSchema,
  fields: AvroFieldNode[],
): Record<string, unknown> {
  const namespace =
    root.namespace !== undefined && root.namespace !== ''
      ? root.namespace
      : DEFAULT_NAMESPACE;

  const suffix = (root.schemaType ?? 'None') === 'None' ? '' : root.schemaType as string;
  const serializedName = root.name + suffix;

  const connectName =
    root.connectName !== undefined && root.connectName !== ''
      ? root.connectName
      : `${namespace}.${serializedName}`;

  const schema: Record<string, unknown> = {
    type: 'record',
    name: serializedName,
    namespace,
  };

  if (root.doc !== undefined && root.doc !== '') {
    schema.doc = root.doc;
  }

  // Serialize fields without mutating the original array
  schema.fields = fields.map(serializeField);

  schema['connect.name'] = connectName;

  return schema;
}
