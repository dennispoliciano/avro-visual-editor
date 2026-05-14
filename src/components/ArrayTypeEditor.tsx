import { useEditorStore } from '../store/editorStore';
import type { ArrayTypeNode, AvroTypeNode, FieldPath, SelectableType } from '../types/avro';
import { defaultTypeNode } from '../types/avro';
import { TypeEditor } from './TypeEditor';

interface ArrayTypeEditorProps {
  type: ArrayTypeNode;
  fieldPath: FieldPath;
  /** When provided, called instead of writing to the store directly. */
  onTypeChange?: (updated: AvroTypeNode) => void;
}

const TYPE_OPTIONS: SelectableType[] = [
  'string', 'int', 'long', 'float', 'double', 'boolean',
  'record', 'enum', 'array', 'date', 'timestamp-millis',
];

export function ArrayTypeEditor({ type, fieldPath, onTypeChange }: ArrayTypeEditorProps) {
  const updateNestedFieldType = useEditorStore((s) => s.updateNestedFieldType);
  const updateFieldType = useEditorStore((s) => s.updateFieldType);
  const fields = useEditorStore((s) => s.fields);

  /** Write the updated ArrayTypeNode to the store (or delegate to parent). */
  function applyArrayUpdate(updated: ArrayTypeNode) {
    if (onTypeChange) {
      onTypeChange(updated);
      return;
    }
    if (fieldPath.length === 1) {
      const field = fields[parseInt(fieldPath[0], 10)];
      if (field) updateFieldType(field.id, updated);
    } else {
      updateNestedFieldType(fieldPath, updated);
    }
  }

  /** Called when the item type selector changes — replaces items with a fresh default. */
  function handleItemTypeChange(selectable: SelectableType) {
    applyArrayUpdate({ ...type, items: defaultTypeNode(selectable) });
  }

  /**
   * Called by the sub-editor (RecordTypeEditor / EnumTypeEditor / ArrayTypeEditor)
   * when the items node itself changes (e.g. record name typed, symbol added).
   * We wrap the updated items back into the array and write to the store.
   */
  function handleItemsChange(updatedItems: AvroTypeNode) {
    applyArrayUpdate({ ...type, items: updatedItems });
  }

  function currentItemsKind(): string {
    const items = type.items;
    if (items.kind === 'primitive') return items.type;
    if (items.kind === 'logical') return items.logicalType;
    return items.kind;
  }

  return (
    <div className="field-indent mt-1.5">
      <div className="flex flex-col gap-0.5 mb-2">
        <label className="field-label">item type</label>
        <select
          className="select-sm"
          style={{ width: 180 }}
          value={currentItemsKind()}
          onChange={(e) => handleItemTypeChange(e.target.value as SelectableType)}
          data-testid={`array-item-type-${fieldPath.join('-')}`}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* Pass handleItemsChange so sub-editors update items, not the whole field */}
      <TypeEditor
        type={type.items}
        fieldPath={fieldPath}
        expanded={true}
        onTypeChange={handleItemsChange}
      />
    </div>
  );
}
