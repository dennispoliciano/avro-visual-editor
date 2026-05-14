/**
 * End-to-End Integration Tests (Task 16)
 *
 * These tests exercise the full pipeline:
 *   AvroFieldNode tree → serializeSchema → JSON output
 *
 * They verify that the serializer produces the exact JSON structure
 * expected for each Avro type scenario.
 */

import { describe, it, expect } from 'vitest';
import { serializeSchema } from '../lib/serializer';
import { validateField } from '../lib/validator';
import type { AvroFieldNode, RootSchema } from '../types/avro';

const ROOT: RootSchema = {
  name: 'OrderCreated',
  namespace: 'com.example.orders',
  connectName: 'com.example.orders.OrderCreated',
};

// ─────────────────────────────────────────────────────────────────────────────
// 16.1 — Nested record: Customer → addresses → Address → street
// ─────────────────────────────────────────────────────────────────────────────

describe('16.1 — nested record structure', () => {
  it('Customer → addresses (array of Address) → street generates correct JSON', () => {
    const streetField: AvroFieldNode = {
      id: 'f-street',
      name: 'street',
      required: true,
      doc: 'Street name',
      type: { kind: 'primitive', type: 'string' },
    };

    const addressRecord: AvroFieldNode = {
      id: 'f-address',
      name: 'address',
      required: true,
      doc: 'Customer address',
      type: {
        kind: 'record',
        name: 'address',
        logicalName: 'address_OrderCreated',
        fields: [streetField],
      },
    };

    const fields: AvroFieldNode[] = [addressRecord];
    const result = serializeSchema(ROOT, fields);

    expect(result.type).toBe('record');
    expect(result.name).toBe('OrderCreated');

    const serializedFields = result.fields as Record<string, unknown>[];
    expect(serializedFields).toHaveLength(1);

    const addrField = serializedFields[0];
    expect(addrField.name).toBe('address');
    expect(addrField.doc).toBe('Customer address');

    const addrType = addrField.type as Record<string, unknown>;
    expect(addrType.name).toBe('address_OrderCreated');
    expect(addrType.type).toBe('record');

    const nestedFields = addrType.fields as Record<string, unknown>[];
    expect(nestedFields).toHaveLength(1);
    expect(nestedFields[0].name).toBe('street');
    expect(nestedFields[0].type).toBe('string');
  });

  it('three-level nesting: Customer → address → city → name', () => {
    const cityNameField: AvroFieldNode = {
      id: 'f-city-name',
      name: 'name',
      required: true,
      type: { kind: 'primitive', type: 'string' },
    };

    const cityRecord: AvroFieldNode = {
      id: 'f-city',
      name: 'city',
      required: true,
      type: {
        kind: 'record',
        name: 'city',
        logicalName: 'city_OrderCreated',
        fields: [cityNameField],
      },
    };

    const addressRecord: AvroFieldNode = {
      id: 'f-address',
      name: 'address',
      required: true,
      type: {
        kind: 'record',
        name: 'address',
        logicalName: 'address_OrderCreated',
        fields: [cityRecord],
      },
    };

    const result = serializeSchema(ROOT, [addressRecord]);
    const addrType = (result.fields as Record<string, unknown>[])[0].type as Record<string, unknown>;
    const cityType = (addrType.fields as Record<string, unknown>[])[0].type as Record<string, unknown>;

    expect(cityType.name).toBe('city_OrderCreated');
    expect(cityType.type).toBe('record');
    expect((cityType.fields as Record<string, unknown>[])[0].name).toBe('name');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16.2 — Optional field: union with null as first element and default null
// ─────────────────────────────────────────────────────────────────────────────

describe('16.2 — optional field generates union with null first and default null', () => {
  it('optional string field → ["null","string"] with default null', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'description',
        required: false,
        type: { kind: 'primitive', type: 'string' },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];

    expect(Array.isArray(field.type)).toBe(true);
    expect((field.type as unknown[])[0]).toBe('null');
    expect((field.type as unknown[])[1]).toBe('string');
    expect(field.default).toBeNull();
  });

  it('optional int field → ["null","int"] with default null', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'quantity',
        required: false,
        type: { kind: 'primitive', type: 'int' },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];

    expect((field.type as unknown[])[0]).toBe('null');
    expect((field.type as unknown[])[1]).toBe('int');
    expect(field.default).toBeNull();
  });

  it('optional record field → ["null", {type:"record",...}] with default null', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'metadata',
        required: false,
        type: { kind: 'record', name: 'metadata', fields: [] },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    const typeArr = field.type as unknown[];

    expect(typeArr[0]).toBe('null');
    expect((typeArr[1] as Record<string, unknown>).type).toBe('record');
    expect(field.default).toBeNull();
  });

  it('null is always the FIRST element of the union', () => {
    const types = ['boolean', 'long', 'float', 'double'] as const;
    for (const t of types) {
      const fields: AvroFieldNode[] = [
        { id: 'f1', name: 'val', required: false, type: { kind: 'primitive', type: t } },
      ];
      const result = serializeSchema(ROOT, fields);
      const typeArr = (result.fields as Record<string, unknown>[])[0].type as unknown[];
      expect(typeArr[0]).toBe('null');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16.3 — date field generates Kafka Connect date object
// ─────────────────────────────────────────────────────────────────────────────

describe('16.3 — date field generates Kafka Connect date object', () => {
  it('required date field → {type:"int","connect.version":1,"connect.name":"...Date","logicalType":"date"}', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'birthDate',
        required: true,
        type: { kind: 'logical', logicalType: 'date' },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];

    expect(field.name).toBe('birthDate');
    expect(field.type).toEqual({
      type: 'int',
      'connect.version': 1,
      'connect.name': 'org.apache.kafka.connect.data.Date',
      logicalType: 'date',
    });
  });

  it('optional date field → ["null", {type:"int",...}] with default null', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'expiryDate',
        required: false,
        type: { kind: 'logical', logicalType: 'date' },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    const typeArr = field.type as unknown[];

    expect(typeArr[0]).toBe('null');
    expect((typeArr[1] as Record<string, unknown>).type).toBe('int');
    expect((typeArr[1] as Record<string, unknown>).logicalType).toBe('date');
    expect(field.default).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16.4 — timestamp-millis field generates Kafka Connect timestamp object
// ─────────────────────────────────────────────────────────────────────────────

describe('16.4 — timestamp-millis field generates Kafka Connect timestamp object', () => {
  it('required timestamp-millis → {type:"long","connect.version":1,"connect.name":"...Timestamp","logicalType":"timestamp-millis"}', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'createdAt',
        required: true,
        type: { kind: 'logical', logicalType: 'timestamp-millis' },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];

    expect(field.name).toBe('createdAt');
    expect(field.type).toEqual({
      type: 'long',
      'connect.version': 1,
      'connect.name': 'org.apache.kafka.connect.data.Timestamp',
      logicalType: 'timestamp-millis',
    });
  });

  it('optional timestamp-millis → ["null", {type:"long",...}] with default null', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'updatedAt',
        required: false,
        type: { kind: 'logical', logicalType: 'timestamp-millis' },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    const typeArr = field.type as unknown[];

    expect(typeArr[0]).toBe('null');
    expect((typeArr[1] as Record<string, unknown>).type).toBe('long');
    expect((typeArr[1] as Record<string, unknown>).logicalType).toBe('timestamp-millis');
    expect(field.default).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16.5 — Array of arrays generates correct nested structure
// ─────────────────────────────────────────────────────────────────────────────

describe('16.5 — array of arrays generates correct nested structure', () => {
  it('array of array of string → {type:"array",items:{type:"array",items:"string"}}', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'matrix',
        required: true,
        type: {
          kind: 'array',
          items: {
            kind: 'array',
            items: { kind: 'primitive', type: 'string' },
          },
        },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    const outerType = field.type as Record<string, unknown>;

    expect(outerType.type).toBe('array');
    const innerType = outerType.items as Record<string, unknown>;
    expect(innerType.type).toBe('array');
    expect(innerType.items).toBe('string');
  });

  it('array of array of record → correct three-level nesting', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'groups',
        required: true,
        type: {
          kind: 'array',
          items: {
            kind: 'array',
            items: {
              kind: 'record',
              name: 'item',
              logicalName: 'item_OrderCreated',
              fields: [
                {
                  id: 'f2',
                  name: 'id',
                  required: true,
                  type: { kind: 'primitive', type: 'string' },
                },
              ],
            },
          },
        },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    const outerType = field.type as Record<string, unknown>;
    const innerType = outerType.items as Record<string, unknown>;
    const recordType = innerType.items as Record<string, unknown>;

    expect(outerType.type).toBe('array');
    expect(innerType.type).toBe('array');
    expect(recordType.type).toBe('record');
    expect(recordType.name).toBe('item_OrderCreated');
  });

  it('three-level array nesting', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'cube',
        required: true,
        type: {
          kind: 'array',
          items: {
            kind: 'array',
            items: {
              kind: 'array',
              items: { kind: 'primitive', type: 'int' },
            },
          },
        },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    const l1 = field.type as Record<string, unknown>;
    const l2 = l1.items as Record<string, unknown>;
    const l3 = l2.items as Record<string, unknown>;

    expect(l1.type).toBe('array');
    expect(l2.type).toBe('array');
    expect(l3.type).toBe('array');
    expect(l3.items).toBe('int');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16.6 — Enum field with symbols generates correct JSON
// ─────────────────────────────────────────────────────────────────────────────

describe('16.6 — enum field with symbols generates correct JSON', () => {
  it('enum field generates {name, type:"enum", symbols:[...]}', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'status',
        required: true,
        type: {
          kind: 'enum',
          name: 'status',
          logicalName: 'status_OrderCreated',
          symbols: ['PENDING', 'CONFIRMED', 'CANCELLED'],
        },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    const enumType = field.type as Record<string, unknown>;

    expect(enumType.name).toBe('status_OrderCreated');
    expect(enumType.type).toBe('enum');
    expect(enumType.symbols).toEqual(['PENDING', 'CONFIRMED', 'CANCELLED']);
  });

  it('enum default is limited to symbols — valid default is preserved', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'status',
        required: true,
        default: 'PENDING',
        type: {
          kind: 'enum',
          name: 'status',
          symbols: ['PENDING', 'CONFIRMED', 'CANCELLED'],
        },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    expect(field.default).toBe('PENDING');
  });

  it('optional enum field → ["null", {type:"enum",...}] with default null', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'priority',
        required: false,
        type: {
          kind: 'enum',
          name: 'priority',
          symbols: ['LOW', 'MEDIUM', 'HIGH'],
        },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    const typeArr = field.type as unknown[];

    expect(typeArr[0]).toBe('null');
    expect((typeArr[1] as Record<string, unknown>).type).toBe('enum');
    expect((typeArr[1] as Record<string, unknown>).symbols).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(field.default).toBeNull();
  });

  it('enum without logicalName uses name directly', () => {
    const fields: AvroFieldNode[] = [
      {
        id: 'f1',
        name: 'color',
        required: true,
        type: {
          kind: 'enum',
          name: 'Color',
          symbols: ['RED', 'GREEN', 'BLUE'],
        },
      },
    ];
    const result = serializeSchema(ROOT, fields);
    const field = (result.fields as Record<string, unknown>[])[0];
    const enumType = field.type as Record<string, unknown>;
    expect(enumType.name).toBe('Color');
  });

  // Validator confirms default must be one of the symbols
  it('validator rejects enum default not in symbols', () => {
    const field: AvroFieldNode = {
      id: 'f1',
      name: 'status',
      required: true,
      default: 'UNKNOWN',
      type: {
        kind: 'enum',
        name: 'status',
        symbols: ['PENDING', 'CONFIRMED'],
      },
    };
    const errors = validateField(field, 'fields[0]');
    expect(errors.some((e) => e.path.includes('.default'))).toBe(true);
  });

  it('validator accepts enum default that is in symbols', () => {
    const field: AvroFieldNode = {
      id: 'f1',
      name: 'status',
      required: true,
      default: 'PENDING',
      type: {
        kind: 'enum',
        name: 'status',
        symbols: ['PENDING', 'CONFIRMED'],
      },
    };
    const errors = validateField(field, 'fields[0]');
    expect(errors.some((e) => e.path.includes('.default'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full schema round-trip — complete realistic example
// ─────────────────────────────────────────────────────────────────────────────

describe('full schema round-trip', () => {
  it('produces a complete valid Avro schema with mixed field types', () => {
    const root: RootSchema = {
      name: 'OrderCreated',
      namespace: 'com.example.orders',
      doc: 'Order created event',
      connectName: 'com.example.orders.OrderCreated',
    };

    const fields: AvroFieldNode[] = [
      {
        id: 'f-id',
        name: 'id',
        required: true,
        doc: 'Order ID',
        type: { kind: 'primitive', type: 'string' },
      },
      {
        id: 'f-amount',
        name: 'amount',
        required: true,
        doc: 'Order amount',
        type: { kind: 'primitive', type: 'double' },
      },
      {
        id: 'f-created',
        name: 'createdAt',
        required: true,
        doc: 'Creation timestamp',
        type: { kind: 'logical', logicalType: 'timestamp-millis' },
      },
      {
        id: 'f-status',
        name: 'status',
        required: true,
        default: 'PENDING',
        type: {
          kind: 'enum',
          name: 'status',
          logicalName: 'status_OrderCreated',
          symbols: ['PENDING', 'CONFIRMED', 'CANCELLED'],
        },
      },
      {
        id: 'f-address',
        name: 'shippingAddress',
        required: false,
        doc: 'Shipping address',
        type: {
          kind: 'record',
          name: 'shippingAddress',
          logicalName: 'shippingAddress_OrderCreated',
          fields: [
            {
              id: 'f-street',
              name: 'street',
              required: true,
              type: { kind: 'primitive', type: 'string' },
            },
          ],
        },
      },
      {
        id: 'f-tags',
        name: 'tags',
        required: true,
        doc: 'Order tags',
        type: {
          kind: 'array',
          items: { kind: 'primitive', type: 'string' },
        },
      },
    ];

    const result = serializeSchema(root, fields);

    // Root structure
    expect(result.type).toBe('record');
    expect(result.name).toBe('OrderCreated');
    expect(result.namespace).toBe('com.example.orders');
    expect(result.doc).toBe('Order created event');
    expect(result['connect.name']).toBe('com.example.orders.OrderCreated');

    const serializedFields = result.fields as Record<string, unknown>[];
    expect(serializedFields).toHaveLength(6);

    // id — required string
    expect(serializedFields[0].name).toBe('id');
    expect(serializedFields[0].type).toBe('string');

    // amount — required double
    expect(serializedFields[1].name).toBe('amount');
    expect(serializedFields[1].type).toBe('double');

    // createdAt — timestamp-millis
    expect(serializedFields[2].name).toBe('createdAt');
    expect((serializedFields[2].type as Record<string, unknown>).logicalType).toBe('timestamp-millis');

    // status — enum with default
    expect(serializedFields[3].name).toBe('status');
    expect((serializedFields[3].type as Record<string, unknown>).type).toBe('enum');
    expect(serializedFields[3].default).toBe('PENDING');

    // shippingAddress — optional record
    expect(serializedFields[4].name).toBe('shippingAddress');
    expect(Array.isArray(serializedFields[4].type)).toBe(true);
    expect((serializedFields[4].type as unknown[])[0]).toBe('null');
    expect(serializedFields[4].default).toBeNull();

    // tags — array of string
    expect(serializedFields[5].name).toBe('tags');
    expect((serializedFields[5].type as Record<string, unknown>).type).toBe('array');
    expect((serializedFields[5].type as Record<string, unknown>).items).toBe('string');
  });
});
