// ─────────────────────────────────────────────────────────────────────────────
// Primitive & logical type names
// ─────────────────────────────────────────────────────────────────────────────

/** The seven Avro primitive types. */
export type PrimitiveType =
  | 'null'
  | 'boolean'
  | 'int'
  | 'long'
  | 'float'
  | 'double'
  | 'string';

/** Logical type names presented to the user as selectable options. */
export type LogicalTypeName = 'date' | 'timestamp-millis';

/**
 * All type options available in the type selector.
 * Includes primitives, complex types, and logical types.
 */
export type SelectableType =
  | PrimitiveType
  | 'record'
  | 'enum'
  | 'array'
  | LogicalTypeName;

// ─────────────────────────────────────────────────────────────────────────────
// AvroTypeNode variants
// ─────────────────────────────────────────────────────────────────────────────

/** A primitive Avro type (null, boolean, int, long, float, double, string). */
export interface PrimitiveTypeNode {
  kind: 'primitive';
  type: PrimitiveType;
}

/**
 * A logical type node.
 * - 'date'              → serializes as { "type": "int",  "logicalType": "date" }
 * - 'timestamp-millis'  → serializes as { "type": "long", "logicalType": "timestamp-millis" }
 */
export interface LogicalTypeNode {
  kind: 'logical';
  logicalType: LogicalTypeName;
}

/** A record type node — contains a name, an optional logical name, and a list of child fields. */
export interface RecordTypeNode {
  kind: 'record';
  /**
   * The Avro type name — serialized as the `"name"` key inside the type object
   * and used as the generated class name in producers/consumers.
   *
   * This is both the display name in the UI and the actual field type name
   * that appears in the generated payload.
   */
  name: string;
  /**
   * Avro logical name — when present, overrides `name` as the serialized
   * `"name"` key inside the type object.
   *
   * Used to avoid class name collisions when the same field name appears in
   * multiple events (e.g. both `OrderCreated` and `OrderUpdated` have an
   * `address` record field). Without a logical name, both would generate a
   * class called `Address`, causing ambiguity.
   *
   * Convention: `fieldName_EventNameWithoutValueSuffix`
   * Example: `address_AcademicStudentUpdated`
   *
   * When undefined, `name` is used directly in the serialized output.
   */
  logicalName?: string;
  fields: AvroFieldNode[];
}

/** An enum type node — contains a name, an optional logical name, and a list of symbol strings. */
export interface EnumTypeNode {
  kind: 'enum';
  /**
   * The Avro type name — serialized as the `"name"` key inside the type object
   * and used as the generated enum class name in producers/consumers.
   *
   * This is both the display name in the UI and the actual type name
   * that appears in the generated payload.
   */
  name: string;
  /**
   * Avro logical name — when present, overrides `name` as the serialized
   * `"name"` key inside the type object.
   *
   * Same purpose as `RecordTypeNode.logicalName`: prevents class name
   * collisions when the same enum field name is used across multiple events.
   *
   * Convention: `fieldName_EventNameWithoutValueSuffix`
   * Example: `status_AcademicStudentUpdated`
   *
   * When undefined, `name` is used directly in the serialized output.
   */
  logicalName?: string;
  symbols: string[];
}

/**
 * An array type node — contains the type of its items.
 * Items can be any AvroTypeNode, enabling arrays of arrays, arrays of records, etc.
 */
export interface ArrayTypeNode {
  kind: 'array';
  items: AvroTypeNode;
}

/** Discriminated union of all possible type nodes. */
export type AvroTypeNode =
  | PrimitiveTypeNode
  | LogicalTypeNode
  | RecordTypeNode
  | EnumTypeNode
  | ArrayTypeNode;

// ─────────────────────────────────────────────────────────────────────────────
// Field node
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents a single field in an Avro schema.
 *
 * - `id`       — UUID v4, internal only, never serialized to JSON.
 * - `name`     — the field name as it appears in the generated payload.
 * - `required` — when false the serialized type becomes ["null", <type>]
 *                with "default": null.
 * - `default`  — undefined means no default; null means explicit null default.
 */
export interface AvroFieldNode {
  /** UUID v4 — internal identifier, never serialized to JSON. */
  id: string;
  /** The field name as it appears in the generated Avro payload. */
  name: string;
  required: boolean;
  doc?: string;
  default?: unknown;
  type: AvroTypeNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root schema header
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema type suffix selector.
 *
 * - `'Value'` → serialized name becomes `<name>Value`
 * - `'Key'`   → serialized name becomes `<name>Key`
 * - `'None'`  → serialized name is `<name>` unchanged
 */
export type SchemaType = 'Value' | 'Key' | 'None';

/**
 * Metadata for the root record schema.
 *
 * - `namespace`    — omitted from JSON when empty/undefined.
 * - `doc`          — omitted from JSON when empty/undefined.
 * - `connectName`  — serialized as `"connect.name"` in the JSON output.
 *                    Typically `"<namespace>.<name>"` (Kafka Connect convention).
 *                    When undefined, the field is omitted from the JSON.
 *                    The UI can auto-suggest `namespace + "." + name` but allow
 *                    manual override.
 * - `schemaType`   — controls the suffix appended to `name` in the serialized output.
 *                    `'Value'` → `<name>Value`, `'Key'` → `<name>Key`, `'None'` → `<name>`.
 *                    Defaults to `'None'` when omitted (backward-compatible).
 */
export interface RootSchema {
  name: string;
  namespace?: string;
  doc?: string;
  connectName?: string;
  /** Defaults to `'None'` when omitted. */
  schemaType?: SchemaType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor state
// ─────────────────────────────────────────────────────────────────────────────

/** The complete state managed by the Zustand store. */
export interface EditorState {
  root: RootSchema;
  fields: AvroFieldNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single validation error produced by validateSchema / validateField / validateType.
 *
 * - `fieldId` — the id of the AvroFieldNode that owns the error (or 'root' for
 *               root-level schema errors).
 * - `path`    — human-readable dot-notation path, e.g. "fields[0].type.fields[1].name".
 * - `message` — user-facing error message in Portuguese.
 */
export interface ValidationError {
  fieldId: string;
  path: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Field path (for nested mutations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identifies a nested field within the AvroFieldNode tree.
 *
 * Each segment is a string key used to traverse the tree:
 *   - Root-level field by index:  ["2"]
 *   - Nested field in a record:   ["0", "type.fields", "1"]
 *
 * The store actions (addNestedField, removeNestedField, etc.) use this path
 * to locate the target node via Immer-based immutable updates.
 */
export type FieldPath = string[];

// ─────────────────────────────────────────────────────────────────────────────
// Type guard helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isPrimitiveTypeNode(node: AvroTypeNode): node is PrimitiveTypeNode {
  return node.kind === 'primitive';
}

export function isLogicalTypeNode(node: AvroTypeNode): node is LogicalTypeNode {
  return node.kind === 'logical';
}

export function isRecordTypeNode(node: AvroTypeNode): node is RecordTypeNode {
  return node.kind === 'record';
}

export function isEnumTypeNode(node: AvroTypeNode): node is EnumTypeNode {
  return node.kind === 'enum';
}

export function isArrayTypeNode(node: AvroTypeNode): node is ArrayTypeNode {
  return node.kind === 'array';
}

/** Returns true for type nodes that have child sub-nodes (record, array, enum). */
export function hasSubNodes(node: AvroTypeNode): boolean {
  return node.kind === 'record' || node.kind === 'array' || node.kind === 'enum';
}

/** Returns the default AvroTypeNode for a given SelectableType. */
export function defaultTypeNode(selectable: SelectableType): AvroTypeNode {
  switch (selectable) {
    case 'record':
      return { kind: 'record', name: '', logicalName: undefined, fields: [] };
    case 'enum':
      return { kind: 'enum', name: '', logicalName: undefined, symbols: [] };
    case 'array':
      return { kind: 'array', items: { kind: 'primitive', type: 'string' } };
    case 'date':
    case 'timestamp-millis':
      return { kind: 'logical', logicalType: selectable };
    default:
      return { kind: 'primitive', type: selectable as PrimitiveType };
  }
}
