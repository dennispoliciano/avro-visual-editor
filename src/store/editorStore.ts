import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type {
  AvroFieldNode,
  AvroTypeNode,
  EditorState,
  FieldPath,
  RootSchema,
} from '../types/avro';
// SchemaType is used via RootSchema — no separate import needed
import { defaultTypeNode } from '../types/avro';

// ─────────────────────────────────────────────────────────────────────────────
// Default field factory
// ─────────────────────────────────────────────────────────────────────────────

function createDefaultField(): AvroFieldNode {
  return {
    id: uuidv4(),
    name: '',
    required: true,
    type: { kind: 'primitive', type: 'string' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldPath resolver
//
// A FieldPath is an array of string segments that locates a field in the tree.
//
// The path locates the *parent* fields array and the *index* of the target field.
//
// Segments:
//   - First segment: index into the root fields array (e.g. "0")
//   - Subsequent segments: index into a nested record's fields array
//     (the parent is always a RecordTypeNode reached via field.type)
//
// Example paths:
//   ["2"]        → root fields[2]
//   ["0", "1"]   → root fields[0].type.fields[1]  (field 0 must be a record)
//   ["0", "1", "2"] → root fields[0].type.fields[1].type.fields[2]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves a FieldPath to the parent fields array and the target index.
 * Returns null if the path is invalid.
 */
function resolvePath(
  rootFields: AvroFieldNode[],
  path: FieldPath,
): { parentFields: AvroFieldNode[]; index: number } | null {
  if (path.length === 0) return null;

  let currentFields = rootFields;

  for (let i = 0; i < path.length - 1; i++) {
    const idx = parseInt(path[i], 10);
    if (isNaN(idx) || idx < 0 || idx >= currentFields.length) return null;

    const field = currentFields[idx];
    if (field.type.kind !== 'record') return null;
    currentFields = field.type.fields;
  }

  const lastIdx = parseInt(path[path.length - 1], 10);
  if (isNaN(lastIdx) || lastIdx < 0 || lastIdx >= currentFields.length) return null;

  return { parentFields: currentFields, index: lastIdx };
}

// ─────────────────────────────────────────────────────────────────────────────
// Store interface
// ─────────────────────────────────────────────────────────────────────────────

export interface EditorStore extends EditorState {
  // ── Root ──────────────────────────────────────────────────────────────────
  updateRoot: (patch: Partial<RootSchema>) => void;

  // ── Touched state (suppress premature validation errors) ──────────────────
  /** True once the user has blurred the root name field at least once. */
  rootNameTouched: boolean;
  setRootNameTouched: () => void;

  // ── Root-level fields ─────────────────────────────────────────────────────
  addField: () => void;
  removeField: (id: string) => void;
  moveField: (id: string, direction: 'up' | 'down') => void;
  updateField: (id: string, patch: Partial<Omit<AvroFieldNode, 'id' | 'type'>>) => void;
  updateFieldType: (id: string, newType: AvroTypeNode) => void;

  // ── Nested fields (path-based) ────────────────────────────────────────────
  addNestedField: (path: FieldPath) => void;
  removeNestedField: (path: FieldPath) => void;
  moveNestedField: (path: FieldPath, direction: 'up' | 'down') => void;
  updateNestedField: (path: FieldPath, patch: Partial<Omit<AvroFieldNode, 'id' | 'type'>>) => void;
  updateNestedFieldType: (path: FieldPath, newType: AvroTypeNode) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────

const initialState: EditorState = {
  root: {
    name: '',
    namespace: '',
    doc: '',
    connectName: '',
    schemaType: 'None',
  },
  fields: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorStore>()(
  immer((set) => ({
    ...initialState,
    rootNameTouched: false,

    setRootNameTouched: () =>
      set(() => ({ rootNameTouched: true })),

    // ── Root ────────────────────────────────────────────────────────────────

    updateRoot: (patch) =>
      set((state) => {
        Object.assign(state.root, patch);
      }),

    // ── Root-level fields ───────────────────────────────────────────────────

    addField: () =>
      set((state) => {
        state.fields.push(createDefaultField());
      }),

    removeField: (id) =>
      set((state) => {
        const idx = state.fields.findIndex((f) => f.id === id);
        if (idx !== -1) state.fields.splice(idx, 1);
      }),

    moveField: (id, direction) =>
      set((state) => {
        const idx = state.fields.findIndex((f) => f.id === id);
        if (idx === -1) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= state.fields.length) return;
        const [field] = state.fields.splice(idx, 1);
        state.fields.splice(targetIdx, 0, field);
      }),

    updateField: (id, patch) =>
      set((state) => {
        const field = state.fields.find((f) => f.id === id);
        if (field) Object.assign(field, patch);
      }),

    updateFieldType: (id, newType) =>
      set((state) => {
        const field = state.fields.find((f) => f.id === id);
        if (field) {
          field.type = newType;
          // Destroy default when type changes (incompatible defaults)
          field.default = undefined;
        }
      }),

    // ── Nested fields ────────────────────────────────────────────────────────

    addNestedField: (path) =>
      set((state) => {
        // path points to the parent record field; we add to its type.fields
        if (path.length === 0) return;

        let currentFields = state.fields;
        for (const segment of path) {
          const idx = parseInt(segment, 10);
          if (isNaN(idx) || idx < 0 || idx >= currentFields.length) return;
          const field = currentFields[idx];
          if (field.type.kind !== 'record') return;
          currentFields = field.type.fields;
        }
        currentFields.push(createDefaultField());
      }),

    removeNestedField: (path) =>
      set((state) => {
        const resolved = resolvePath(state.fields, path);
        if (!resolved) return;
        resolved.parentFields.splice(resolved.index, 1);
      }),

    moveNestedField: (path, direction) =>
      set((state) => {
        const resolved = resolvePath(state.fields, path);
        if (!resolved) return;
        const { parentFields, index } = resolved;
        const targetIdx = direction === 'up' ? index - 1 : index + 1;
        if (targetIdx < 0 || targetIdx >= parentFields.length) return;
        const [field] = parentFields.splice(index, 1);
        parentFields.splice(targetIdx, 0, field);
      }),

    updateNestedField: (path, patch) =>
      set((state) => {
        const resolved = resolvePath(state.fields, path);
        if (!resolved) return;
        Object.assign(resolved.parentFields[resolved.index], patch);
      }),

    updateNestedFieldType: (path, newType) =>
      set((state) => {
        const resolved = resolvePath(state.fields, path);
        if (!resolved) return;
        const field = resolved.parentFields[resolved.index];
        field.type = newType;
        field.default = undefined;
      }),
  })),
);

// ─────────────────────────────────────────────────────────────────────────────
// Selector helpers (memoization-friendly)
// ─────────────────────────────────────────────────────────────────────────────

export const selectRoot = (s: EditorStore) => s.root;
export const selectFields = (s: EditorStore) => s.fields;

// Convenience: derive the effective namespace (falls back to DEFAULT_NAMESPACE)
export { defaultTypeNode };
