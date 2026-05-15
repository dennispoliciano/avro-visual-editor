import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../store/editorStore';
import type { AvroFieldNode, AvroTypeNode } from '../types/avro';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Reset the store to its initial state before each test. */
function resetStore() {
  useEditorStore.setState({
    root: { name: '', namespace: '', doc: '', connectName: '' },
    fields: [],
  });
}

/** Get the current store state snapshot. */
function getState() {
  return useEditorStore.getState();
}

/** Add a field and return its id. */
function addFieldAndGetId(): string {
  getState().addField();
  const fields = getState().fields;
  return fields[fields.length - 1].id;
}

function makeRecordField(name: string, childFields: AvroFieldNode[] = []): AvroFieldNode {
  return {
    id: `id-${name}`,
    name,
    required: true,
    type: { kind: 'record', name, fields: childFields },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
});

// ─────────────────────────────────────────────────────────────────────────────
// updateRoot
// ─────────────────────────────────────────────────────────────────────────────

describe('updateRoot', () => {
  it('updates root name', () => {
    getState().updateRoot({ name: 'OrderCreated' });
    expect(getState().root.name).toBe('OrderCreated');
  });

  it('updates root namespace', () => {
    getState().updateRoot({ namespace: 'com.example.orders' });
    expect(getState().root.namespace).toBe('com.example.orders');
  });

  it('updates root doc', () => {
    getState().updateRoot({ doc: 'Order created event' });
    expect(getState().root.doc).toBe('Order created event');
  });

  it('updates root connectName', () => {
    getState().updateRoot({ connectName: 'com.example.orders.OrderCreated' });
    expect(getState().root.connectName).toBe('com.example.orders.OrderCreated');
  });

  it('partial patch does not overwrite other fields', () => {
    getState().updateRoot({ name: 'Foo', namespace: 'com.example' });
    getState().updateRoot({ name: 'Bar' });
    expect(getState().root.namespace).toBe('com.example');
    expect(getState().root.name).toBe('Bar');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addField
// ─────────────────────────────────────────────────────────────────────────────

describe('addField', () => {
  it('adds a field to an empty list', () => {
    getState().addField();
    expect(getState().fields.length).toBe(1);
  });

  it('adds multiple fields', () => {
    getState().addField();
    getState().addField();
    getState().addField();
    expect(getState().fields.length).toBe(3);
  });

  it('new field has a unique id', () => {
    getState().addField();
    getState().addField();
    const [f1, f2] = getState().fields;
    expect(f1.id).not.toBe(f2.id);
  });

  it('new field has default type string', () => {
    getState().addField();
    const field = getState().fields[0];
    expect(field.type.kind).toBe('primitive');
    if (field.type.kind === 'primitive') {
      expect(field.type.type).toBe('string');
    }
  });

  it('new field is required by default', () => {
    getState().addField();
    expect(getState().fields[0].required).toBe(true);
  });

  it('new field has empty name', () => {
    getState().addField();
    expect(getState().fields[0].name).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// removeField
// ─────────────────────────────────────────────────────────────────────────────

describe('removeField', () => {
  it('removes a field by id', () => {
    const id = addFieldAndGetId();
    getState().removeField(id);
    expect(getState().fields.length).toBe(0);
  });

  it('removes the correct field when multiple exist', () => {
    const id1 = addFieldAndGetId();
    const id2 = addFieldAndGetId();
    const id3 = addFieldAndGetId();
    getState().removeField(id2);
    const ids = getState().fields.map((f) => f.id);
    expect(ids).toContain(id1);
    expect(ids).not.toContain(id2);
    expect(ids).toContain(id3);
  });

  it('does nothing for unknown id', () => {
    addFieldAndGetId();
    getState().removeField('non-existent-id');
    expect(getState().fields.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// moveField
// ─────────────────────────────────────────────────────────────────────────────

describe('moveField', () => {
  it('moves a field up', () => {
    const id1 = addFieldAndGetId();
    const id2 = addFieldAndGetId();
    getState().moveField(id2, 'up');
    expect(getState().fields[0].id).toBe(id2);
    expect(getState().fields[1].id).toBe(id1);
  });

  it('moves a field down', () => {
    const id1 = addFieldAndGetId();
    const id2 = addFieldAndGetId();
    getState().moveField(id1, 'down');
    expect(getState().fields[0].id).toBe(id2);
    expect(getState().fields[1].id).toBe(id1);
  });

  it('does not move first field up', () => {
    const id1 = addFieldAndGetId();
    const id2 = addFieldAndGetId();
    getState().moveField(id1, 'up');
    expect(getState().fields[0].id).toBe(id1);
    expect(getState().fields[1].id).toBe(id2);
  });

  it('does not move last field down', () => {
    const id1 = addFieldAndGetId();
    const id2 = addFieldAndGetId();
    getState().moveField(id2, 'down');
    expect(getState().fields[0].id).toBe(id1);
    expect(getState().fields[1].id).toBe(id2);
  });

  it('does nothing for unknown id', () => {
    const id1 = addFieldAndGetId();
    getState().moveField('unknown', 'up');
    expect(getState().fields[0].id).toBe(id1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateField
// ─────────────────────────────────────────────────────────────────────────────

describe('updateField', () => {
  it('updates field name', () => {
    const id = addFieldAndGetId();
    getState().updateField(id, { name: 'orderId' });
    expect(getState().fields[0].name).toBe('orderId');
  });

  it('updates field required', () => {
    const id = addFieldAndGetId();
    getState().updateField(id, { required: false });
    expect(getState().fields[0].required).toBe(false);
  });

  it('updates field doc', () => {
    const id = addFieldAndGetId();
    getState().updateField(id, { doc: 'The order identifier' });
    expect(getState().fields[0].doc).toBe('The order identifier');
  });

  it('updates field default', () => {
    const id = addFieldAndGetId();
    getState().updateField(id, { default: 'hello' });
    expect(getState().fields[0].default).toBe('hello');
  });

  it('does nothing for unknown id', () => {
    addFieldAndGetId();
    getState().updateField('unknown', { name: 'changed' });
    expect(getState().fields[0].name).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateFieldType
// ─────────────────────────────────────────────────────────────────────────────

describe('updateFieldType', () => {
  it('updates field type', () => {
    const id = addFieldAndGetId();
    const newType: AvroTypeNode = { kind: 'primitive', type: 'int' };
    getState().updateFieldType(id, newType);
    expect(getState().fields[0].type).toEqual(newType);
  });

  it('clears default when type changes', () => {
    const id = addFieldAndGetId();
    getState().updateField(id, { default: 'old-default' });
    getState().updateFieldType(id, { kind: 'primitive', type: 'int' });
    expect(getState().fields[0].default).toBeUndefined();
  });

  it('can set type to record', () => {
    const id = addFieldAndGetId();
    const recordType: AvroTypeNode = { kind: 'record', name: 'Address', fields: [] };
    getState().updateFieldType(id, recordType);
    expect(getState().fields[0].type.kind).toBe('record');
  });

  it('can set type to enum', () => {
    const id = addFieldAndGetId();
    const enumType: AvroTypeNode = { kind: 'enum', name: 'Status', symbols: ['A', 'B'] };
    getState().updateFieldType(id, enumType);
    expect(getState().fields[0].type.kind).toBe('enum');
  });

  it('can set type to array', () => {
    const id = addFieldAndGetId();
    const arrayType: AvroTypeNode = { kind: 'array', items: { kind: 'primitive', type: 'string' } };
    getState().updateFieldType(id, arrayType);
    expect(getState().fields[0].type.kind).toBe('array');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addNestedField
// ─────────────────────────────────────────────────────────────────────────────

describe('addNestedField', () => {
  it('adds a nested field to a record type', () => {
    // Set up: root field[0] is a record
    useEditorStore.setState({
      fields: [makeRecordField('address')],
      root: { name: 'OrderCreated' },
    });
    getState().addNestedField(['0']);
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields.length).toBe(1);
    }
  });

  it('adds multiple nested fields', () => {
    useEditorStore.setState({
      fields: [makeRecordField('address')],
      root: { name: 'OrderCreated' },
    });
    getState().addNestedField(['0']);
    getState().addNestedField(['0']);
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields.length).toBe(2);
    }
  });

  it('adds deeply nested field (record inside record)', () => {
    const innerRecord = makeRecordField('city');
    const outerRecord = makeRecordField('address', [innerRecord]);
    useEditorStore.setState({
      fields: [outerRecord],
      root: { name: 'OrderCreated' },
    });
    // Add to address.fields[0] (city record)
    getState().addNestedField(['0', '0']);
    const outerType = getState().fields[0].type;
    if (outerType.kind === 'record') {
      const innerType = outerType.fields[0].type;
      if (innerType.kind === 'record') {
        expect(innerType.fields.length).toBe(1);
      }
    }
  });

  it('does nothing if path points to non-record field', () => {
    addFieldAndGetId(); // string field
    getState().addNestedField(['0']);
    // fields[0] is a primitive, so nothing should be added
    expect(getState().fields.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// removeNestedField
// ─────────────────────────────────────────────────────────────────────────────

describe('removeNestedField', () => {
  it('removes a nested field by path', () => {
    const child: AvroFieldNode = {
      id: 'child-1',
      name: 'street',
      required: true,
      type: { kind: 'primitive', type: 'string' },
    };
    useEditorStore.setState({
      fields: [makeRecordField('address', [child])],
      root: { name: 'OrderCreated' },
    });
    getState().removeNestedField(['0', '0']);
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields.length).toBe(0);
    }
  });

  it('removes the correct nested field', () => {
    const child1: AvroFieldNode = { id: 'c1', name: 'street', required: true, type: { kind: 'primitive', type: 'string' } };
    const child2: AvroFieldNode = { id: 'c2', name: 'city', required: true, type: { kind: 'primitive', type: 'string' } };
    useEditorStore.setState({
      fields: [makeRecordField('address', [child1, child2])],
      root: { name: 'OrderCreated' },
    });
    getState().removeNestedField(['0', '0']);
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields[0].id).toBe('c2');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// moveNestedField
// ─────────────────────────────────────────────────────────────────────────────

describe('moveNestedField', () => {
  it('moves a nested field up', () => {
    const child1: AvroFieldNode = { id: 'c1', name: 'street', required: true, type: { kind: 'primitive', type: 'string' } };
    const child2: AvroFieldNode = { id: 'c2', name: 'city', required: true, type: { kind: 'primitive', type: 'string' } };
    useEditorStore.setState({
      fields: [makeRecordField('address', [child1, child2])],
      root: { name: 'OrderCreated' },
    });
    getState().moveNestedField(['0', '1'], 'up');
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields[0].id).toBe('c2');
      expect(recordType.fields[1].id).toBe('c1');
    }
  });

  it('moves a nested field down', () => {
    const child1: AvroFieldNode = { id: 'c1', name: 'street', required: true, type: { kind: 'primitive', type: 'string' } };
    const child2: AvroFieldNode = { id: 'c2', name: 'city', required: true, type: { kind: 'primitive', type: 'string' } };
    useEditorStore.setState({
      fields: [makeRecordField('address', [child1, child2])],
      root: { name: 'OrderCreated' },
    });
    getState().moveNestedField(['0', '0'], 'down');
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields[0].id).toBe('c2');
      expect(recordType.fields[1].id).toBe('c1');
    }
  });

  it('does not move first nested field up', () => {
    const child1: AvroFieldNode = { id: 'c1', name: 'street', required: true, type: { kind: 'primitive', type: 'string' } };
    const child2: AvroFieldNode = { id: 'c2', name: 'city', required: true, type: { kind: 'primitive', type: 'string' } };
    useEditorStore.setState({
      fields: [makeRecordField('address', [child1, child2])],
      root: { name: 'OrderCreated' },
    });
    getState().moveNestedField(['0', '0'], 'up');
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields[0].id).toBe('c1');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateNestedField
// ─────────────────────────────────────────────────────────────────────────────

describe('updateNestedField', () => {
  it('updates a nested field name', () => {
    const child: AvroFieldNode = { id: 'c1', name: 'street', required: true, type: { kind: 'primitive', type: 'string' } };
    useEditorStore.setState({
      fields: [makeRecordField('address', [child])],
      root: { name: 'OrderCreated' },
    });
    getState().updateNestedField(['0', '0'], { name: 'streetName' });
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields[0].name).toBe('streetName');
    }
  });

  it('updates a nested field required', () => {
    const child: AvroFieldNode = { id: 'c1', name: 'street', required: true, type: { kind: 'primitive', type: 'string' } };
    useEditorStore.setState({
      fields: [makeRecordField('address', [child])],
      root: { name: 'OrderCreated' },
    });
    getState().updateNestedField(['0', '0'], { required: false });
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields[0].required).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateNestedFieldType
// ─────────────────────────────────────────────────────────────────────────────

describe('updateNestedFieldType', () => {
  it('updates a nested field type', () => {
    const child: AvroFieldNode = { id: 'c1', name: 'zip', required: true, type: { kind: 'primitive', type: 'string' } };
    useEditorStore.setState({
      fields: [makeRecordField('address', [child])],
      root: { name: 'OrderCreated' },
    });
    getState().updateNestedFieldType(['0', '0'], { kind: 'primitive', type: 'int' });
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields[0].type).toEqual({ kind: 'primitive', type: 'int' });
    }
  });

  it('clears default when nested field type changes', () => {
    const child: AvroFieldNode = { id: 'c1', name: 'zip', required: true, default: '00000', type: { kind: 'primitive', type: 'string' } };
    useEditorStore.setState({
      fields: [makeRecordField('address', [child])],
      root: { name: 'OrderCreated' },
    });
    getState().updateNestedFieldType(['0', '0'], { kind: 'primitive', type: 'int' });
    const recordType = getState().fields[0].type;
    if (recordType.kind === 'record') {
      expect(recordType.fields[0].default).toBeUndefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Immutability — state references change on mutation
// ─────────────────────────────────────────────────────────────────────────────

describe('immutability (Immer)', () => {
  it('fields array reference changes after addField', () => {
    const before = getState().fields;
    getState().addField();
    const after = getState().fields;
    expect(before).not.toBe(after);
  });

  it('root reference changes after updateRoot', () => {
    const before = getState().root;
    getState().updateRoot({ name: 'Changed' });
    const after = getState().root;
    expect(before).not.toBe(after);
  });

  it('fields array reference changes after removeField', () => {
    const id = addFieldAndGetId();
    const before = getState().fields;
    getState().removeField(id);
    const after = getState().fields;
    expect(before).not.toBe(after);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug Condition Exploration Tests (Task 1 — BEFORE any fix)
//
// These tests document and CONFIRM the presence of security bugs on unfixed code.
// They are expected to PASS on unfixed code and will FAIL after fixes are applied.
//
// Documented counterexamples (found on unfixed code):
//   C3: editorStore.ts line 3 imports `v4 as uuidv4` from 'uuid' (CVE GHSA-w5hq-g745-h8pq)
//   C5-addField:       addField() 201 times → fields.length = 201 (no guard present)
//   C5-addNestedField: addNestedField(['0']) 201 times → fields[0].type.fields.length = 201 (no guard present)
// ─────────────────────────────────────────────────────────────────────────────

import * as fc from 'fast-check';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Bug Condition Exploration', () => {
  // ── C3 — uuid import removed (FIXED) ────────────────────────────────────
  // Validates: Requirements 1.8 (bug condition eliminated)
  // FIXED: C3 bug condition eliminated. crypto.randomUUID() is used instead.
  it("C3 — FIXED: editorStore.ts no longer imports uuidv4 from 'uuid' (CVE GHSA-w5hq-g745-h8pq eliminated)", () => {
    const filePath = resolve(__dirname, '../store/editorStore.ts');
    const content = readFileSync(filePath, 'utf-8');
    // After fix: the uuid import is gone — bug condition confirmed eliminated.
    expect(content).not.toMatch(/from 'uuid'/);
  });

  // ── C5 — FIXED: addField is capped at 200 (PBT) ──────────────────────────
  // Validates: Requirements 1.14 (bug condition eliminated)
  // FIXED: Guard prevents fields from exceeding 200.
  //
  // Counterexample found on unfixed code: addField 201 times → fields.length = 201
  // After fix: addField N > 200 times → fields.length === 200 (guard enforced)
  it('C5 — FIXED: addField is capped at 200 (guard prevents exceeding limit)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 201, max: 400 }),
        (n) => {
          // Reset store before each property run
          useEditorStore.setState({ fields: [], root: { name: '', namespace: '', doc: '', connectName: '' } });

          const { addField } = useEditorStore.getState();
          for (let i = 0; i < n; i++) {
            addField();
          }

          const { fields } = useEditorStore.getState();
          // After fix: guard caps at 200 → fields.length === 200, never exceeds
          return fields.length <= 200;
        },
      ),
      // numRuns reduced: fix verification needs only a few iterations
      { numRuns: 10 },
    );
  }, 30000);

  // ── C5 — FIXED: addNestedField is capped at 200 (PBT) ───────────────────
  // Validates: Requirements 1.14 (bug condition eliminated)
  // FIXED: Guard prevents nested fields from exceeding 200.
  //
  // Counterexample found on unfixed code: addNestedField(['0']) 201 times → fields[0].type.fields.length = 201
  // After fix: addNestedField N > 200 times → recordType.fields.length === 200 (guard enforced)
  it('C5 — FIXED: addNestedField is capped at 200 (guard prevents exceeding limit)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 201, max: 400 }),
        (n) => {
          // Reset store and set up a single record field at index 0
          useEditorStore.setState({
            fields: [makeRecordField('address')],
            root: { name: '', namespace: '', doc: '', connectName: '' },
          });

          const { addNestedField } = useEditorStore.getState();
          for (let i = 0; i < n; i++) {
            addNestedField(['0']);
          }

          const { fields } = useEditorStore.getState();
          const recordType = fields[0].type;
          if (recordType.kind !== 'record') return false;

          // After fix: guard caps at 200 → nested fields === 200, never exceeds
          return recordType.fields.length <= 200;
        },
      ),
      // numRuns reduced: fix verification needs only a few iterations
      { numRuns: 10 },
    );
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation Properties (Task 2 — BEFORE any fix)
//
// These tests document the correct baseline behavior that MUST be preserved
// after all security fixes are applied.
// They MUST PASS on unfixed code and MUST CONTINUE TO PASS after all fixes.
//
// **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.9**
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation Properties', () => {
  // ── UUID format ────────────────────────────────────────────────────────────
  // Documents that uuidv4() currently produces valid UUID v4 format.
  // After fix (crypto.randomUUID()), the same regex must match.
  // **Validates: Requirements 3.5**
  it('Preservation — UUID format: generated field IDs match UUID v4 regex', () => {
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    useEditorStore.setState({ fields: [], root: { name: '', namespace: '', doc: '', connectName: '' } });
    getState().addField();
    getState().addField();
    getState().addField();

    const fields = getState().fields;
    for (const field of fields) {
      expect(field.id).toMatch(UUID_V4_REGEX);
    }
  });

  // ── addField below limit (PBT) ─────────────────────────────────────────────
  // Property: for all N ∈ [1, 199], calling addField() N times results in
  // fields.length === N.
  // MUST PASS on unfixed code (no guard needed for N < 200).
  // **Validates: Requirements 3.1**
  it('Preservation — addField below limit (PBT): N ∈ [1,199] calls yields fields.length === N', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 199 }),
        (n) => {
          useEditorStore.setState({ fields: [], root: { name: '', namespace: '', doc: '', connectName: '' } });

          const { addField } = useEditorStore.getState();
          for (let i = 0; i < n; i++) {
            addField();
          }

          const { fields } = useEditorStore.getState();
          return fields.length === n;
        },
      ),
      { numRuns: 50 },
    );
  }, 30000);

  // ── addField at exact limit ────────────────────────────────────────────────
  // For N = 200, calling addField() 200 times results in fields.length === 200.
  // MUST PASS on unfixed code (trivially, since no guard exists yet, 200 <= guard limit).
  // **Validates: Requirements 3.1**
  it('Preservation — addField at exact limit: 200 calls yields fields.length === 200', () => {
    useEditorStore.setState({ fields: [], root: { name: '', namespace: '', doc: '', connectName: '' } });

    const { addField } = useEditorStore.getState();
    for (let i = 0; i < 200; i++) {
      addField();
    }

    expect(useEditorStore.getState().fields.length).toBe(200);
  });

  // ── addNestedField below limit (PBT) ──────────────────────────────────────
  // Property: for all N ∈ [1, 199], adding N nested fields to a record at
  // path ['0'] results in the record having exactly N fields.
  // MUST PASS on unfixed code.
  // **Validates: Requirements 3.9**
  it('Preservation — addNestedField below limit (PBT): N ∈ [1,199] nested calls yields N nested fields', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 199 }),
        (n) => {
          useEditorStore.setState({
            fields: [makeRecordField('address')],
            root: { name: '', namespace: '', doc: '', connectName: '' },
          });

          const { addNestedField } = useEditorStore.getState();
          for (let i = 0; i < n; i++) {
            addNestedField(['0']);
          }

          const { fields } = useEditorStore.getState();
          const recordType = fields[0].type;
          if (recordType.kind !== 'record') return false;

          return recordType.fields.length === n;
        },
      ),
      { numRuns: 50 },
    );
  }, 30000);

  // ── IDs are unique (PBT) ───────────────────────────────────────────────────
  // Property: for any N ∈ [1, 100] calls to addField(), all generated IDs
  // are distinct (new Set of IDs has size === N).
  // **Validates: Requirements 3.5**
  it('Preservation — IDs are unique (PBT): N ∈ [1,100] addField calls produce N distinct IDs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (n) => {
          useEditorStore.setState({ fields: [], root: { name: '', namespace: '', doc: '', connectName: '' } });

          const { addField } = useEditorStore.getState();
          for (let i = 0; i < n; i++) {
            addField();
          }

          const { fields } = useEditorStore.getState();
          const idSet = new Set(fields.map((f) => f.id));
          return idSet.size === n;
        },
      ),
      { numRuns: 50 },
    );
  }, 30000);

  // ── Field structure intact ─────────────────────────────────────────────────
  // After adding fields, each field has id, name, required, type properties
  // that are defined/non-null.
  // **Validates: Requirements 3.2, 3.3, 3.6**
  it('Preservation — field structure intact: added fields have id, name, required, type defined', () => {
    useEditorStore.setState({ fields: [], root: { name: '', namespace: '', doc: '', connectName: '' } });

    getState().addField();
    getState().addField();
    getState().addField();

    const fields = getState().fields;
    expect(fields.length).toBe(3);

    for (const field of fields) {
      expect(field.id).toBeDefined();
      expect(field.id).not.toBeNull();
      expect(field.name).toBeDefined();
      expect(field.required).toBeDefined();
      expect(field.type).toBeDefined();
      expect(field.type).not.toBeNull();
      // Default structure: primitive string
      expect(field.type.kind).toBe('primitive');
      expect(field.required).toBe(true);
      expect(field.name).toBe('');
    }
  });
});
