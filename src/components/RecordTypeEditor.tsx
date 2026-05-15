import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { defaultTypeNode, hasSubNodes } from '../types/avro';
import type { AvroFieldNode, AvroTypeNode, FieldPath, RecordTypeNode, SelectableType } from '../types/avro';
import { DefaultInput } from './DefaultInput';
import { FieldList } from './FieldList';
import { TypeEditor } from './TypeEditor';

interface RecordTypeEditorProps {
  type: RecordTypeNode;
  fieldPath: FieldPath;
  /** When provided, called instead of writing to the store directly. */
  onTypeChange?: (updated: AvroTypeNode) => void;
}

export function RecordTypeEditor({ type, fieldPath, onTypeChange }: RecordTypeEditorProps) {
  const updateNestedFieldType = useEditorStore((s) => s.updateNestedFieldType);
  const updateFieldType = useEditorStore((s) => s.updateFieldType);
  const fields = useEditorStore((s) => s.fields);

  function applyTypeUpdate(updated: RecordTypeNode) {
    if (onTypeChange) {
      // Delegate to parent (e.g. ArrayTypeEditor updating its items)
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

  return (
    <div className="field-indent mt-1.5">
      <div className="flex gap-2 mb-2">
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="field-label">record name</label>
          <input
            className="input-sm"
            placeholder="RecordName"
            value={type.name}
            onChange={(e) => handleNameChange(e.target.value)}
            data-testid={`record-name-${fieldPath.join('-')}`}
            maxLength={128}
          />
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="field-label">logical name (optional)</label>
          <input
            className="input-sm"
            placeholder="fieldName_EventName"
            value={type.logicalName ?? ''}
            onChange={(e) => handleLogicalNameChange(e.target.value)}
            data-testid={`record-logical-name-${fieldPath.join('-')}`}
            maxLength={128}
          />
        </div>
      </div>

      {/* Nested fields — only use store-based FieldList when not inside an array context */}
      {!onTypeChange && (
        <FieldList fields={type.fields} parentPath={fieldPath} />
      )}
      {onTypeChange && (
        <FieldListInline
          type={type}
          onTypeChange={onTypeChange}
          fieldPath={fieldPath}
        />
      )}
    </div>
  );
}

/**
 * When RecordTypeEditor is inside an ArrayTypeEditor (onTypeChange is set),
 * we can't use the store-based FieldList because the record isn't a direct
 * field in the store — it's nested inside the array's items.
 * This inline version updates the record by calling onTypeChange with the
 * full updated RecordTypeNode.
 */
function FieldListInline({
  type,
  onTypeChange,
  fieldPath,
}: {
  type: RecordTypeNode;
  onTypeChange: (updated: AvroTypeNode) => void;
  fieldPath: FieldPath;
}) {

  function addField() {
    const newField = {
      id: crypto.randomUUID(),
      name: '',
      required: true,
      type: { kind: 'primitive' as const, type: 'string' as const },
    };
    onTypeChange({ ...type, fields: [...type.fields, newField] });
  }

  function removeField(id: string) {
    onTypeChange({ ...type, fields: type.fields.filter((f) => f.id !== id) });
  }

  function updateField(id: string, patch: Partial<{ name: string; required: boolean; doc: string; default: unknown }>) {
    onTypeChange({
      ...type,
      fields: type.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  }

  function updateFieldType(id: string, newType: AvroTypeNode) {
    onTypeChange({
      ...type,
      fields: type.fields.map((f) =>
        f.id === id ? { ...f, type: newType, default: undefined } : f,
      ),
    });
  }

  function moveField(id: string, direction: 'up' | 'down') {
    const idx = type.fields.findIndex((f) => f.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= type.fields.length) return;
    const newFields = [...type.fields];
    const [field] = newFields.splice(idx, 1);
    newFields.splice(targetIdx, 0, field);
    onTypeChange({ ...type, fields: newFields });
  }

  return (
    <InlineFieldList
      fields={type.fields}
      onAddField={addField}
      onRemoveField={removeField}
      onUpdateField={updateField}
      onUpdateFieldType={updateFieldType}
      onMoveField={moveField}
      fieldPath={fieldPath}
    />
  );
}

const TYPE_OPTIONS: SelectableType[] = [
  'string', 'int', 'long', 'float', 'double', 'boolean',
  'record', 'enum', 'array', 'date', 'timestamp-millis',
];

function typeNodeToSelectable(field: AvroFieldNode): SelectableType {
  const t = field.type;
  if (t.kind === 'primitive') return t.type;
  if (t.kind === 'logical') return t.logicalType;
  return t.kind as SelectableType;
}

function InlineFieldList({
  fields,
  onAddField,
  onRemoveField,
  onUpdateField,
  onUpdateFieldType,
  onMoveField,
  fieldPath,
}: {
  fields: AvroFieldNode[];
  onAddField: () => void;
  onRemoveField: (id: string) => void;
  onUpdateField: (id: string, patch: Partial<{ name: string; required: boolean; doc: string; default: unknown }>) => void;
  onUpdateFieldType: (id: string, type: AvroTypeNode) => void;
  onMoveField: (id: string, direction: 'up' | 'down') => void;
  fieldPath: FieldPath;
}) {
  return (
    <div className="flex flex-col gap-0">
      {fields.map((field, index) => (
        <InlineFieldEditor
          key={field.id}
          field={field}
          isFirst={index === 0}
          isLast={index === fields.length - 1}
          onRemove={() => onRemoveField(field.id)}
          onUpdate={(patch) => onUpdateField(field.id, patch)}
          onUpdateType={(t) => onUpdateFieldType(field.id, t)}
          onMoveUp={() => onMoveField(field.id, 'up')}
          onMoveDown={() => onMoveField(field.id, 'down')}
          fieldPath={[...fieldPath, String(index)]}
        />
      ))}
      <button
        className="btn-primary-sm self-start mt-2"
        onClick={onAddField}
        data-testid={`add-field-inline-${fieldPath.join('-')}`}
      >
        <span className="icon-sm">add</span>
        Add field
      </button>
    </div>
  );
}

function InlineFieldEditor({
  field,
  isFirst,
  isLast,
  onRemove,
  onUpdate,
  onUpdateType,
  onMoveUp,
  onMoveDown,
  fieldPath,
}: {
  field: AvroFieldNode;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onUpdate: (patch: Partial<{ name: string; required: boolean; doc: string; default: unknown }>) => void;
  onUpdateType: (type: AvroTypeNode) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  fieldPath: FieldPath;
}) {
  const [expanded, setExpanded] = useState(true);
  const [nameTouched, setNameTouched] = useState(false);
  const canExpand = hasSubNodes(field.type);

  return (
    <div
      className="flex flex-col"
      style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginBottom: 4 }}
    >
      <div className="flex items-start gap-1.5 py-1">
        {canExpand ? (
          <div className="flex flex-col items-center" style={{ paddingTop: 16 }}>
            <button
              className="btn-icon-sm"
              aria-label={expanded ? 'Collapse' : 'Expand'}
              onClick={() => setExpanded((v) => !v)}
            >
              <span className="icon-sm">{expanded ? 'expand_less' : 'expand_more'}</span>
            </button>
          </div>
        ) : (
          <div style={{ width: 24, flexShrink: 0, paddingTop: 16 }} />
        )}

        <div className="flex flex-col gap-0.5" style={{ flex: 1 }}>
          <label className="field-label">name</label>
          <div style={{ position: 'relative' }}>
            <input
              className={`input-sm w-full${nameTouched && !field.name ? ' has-error' : ''}`}
              placeholder="fieldName"
              value={field.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              onBlur={() => setNameTouched(true)}
              maxLength={128}
            />
            {nameTouched && !field.name && (
              <span className="text-error" style={{ position: 'absolute', top: '100%', left: 0, whiteSpace: 'nowrap', zIndex: 10, background: 'var(--color-surface)', padding: '1px 4px', borderRadius: 3, pointerEvents: 'none' }}>
                Field name is required.
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-0.5" style={{ width: 160, flexShrink: 0 }}>
          <label className="field-label">type</label>
          <select
            className="select-sm"
            value={typeNodeToSelectable(field)}
            onChange={(e) => onUpdateType(defaultTypeNode(e.target.value as SelectableType))}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-0.5 items-center" style={{ flexShrink: 0, minWidth: 52 }}>
          <label className="field-label">nullable</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={!field.required}
              onChange={(e) => onUpdate({ required: !e.target.checked, default: !e.target.checked ? null : undefined })}
            />
            <span className="toggle-track" />
          </label>
        </div>

        <div className="flex flex-col gap-0.5" style={{ width: 120, flexShrink: 0 }}>
          <label className="field-label">default</label>
          <DefaultInput field={field} onChange={(v) => onUpdate({ default: v })} disabled={!field.required} />
        </div>

        <div className="flex flex-col gap-0.5" style={{ flex: 1 }}>
          <label className="field-label">doc</label>
          <input
            className="input-sm"
            placeholder="description"
            value={field.doc ?? ''}
            onChange={(e) => onUpdate({ doc: e.target.value })}
            maxLength={1024}
          />
        </div>

        <div className="flex flex-col gap-0.5 items-center" style={{ flexShrink: 0 }}>
          <label className="field-label" style={{ visibility: 'hidden' }}>·</label>
          <div className="flex items-center gap-0.5">
            <button className="btn-icon-sm" aria-label="Move up" disabled={isFirst} onClick={onMoveUp}>
              <span className="icon-sm">arrow_upward</span>
            </button>
            <button className="btn-icon-sm" aria-label="Move down" disabled={isLast} onClick={onMoveDown}>
              <span className="icon-sm">arrow_downward</span>
            </button>
            <button className="btn-icon-sm danger" aria-label="Remove field" onClick={onRemove}>
              <span className="icon-sm">delete</span>
            </button>
          </div>
        </div>
      </div>

      {canExpand && expanded && (
        <TypeEditor type={field.type} fieldPath={fieldPath} expanded={true} onTypeChange={onUpdateType} />
      )}
    </div>
  );
}
