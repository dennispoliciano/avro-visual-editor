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
