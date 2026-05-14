import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateType, validateField, validateSchema } from '../lib/validator';
import type {
  AvroFieldNode,
  AvroTypeNode,
  RootSchema,
  PrimitiveType,
} from '../types/avro';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<AvroFieldNode> = {}): AvroFieldNode {
  return {
    id: 'f1',
    name: 'myField',
    required: true,
    type: { kind: 'primitive', type: 'string' },
    ...overrides,
  };
}

const ROOT: RootSchema = { name: 'MyRecord' };

function noErrors(errors: unknown[]) {
  return errors.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Name validation — valid patterns (Task 5.4)
// ─────────────────────────────────────────────────────────────────────────────

describe('name validation — valid patterns', () => {
  const validNames = [
    'name',
    'Name',
    '_name',
    '_Name',
    'name123',
    'Name_123',
    '_',
    'a',
    'A',
    'camelCase',
    'PascalCase',
    'snake_case',
    'UPPER_SNAKE',
    'field1',
    '_private',
  ];

  it.each(validNames)('valid root name: "%s"', (name) => {
    expect(noErrors(validateSchema({ name }, []))).toBe(true);
  });

  it.each(validNames)('valid field name: "%s"', (name) => {
    expect(noErrors(validateField(makeField({ name }), 'fields[0]'))).toBe(true);
  });

  it.each(validNames)('valid record type name: "%s"', (name) => {
    const type: AvroTypeNode = { kind: 'record', name, fields: [] };
    expect(noErrors(validateType(type, 'fields[0].type', 'f1'))).toBe(true);
  });

  it.each(validNames)('valid enum type name: "%s"', (name) => {
    const type: AvroTypeNode = { kind: 'enum', name, symbols: ['A'] };
    expect(noErrors(validateType(type, 'fields[0].type', 'f1'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Name validation — invalid patterns (Task 5.4)
// ─────────────────────────────────────────────────────────────────────────────

describe('name validation — invalid patterns', () => {
  const invalidNames = [
    '1name',       // starts with digit
    '123',         // all digits
    'my-field',    // hyphen
    'my field',    // space
    'my.field',    // dot
    'my@field',    // special char
    '',            // empty
    'field name',  // space in middle
    '-field',      // starts with hyphen
    'field!',      // exclamation
  ];

  it.each(invalidNames)('invalid root name: "%s" → produces error', (name) => {
    const errors = validateSchema({ name }, []);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe('root.name');
  });

  it.each(invalidNames.filter(n => n !== ''))('invalid field name: "%s" → produces error', (name) => {
    const errors = validateField(makeField({ name }), 'fields[0]');
    expect(errors.some(e => e.path === 'fields[0].name')).toBe(true);
  });

  it('empty field name → produces error', () => {
    const errors = validateField(makeField({ name: '' }), 'fields[0]');
    expect(errors.some(e => e.path === 'fields[0].name')).toBe(true);
  });

  it.each(invalidNames.filter(n => n !== ''))('invalid record type name: "%s" → produces error', (name) => {
    const type: AvroTypeNode = { kind: 'record', name, fields: [] };
    const errors = validateType(type, 'fields[0].type', 'f1');
    expect(errors.some(e => e.path.includes('.name'))).toBe(true);
  });

  it.each(invalidNames.filter(n => n !== ''))('invalid enum type name: "%s" → produces error', (name) => {
    const type: AvroTypeNode = { kind: 'enum', name, symbols: ['A'] };
    const errors = validateType(type, 'fields[0].type', 'f1');
    expect(errors.some(e => e.path.includes('.name'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EnumNode with zero symbols (Task 5.5)
// ─────────────────────────────────────────────────────────────────────────────

describe('EnumNode with zero symbols', () => {
  it('enum with no symbols → produces error', () => {
    const type: AvroTypeNode = { kind: 'enum', name: 'Status', symbols: [] };
    const errors = validateType(type, 'fields[0].type', 'f1');
    expect(errors.some(e => e.path.includes('.symbols'))).toBe(true);
  });

  it('enum with no symbols → error message mentions "símbolo"', () => {
    const type: AvroTypeNode = { kind: 'enum', name: 'Status', symbols: [] };
    const errors = validateType(type, 'fields[0].type', 'f1');
    const symbolError = errors.find(e => e.path.includes('.symbols'));
    expect(symbolError?.message).toMatch(/symbol/i);
  });

  it('enum with 1 symbol → no symbol error', () => {
    const type: AvroTypeNode = { kind: 'enum', name: 'Status', symbols: ['ACTIVE'] };
    const errors = validateType(type, 'fields[0].type', 'f1');
    expect(errors.some(e => e.path.includes('.symbols'))).toBe(false);
  });

  it('enum with multiple symbols → no symbol error', () => {
    const type: AvroTypeNode = { kind: 'enum', name: 'Status', symbols: ['A', 'B', 'C'] };
    const errors = validateType(type, 'fields[0].type', 'f1');
    expect(noErrors(errors)).toBe(true);
  });

  it('field with enum type with no symbols → error propagates through validateField', () => {
    const field = makeField({
      type: { kind: 'enum', name: 'Status', symbols: [] },
    });
    const errors = validateField(field, 'fields[0]');
    expect(errors.some(e => e.path.includes('.symbols'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ArrayNode with undefined items (Task 5.6)
// ─────────────────────────────────────────────────────────────────────────────

describe('ArrayNode with undefined items', () => {
  it('array with undefined items → produces error', () => {
    const type = { kind: 'array', items: undefined } as unknown as AvroTypeNode;
    const errors = validateType(type, 'fields[0].type', 'f1');
    expect(errors.some(e => e.path.includes('.items'))).toBe(true);
  });

  it('array with undefined items → error message mentions "item"', () => {
    const type = { kind: 'array', items: undefined } as unknown as AvroTypeNode;
    const errors = validateType(type, 'fields[0].type', 'f1');
    const itemError = errors.find(e => e.path.includes('.items'));
    expect(itemError?.message).toMatch(/item/i);
  });

  it('array with valid primitive items → no error', () => {
    const type: AvroTypeNode = {
      kind: 'array',
      items: { kind: 'primitive', type: 'string' },
    };
    expect(noErrors(validateType(type, 'fields[0].type', 'f1'))).toBe(true);
  });

  it('array with valid record items → no error (when record name is valid)', () => {
    const type: AvroTypeNode = {
      kind: 'array',
      items: { kind: 'record', name: 'Address', fields: [] },
    };
    expect(noErrors(validateType(type, 'fields[0].type', 'f1'))).toBe(true);
  });

  it('array with invalid record items → error propagates', () => {
    const type: AvroTypeNode = {
      kind: 'array',
      items: { kind: 'record', name: '', fields: [] },
    };
    const errors = validateType(type, 'fields[0].type', 'f1');
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Default compatibility (Task 5.7)
// ─────────────────────────────────────────────────────────────────────────────

describe('default compatibility', () => {
  // int with string default
  it('int field with string default → produces error', () => {
    const field = makeField({
      type: { kind: 'primitive', type: 'int' },
      default: 'not-a-number',
      required: true,
    });
    const errors = validateField(field, 'fields[0]');
    expect(errors.some(e => e.path.includes('.default'))).toBe(true);
  });

  it('long field with string default → produces error', () => {
    const field = makeField({
      type: { kind: 'primitive', type: 'long' },
      default: 'hello',
      required: true,
    });
    const errors = validateField(field, 'fields[0]');
    expect(errors.some(e => e.path.includes('.default'))).toBe(true);
  });

  it('int field with float default → produces error', () => {
    const field = makeField({
      type: { kind: 'primitive', type: 'int' },
      default: 3.14,
      required: true,
    });
    const errors = validateField(field, 'fields[0]');
    expect(errors.some(e => e.path.includes('.default'))).toBe(true);
  });

  it('int field with integer default → no error', () => {
    const field = makeField({
      type: { kind: 'primitive', type: 'int' },
      default: 42,
      required: true,
    });
    expect(noErrors(validateField(field, 'fields[0]'))).toBe(true);
  });

  it('float field with number default → no error', () => {
    const field = makeField({
      type: { kind: 'primitive', type: 'float' },
      default: 3.14,
      required: true,
    });
    expect(noErrors(validateField(field, 'fields[0]'))).toBe(true);
  });

  it('boolean field with string default → produces error', () => {
    const field = makeField({
      type: { kind: 'primitive', type: 'boolean' },
      default: 'true',
      required: true,
    });
    const errors = validateField(field, 'fields[0]');
    expect(errors.some(e => e.path.includes('.default'))).toBe(true);
  });

  it('boolean field with boolean default → no error', () => {
    const field = makeField({
      type: { kind: 'primitive', type: 'boolean' },
      default: false,
      required: true,
    });
    expect(noErrors(validateField(field, 'fields[0]'))).toBe(true);
  });

  // enum with non-symbol default
  it('enum field with default not in symbols → produces error', () => {
    const field = makeField({
      type: { kind: 'enum', name: 'Status', symbols: ['ACTIVE', 'INACTIVE'] },
      default: 'PENDING',
      required: true,
    });
    const errors = validateField(field, 'fields[0]');
    expect(errors.some(e => e.path.includes('.default'))).toBe(true);
  });

  it('enum field with default in symbols → no error', () => {
    const field = makeField({
      type: { kind: 'enum', name: 'Status', symbols: ['ACTIVE', 'INACTIVE'] },
      default: 'ACTIVE',
      required: true,
    });
    expect(noErrors(validateField(field, 'fields[0]'))).toBe(true);
  });

  it('string field with string default → no error', () => {
    const field = makeField({
      type: { kind: 'primitive', type: 'string' },
      default: 'hello',
      required: true,
    });
    expect(noErrors(validateField(field, 'fields[0]'))).toBe(true);
  });

  it('optional field (required=false) — default is always null, no compatibility check', () => {
    const field = makeField({
      type: { kind: 'primitive', type: 'int' },
      default: 'wrong-type',
      required: false,
    });
    // Optional fields skip default validation (default is always null)
    expect(noErrors(validateField(field, 'fields[0]'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSchema — integration
// ─────────────────────────────────────────────────────────────────────────────

describe('validateSchema', () => {
  it('valid schema with no fields → no errors', () => {
    expect(noErrors(validateSchema(ROOT, []))).toBe(true);
  });

  it('valid schema with valid fields → no errors', () => {
    const fields: AvroFieldNode[] = [
      makeField({ name: 'id', type: { kind: 'primitive', type: 'string' } }),
      makeField({ id: 'f2', name: 'age', type: { kind: 'primitive', type: 'int' } }),
    ];
    expect(noErrors(validateSchema(ROOT, fields))).toBe(true);
  });

  it('empty root name → error on root.name', () => {
    const errors = validateSchema({ name: '' }, []);
    expect(errors.some(e => e.path === 'root.name')).toBe(true);
  });

  it('invalid root name → error on root.name', () => {
    const errors = validateSchema({ name: '1invalid' }, []);
    expect(errors.some(e => e.path === 'root.name')).toBe(true);
  });

  it('field errors are included with correct path', () => {
    const fields: AvroFieldNode[] = [makeField({ name: '' })];
    const errors = validateSchema(ROOT, fields);
    expect(errors.some(e => e.path === 'fields[0].name')).toBe(true);
  });

  it('multiple fields — errors from each field are collected', () => {
    const fields: AvroFieldNode[] = [
      makeField({ name: '' }),
      makeField({ id: 'f2', name: '1bad' }),
    ];
    const errors = validateSchema(ROOT, fields);
    expect(errors.some(e => e.path === 'fields[0].name')).toBe(true);
    expect(errors.some(e => e.path === 'fields[1].name')).toBe(true);
  });

  it('nested record errors propagate to top level', () => {
    const fields: AvroFieldNode[] = [
      makeField({
        type: {
          kind: 'record',
          name: 'Address',
          fields: [makeField({ id: 'nested', name: '' })],
        },
      }),
    ];
    const errors = validateSchema(ROOT, fields);
    expect(errors.some(e => e.path.includes('fields[0].type.fields[0].name'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P4 — validateSchema is idempotent (Task 5.8)
// ─────────────────────────────────────────────────────────────────────────────

const arbPrimitive = fc.constantFrom<PrimitiveType>(
  'null', 'boolean', 'int', 'long', 'float', 'double', 'string',
);

const arbFieldName = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,19}$/);

const arbField: fc.Arbitrary<AvroFieldNode> = fc.record({
  id: fc.uuid(),
  name: arbFieldName,
  required: fc.boolean(),
  type: arbPrimitive.map(type => ({ kind: 'primitive' as const, type })),
  doc: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
});

const arbRoot: fc.Arbitrary<RootSchema> = fc.record({
  name: fc.oneof(
    arbFieldName,
    fc.constant(''),
    fc.constant('1invalid'),
  ),
  namespace: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
});

describe('P4 — validateSchema is idempotent', () => {
  it('property: calling validateSchema twice returns the same errors', () => {
    fc.assert(
      fc.property(
        arbRoot,
        fc.array(arbField, { minLength: 0, maxLength: 4 }),
        (root, fields) => {
          const first = validateSchema(root, fields);
          const second = validateSchema(root, fields);
          return JSON.stringify(first) === JSON.stringify(second);
        },
      ),
    );
  });

  it('property: validateSchema does not mutate the fields array', () => {
    fc.assert(
      fc.property(
        fc.array(arbField, { minLength: 0, maxLength: 4 }),
        (fields) => {
          const snapshot = JSON.stringify(fields);
          validateSchema(ROOT, fields);
          return JSON.stringify(fields) === snapshot;
        },
      ),
    );
  });

  it('property: error count is stable across repeated calls', () => {
    fc.assert(
      fc.property(
        arbRoot,
        fc.array(arbField, { minLength: 0, maxLength: 4 }),
        (root, fields) => {
          const first = validateSchema(root, fields).length;
          const second = validateSchema(root, fields).length;
          return first === second;
        },
      ),
    );
  });
});
