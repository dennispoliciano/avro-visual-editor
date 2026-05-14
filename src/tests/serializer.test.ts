import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { serializeType, serializeField, serializeSchema } from '../lib/serializer';
import type {
  AvroFieldNode,
  AvroTypeNode,
  PrimitiveType,
  RootSchema,
} from '../types/avro';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<AvroFieldNode> = {}): AvroFieldNode {
  return {
    id: 'test-id',
    name: 'field',
    required: true,
    type: { kind: 'primitive', type: 'string' },
    ...overrides,
  };
}

const ROOT: RootSchema = { name: 'MyRecord', namespace: 'com.example' };

// ─────────────────────────────────────────────────────────────────────────────
// serializeType — all AvroTypeNode variants (Task 3.4)
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeType — all variants', () => {
  const primitives: PrimitiveType[] = [
    'null', 'boolean', 'int', 'long', 'float', 'double', 'string',
  ];

  it.each(primitives)(
    'primitive "%s" required=true → plain string',
    (prim) => {
      const result = serializeType({ kind: 'primitive', type: prim }, true);
      expect(result).toBe(prim);
    },
  );

  it('logical date required=true → Kafka Connect date object', () => {
    const result = serializeType({ kind: 'logical', logicalType: 'date' }, true);
    expect(result).toEqual({
      type: 'int',
      'connect.version': 1,
      'connect.name': 'org.apache.kafka.connect.data.Date',
      logicalType: 'date',
    });
  });

  it('logical timestamp-millis required=true → Kafka Connect timestamp object', () => {
    const result = serializeType({ kind: 'logical', logicalType: 'timestamp-millis' }, true);
    expect(result).toEqual({
      type: 'long',
      'connect.version': 1,
      'connect.name': 'org.apache.kafka.connect.data.Timestamp',
      logicalType: 'timestamp-millis',
    });
  });

  it('record required=true → {name, type:"record", fields} (name first)', () => {
    const node: AvroTypeNode = {
      kind: 'record',
      name: 'Address',
      logicalName: 'address_MyEvent',
      fields: [makeField({ name: 'street', type: { kind: 'primitive', type: 'string' } })],
    };
    const result = serializeType(node, true) as Record<string, unknown>;
    expect(result.name).toBe('address_MyEvent');
    expect(result.type).toBe('record');
    expect(Array.isArray(result.fields)).toBe(true);
    expect((result.fields as unknown[]).length).toBe(1);
  });

  it('record without logicalName falls back to name', () => {
    const node: AvroTypeNode = { kind: 'record', name: 'Address', fields: [] };
    const result = serializeType(node, true) as Record<string, unknown>;
    expect(result.name).toBe('Address');
  });

  it('enum required=true → {name, type:"enum", symbols}', () => {
    const node: AvroTypeNode = {
      kind: 'enum',
      name: 'Status',
      logicalName: 'status_MyEvent',
      symbols: ['EM_PROCESSAMENTO', 'INTEGRADO', 'ERRO'],
    };
    const result = serializeType(node, true) as Record<string, unknown>;
    expect(result).toEqual({
      name: 'status_MyEvent',
      type: 'enum',
      symbols: ['EM_PROCESSAMENTO', 'INTEGRADO', 'ERRO'],
    });
  });

  it('enum without logicalName falls back to name', () => {
    const node: AvroTypeNode = { kind: 'enum', name: 'Status', symbols: ['A'] };
    const result = serializeType(node, true) as Record<string, unknown>;
    expect(result.name).toBe('Status');
  });

  it('array of string required=true → {type:"array",items:"string"}', () => {
    const node: AvroTypeNode = {
      kind: 'array',
      items: { kind: 'primitive', type: 'string' },
    };
    const result = serializeType(node, true) as Record<string, unknown>;
    expect(result).toEqual({ type: 'array', items: 'string' });
  });

  it('array of record required=true → nested record in items', () => {
    const node: AvroTypeNode = {
      kind: 'array',
      items: { kind: 'record', name: 'address_MyEvent', fields: [] },
    };
    const result = serializeType(node, true) as Record<string, unknown>;
    expect(result.type).toBe('array');
    expect((result.items as Record<string, unknown>).type).toBe('record');
    expect((result.items as Record<string, unknown>).name).toBe('address_MyEvent');
  });

  it('array of array required=true → nested array in items', () => {
    const node: AvroTypeNode = {
      kind: 'array',
      items: {
        kind: 'array',
        items: { kind: 'primitive', type: 'int' },
      },
    };
    const result = serializeType(node, true) as Record<string, unknown>;
    expect(result.type).toBe('array');
    expect((result.items as Record<string, unknown>).type).toBe('array');
    expect((result.items as Record<string, unknown>).items).toBe('int');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Optional fields — union with null as first element (Task 3.5)
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeType — optional fields (required=false)', () => {
  it('primitive string optional → ["null","string"]', () => {
    const result = serializeType({ kind: 'primitive', type: 'string' }, false);
    expect(result).toEqual(['null', 'string']);
  });

  it('null is always first element of the union', () => {
    const result = serializeType({ kind: 'primitive', type: 'int' }, false) as unknown[];
    expect(result[0]).toBe('null');
  });

  it('record optional → ["null", {type:"record",...}]', () => {
    const node: AvroTypeNode = { kind: 'record', name: 'Addr', fields: [] };
    const result = serializeType(node, false) as unknown[];
    expect(result[0]).toBe('null');
    expect((result[1] as Record<string, unknown>).type).toBe('record');
  });

  it('enum optional → ["null", {type:"enum",...}]', () => {
    const node: AvroTypeNode = { kind: 'enum', name: 'S', symbols: ['A'] };
    const result = serializeType(node, false) as unknown[];
    expect(result[0]).toBe('null');
    expect((result[1] as Record<string, unknown>).type).toBe('enum');
  });

  it('array optional → ["null", {type:"array",...}]', () => {
    const node: AvroTypeNode = { kind: 'array', items: { kind: 'primitive', type: 'string' } };
    const result = serializeType(node, false) as unknown[];
    expect(result[0]).toBe('null');
    expect((result[1] as Record<string, unknown>).type).toBe('array');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LogicalTypeNode — Kafka Connect format (Task 3.6)
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeType — LogicalTypeNode (Kafka Connect)', () => {
  it('date → {type:"int","connect.version":1,"connect.name":"...Date","logicalType":"date"}', () => {
    expect(serializeType({ kind: 'logical', logicalType: 'date' }, true)).toEqual({
      type: 'int',
      'connect.version': 1,
      'connect.name': 'org.apache.kafka.connect.data.Date',
      logicalType: 'date',
    });
  });

  it('timestamp-millis → {type:"long","connect.version":1,"connect.name":"...Timestamp","logicalType":"timestamp-millis"}', () => {
    expect(serializeType({ kind: 'logical', logicalType: 'timestamp-millis' }, true)).toEqual({
      type: 'long',
      'connect.version': 1,
      'connect.name': 'org.apache.kafka.connect.data.Timestamp',
      logicalType: 'timestamp-millis',
    });
  });

  it('date optional → ["null", {type:"int","connect.version":1,...}]', () => {
    const result = serializeType({ kind: 'logical', logicalType: 'date' }, false) as unknown[];
    expect(result[0]).toBe('null');
    expect(result[1]).toEqual({
      type: 'int',
      'connect.version': 1,
      'connect.name': 'org.apache.kafka.connect.data.Date',
      logicalType: 'date',
    });
  });

  it('timestamp-millis optional → ["null", {type:"long","connect.version":1,...}]', () => {
    const result = serializeType({ kind: 'logical', logicalType: 'timestamp-millis' }, false) as unknown[];
    expect(result[0]).toBe('null');
    expect(result[1]).toEqual({
      type: 'long',
      'connect.version': 1,
      'connect.name': 'org.apache.kafka.connect.data.Timestamp',
      logicalType: 'timestamp-millis',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// serializeField
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeField', () => {
  it('required field — no default key in output', () => {
    const field = makeField({ required: true, default: undefined });
    const result = serializeField(field);
    expect('default' in result).toBe(false);
  });

  it('required field with explicit default — default is included', () => {
    const field = makeField({ required: true, default: 'hello' });
    const result = serializeField(field);
    expect(result.default).toBe('hello');
  });

  it('optional field — default is null', () => {
    const field = makeField({ required: false });
    const result = serializeField(field);
    expect(result.default).toBeNull();
  });

  it('optional field — type is union with null first', () => {
    const field = makeField({ required: false, type: { kind: 'primitive', type: 'int' } });
    const result = serializeField(field);
    expect(Array.isArray(result.type)).toBe(true);
    expect((result.type as unknown[])[0]).toBe('null');
  });

  it('doc is included when non-empty', () => {
    const field = makeField({ doc: 'some description' });
    expect(serializeField(field).doc).toBe('some description');
  });

  it('doc is omitted when empty string', () => {
    const field = makeField({ doc: '' });
    expect('doc' in serializeField(field)).toBe(false);
  });

  it('doc is omitted when undefined', () => {
    const field = makeField({ doc: undefined });
    expect('doc' in serializeField(field)).toBe(false);
  });

  it('id is never in the output', () => {
    const field = makeField({ id: 'should-not-appear' });
    expect('id' in serializeField(field)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// serializeSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeSchema', () => {
  it('produces type:"record" at root', () => {
    expect(serializeSchema(ROOT, []).type).toBe('record');
  });

  it('includes name and namespace', () => {
    const result = serializeSchema(ROOT, []);
    expect(result.name).toBe('MyRecord');
    expect(result.namespace).toBe('com.example');
  });

  it('namespace defaults to DEFAULT_NAMESPACE when not provided', () => {
    const result = serializeSchema({ name: 'X' }, []);
    expect(result.namespace).toBe('com.example');
  });

  it('namespace defaults to DEFAULT_NAMESPACE when empty string', () => {
    const result = serializeSchema({ name: 'X', namespace: '' }, []);
    expect(result.namespace).toBe('com.example');
  });

  it('namespace uses provided value when non-empty', () => {
    const result = serializeSchema({ name: 'X', namespace: 'com.example.orders' }, []);
    expect(result.namespace).toBe('com.example.orders');
  });

  it('omits doc when empty', () => {
    const result = serializeSchema({ name: 'X', doc: '' }, []);
    expect('doc' in result).toBe(false);
  });

  it('includes doc when present', () => {
    const result = serializeSchema({ name: 'X', doc: 'desc' }, []);
    expect(result.doc).toBe('desc');
  });

  it('connect.name uses provided value when non-empty', () => {
    const result = serializeSchema(
      { name: 'X', namespace: 'com.example', connectName: 'com.example.X' },
      [],
    );
    expect(result['connect.name']).toBe('com.example.X');
  });

  it('connect.name is auto-derived as namespace.name when not provided', () => {
    const result = serializeSchema({ name: 'MyEvent', namespace: 'com.example.orders' }, []);
    expect(result['connect.name']).toBe('com.example.orders.MyEvent');
  });

  it('connect.name uses DEFAULT_NAMESPACE when neither namespace nor connectName provided', () => {
    const result = serializeSchema({ name: 'MyEvent' }, []);
    expect(result['connect.name']).toBe('com.example.MyEvent');
  });

  it('serializes fields array', () => {
    const fields: AvroFieldNode[] = [
      makeField({ name: 'id', type: { kind: 'primitive', type: 'string' } }),
    ];
    const result = serializeSchema(ROOT, fields);
    expect(Array.isArray(result.fields)).toBe(true);
    expect((result.fields as unknown[]).length).toBe(1);
  });

  it('matches the full schema example', () => {
    const root: RootSchema = {
      name: 'OrderCreated',
      namespace: 'com.example.orders',
      doc: 'Order created event',
      connectName: 'com.example.orders.OrderCreated',
    };
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'id',
        required: true,
        type: { kind: 'primitive', type: 'string' },
        doc: 'Unique order identifier',
      },
    ];
    const result = serializeSchema(root, fields);
    expect(result).toEqual({
      type: 'record',
      name: 'OrderCreated',
      namespace: 'com.example.orders',
      doc: 'Order created event',
      fields: [
        {
          name: 'id',
          type: 'string',
          doc: 'Unique order identifier',
        },
      ],
      'connect.name': 'com.example.orders.OrderCreated',
    });
  });

  it('nested record with logicalName — Avro logical name to avoid class name collisions', () => {
    // parentField → parentField_EventName
    // parentField.childField → parentField_childField_EventName
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'address',
        required: true,
        doc: 'Shipping address',
        type: {
          kind: 'record',
          name: 'address',
          logicalName: 'address_OrderCreated',
          fields: [
            {
              id: 'f2',
              name: 'street',
              required: true,
              doc: 'Street name',
              type: { kind: 'primitive', type: 'string' },
            },
          ],
        },
      },
    ];
    const result = serializeSchema({ name: 'OrderCreated', namespace: 'com.example.orders' }, fields);
    const addressField = (result.fields as Record<string, unknown>[])[0];
    const addressType = addressField.type as Record<string, unknown>;
    expect(addressType.name).toBe('address_OrderCreated');
    expect(addressType.type).toBe('record');
  });

  it('enum with logicalName — Avro logical name to avoid class name collisions', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'status',
        required: true,
        doc: 'Order status',
        type: {
          kind: 'enum',
          name: 'status',
          logicalName: 'status_OrderCreated',
          symbols: ['PENDING', 'CONFIRMED', 'CANCELLED'],
        },
      },
    ];
    const result = serializeSchema({ name: 'OrderCreated' }, fields);
    const statusField = (result.fields as Record<string, unknown>[])[0];
    const statusType = statusField.type as Record<string, unknown>;
    expect(statusType.name).toBe('status_OrderCreated');
    expect(statusType.type).toBe('enum');
    expect(statusType.symbols).toEqual(['PENDING', 'CONFIRMED', 'CANCELLED']);
  });

  it('array of records — items has logicalName', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'items',
        required: true,
        doc: 'Order items',
        type: {
          kind: 'array',
          items: {
            kind: 'record',
            name: 'item',
            logicalName: 'item_OrderCreated',
            fields: [
              {
                id: 'f2',
                name: 'sku',
                required: true,
                doc: 'Product SKU',
                type: { kind: 'primitive', type: 'string' },
              },
            ],
          },
        },
      },
    ];
    const result = serializeSchema({ name: 'OrderCreated' }, fields);
    const listField = (result.fields as Record<string, unknown>[])[0];
    const listType = listField.type as Record<string, unknown>;
    expect(listType.type).toBe('array');
    const items = listType.items as Record<string, unknown>;
    expect(items.name).toBe('item_OrderCreated');
    expect(items.type).toBe('record');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based tests (fast-check)
// ─────────────────────────────────────────────────────────────────────────────

const arbPrimitive = fc.constantFrom<PrimitiveType>(
  'null', 'boolean', 'int', 'long', 'float', 'double', 'string',
);

const arbPrimitiveTypeNode = arbPrimitive.map(
  (type): AvroTypeNode => ({ kind: 'primitive', type }),
);

const arbFieldName = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,19}$/);

function makeArbitraryField(required: boolean): fc.Arbitrary<AvroFieldNode> {
  return fc.record({
    id: fc.uuid(),
    name: arbFieldName,
    required: fc.constant(required),
    type: arbPrimitiveTypeNode,
    doc: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  });
}

// P2: For any required=false field, serialized type[0] === "null" (Task 3.7)
describe('P2 — optional fields always have null as first union element', () => {
  it('property: serializeType(type, false)[0] === "null" for any primitive type', () => {
    fc.assert(
      fc.property(arbPrimitiveTypeNode, (typeNode) => {
        const result = serializeType(typeNode, false) as unknown[];
        return Array.isArray(result) && result[0] === 'null';
      }),
    );
  });

  it('property: serializeField with required=false always has type[0]==="null"', () => {
    fc.assert(
      fc.property(makeArbitraryField(false), (field) => {
        const result = serializeField(field);
        const type = result.type as unknown[];
        return Array.isArray(type) && type[0] === 'null';
      }),
    );
  });
});

// P3: For any required=true field, serialized type is not an array (Task 3.8)
describe('P3 — required fields never produce a union', () => {
  it('property: serializeType(type, true) is never an array for any primitive type', () => {
    fc.assert(
      fc.property(arbPrimitiveTypeNode, (typeNode) => {
        const result = serializeType(typeNode, true);
        return !Array.isArray(result);
      }),
    );
  });

  it('property: serializeField with required=true always has non-array type', () => {
    fc.assert(
      fc.property(makeArbitraryField(true), (field) => {
        const result = serializeField(field);
        return !Array.isArray(result.type);
      }),
    );
  });
});

// P5: serializeSchema does not mutate the input fields array (Task 3.9)
describe('P5 — serializeSchema does not mutate input', () => {
  it('property: fields array is structurally identical before and after serializeSchema', () => {
    fc.assert(
      fc.property(
        fc.array(makeArbitraryField(true), { minLength: 0, maxLength: 5 }),
        (fields) => {
          const snapshot = JSON.stringify(fields);
          serializeSchema({ name: 'Test' }, fields);
          return JSON.stringify(fields) === snapshot;
        },
      ),
    );
  });

  it('property: fields array length is unchanged after serializeSchema', () => {
    fc.assert(
      fc.property(
        fc.array(makeArbitraryField(false), { minLength: 0, maxLength: 5 }),
        (fields) => {
          const len = fields.length;
          serializeSchema({ name: 'Test' }, fields);
          return fields.length === len;
        },
      ),
    );
  });
});

