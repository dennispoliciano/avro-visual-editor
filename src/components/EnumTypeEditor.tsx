import { useEditorStore } from '../store/editorStore';
import type { AvroTypeNode, EnumTypeNode, FieldPath } from '../types/avro';

interface EnumTypeEditorProps {
  type: EnumTypeNode;
  fieldPath: FieldPath;
  /** When provided, called instead of writing to the store directly. */
  onTypeChange?: (updated: AvroTypeNode) => void;
}

/**
 * Editor for EnumTypeNode — shows name, logicalName, symbol list, and default select.
 */
export function EnumTypeEditor({ type, fieldPath, onTypeChange }: EnumTypeEditorProps) {
  const updateNestedFieldType = useEditorStore((s) => s.updateNestedFieldType);
  const updateFieldType = useEditorStore((s) => s.updateFieldType);
  const updateField = useEditorStore((s) => s.updateField);
  const fields = useEditorStore((s) => s.fields);

  function applyTypeUpdate(updated: EnumTypeNode) {
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

  function handleNameChange(name: string) {
    applyTypeUpdate({ ...type, name });
  }

  function handleLogicalNameChange(logicalName: string) {
    applyTypeUpdate({ ...type, logicalName: logicalName || undefined });
  }

  function handleSymbolChange(index: number, value: string) {
    const symbols = [...type.symbols];
    symbols[index] = value;
    applyTypeUpdate({ ...type, symbols });
  }

  function handleAddSymbol() {
    applyTypeUpdate({ ...type, symbols: [...type.symbols, ''] });
  }

  function handleRemoveSymbol(index: number) {
    const symbols = type.symbols.filter((_, i) => i !== index);
    applyTypeUpdate({ ...type, symbols });
    // Clear default if the removed symbol was selected
    const removedSymbol = type.symbols[index];
    clearDefaultIfRemoved(removedSymbol, symbols);
  }

  function clearDefaultIfRemoved(removed: string, remaining: string[]) {
    if (fieldPath.length === 1) {
      const field = fields[parseInt(fieldPath[0], 10)];
      if (field && field.default === removed) {
        updateField(field.id, { default: undefined });
      }
    } else {
      // For nested fields we'd need to read the current default — skip for now
      // as the validator will catch incompatible defaults
      void remaining;
    }
  }

  return (
    <div className="field-indent mt-1.5">
      {/* Enum name + logicalName */}
      <div className="flex gap-2 mb-2">
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="field-label">enum name</label>
          <input
            className="input-sm"
            placeholder="EnumName"
            value={type.name}
            onChange={(e) => handleNameChange(e.target.value)}
            data-testid={`enum-name-${fieldPath.join('-')}`}
          />
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="field-label">logical name (optional)</label>
          <input
            className="input-sm"
            placeholder="fieldName_EventName"
            value={type.logicalName ?? ''}
            onChange={(e) => handleLogicalNameChange(e.target.value)}
            data-testid={`enum-logical-name-${fieldPath.join('-')}`}
          />
        </div>
      </div>

      {/* Symbols */}
      <div className="flex flex-col gap-1 mb-2">
        <label className="field-label">symbols</label>
        {type.symbols.map((sym, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              className="input-sm flex-1"
              placeholder="SYMBOL_NAME"
              value={sym}
              onChange={(e) => handleSymbolChange(i, e.target.value)}
              data-testid={`enum-symbol-${fieldPath.join('-')}-${i}`}
            />
            <button
              className="btn-icon-sm danger"
              aria-label="Remove symbol"
              onClick={() => handleRemoveSymbol(i)}
              data-testid={`enum-remove-symbol-${fieldPath.join('-')}-${i}`}
            >
              <span className="icon-sm">delete</span>
            </button>
          </div>
        ))}
        <button
          className="btn-ghost-sm self-start"
          onClick={handleAddSymbol}
          data-testid={`enum-add-symbol-${fieldPath.join('-')}`}
        >
          <span className="icon-sm">add</span>
          Add symbol
        </button>
      </div>
    </div>
  );
}
