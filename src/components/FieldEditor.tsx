import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { defaultTypeNode, hasSubNodes } from '../types/avro';
import type { AvroFieldNode, FieldPath, SelectableType } from '../types/avro';
import { validateField } from '../lib/validator';
import { DefaultInput } from './DefaultInput';
import { TypeEditor } from './TypeEditor';

interface FieldEditorProps {
  field: AvroFieldNode;
  path: FieldPath;
  isFirst: boolean;
  isLast: boolean;
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

export function FieldEditor({ field, path, isFirst, isLast }: FieldEditorProps) {
  const [expanded, setExpanded] = useState(true);
  // Only show validation errors after the user has interacted with the field
  const [nameTouched, setNameTouched] = useState(false);
  const [defaultTouched, setDefaultTouched] = useState(false);

  const isRoot = path.length === 1;
  const updateField = useEditorStore((s) => s.updateField);
  const updateFieldType = useEditorStore((s) => s.updateFieldType);
  const removeField = useEditorStore((s) => s.removeField);
  const moveField = useEditorStore((s) => s.moveField);
  const updateNestedField = useEditorStore((s) => s.updateNestedField);
  const updateNestedFieldType = useEditorStore((s) => s.updateNestedFieldType);
  const removeNestedField = useEditorStore((s) => s.removeNestedField);
  const moveNestedField = useEditorStore((s) => s.moveNestedField);

  const errors = validateField(field, `fields[${path.join('][')}]`);
  const nameError = nameTouched ? errors.find((e) => e.path.endsWith('.name')) : undefined;
  const defaultError = defaultTouched ? errors.find((e) => e.path.endsWith('.default')) : undefined;

  const canExpand = hasSubNodes(field.type);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleNameChange(name: string) {
    if (isRoot) updateField(field.id, { name });
    else updateNestedField(path, { name });
  }

  function handleRequiredChange(required: boolean) {
    if (isRoot) updateField(field.id, { required, default: required ? undefined : null });
    else updateNestedField(path, { required, default: required ? undefined : null });
  }

  function handleDocChange(doc: string) {
    if (isRoot) updateField(field.id, { doc });
    else updateNestedField(path, { doc });
  }

  function handleDefaultChange(value: unknown) {
    setDefaultTouched(true);
    if (isRoot) updateField(field.id, { default: value });
    else updateNestedField(path, { default: value });
  }

  function handleTypeChange(selectable: SelectableType) {
    const newType = defaultTypeNode(selectable);
    if (isRoot) updateFieldType(field.id, newType);
    else updateNestedFieldType(path, newType);
    // Reset touched state when type changes — new type, fresh start
    setDefaultTouched(false);
  }

  function handleRemove() {
    if (isRoot) removeField(field.id);
    else removeNestedField(path);
  }

  function handleMoveUp() {
    if (isRoot) moveField(field.id, 'up');
    else moveNestedField(path, 'up');
  }

  function handleMoveDown() {
    if (isRoot) moveField(field.id, 'down');
    else moveNestedField(path, 'down');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col"
      style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginBottom: 4 }}
      data-testid={`field-editor-${field.id}`}
    >
      {/* ── Base row — all items aligned to center, errors don't shift the row ── */}
      <div className="flex items-start gap-1.5 py-1">

        {/* Expand/collapse */}
        {canExpand ? (
          <div className="flex flex-col items-center" style={{ paddingTop: 16 }}>
            <button
              className="btn-icon-sm"
              aria-label={expanded ? 'Collapse' : 'Expand'}
              onClick={() => setExpanded((v) => !v)}
              data-testid={`field-expand-${field.id}`}
            >
              <span className="icon-sm">{expanded ? 'expand_less' : 'expand_more'}</span>
            </button>
          </div>
        ) : (
          <div style={{ width: 24, flexShrink: 0, paddingTop: 16 }} />
        )}

        {/* Name */}
        <div className="flex flex-col gap-0.5" style={{ flex: 1 }}>
          <label className="field-label">name</label>
          <div style={{ position: 'relative' }}>
            <input
              className={`input-sm w-full${nameError ? ' has-error' : ''}`}
              placeholder="fieldName"
              value={field.name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => setNameTouched(true)}
              data-testid={`field-name-${field.id}`}
              maxLength={128}
            />
            {nameError && (
              <span
                className="text-error"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  background: 'var(--color-surface)',
                  padding: '1px 4px',
                  borderRadius: 3,
                  boxShadow: 'var(--shadow-sm)',
                  pointerEvents: 'none',
                }}
              >
                {nameError.message}
              </span>
            )}
          </div>
        </div>

        {/* Type selector */}
        <div className="flex flex-col gap-0.5" style={{ width: 160, flexShrink: 0 }}>
          <label className="field-label">type</label>
          <select
            className="select-sm"
            value={typeNodeToSelectable(field)}
            onChange={(e) => handleTypeChange(e.target.value as SelectableType)}
            data-testid={`field-type-${field.id}`}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Nullable toggle */}
        <div className="flex flex-col gap-0.5 items-center" style={{ flexShrink: 0, minWidth: 52 }}>
          <label className="field-label" htmlFor={`nullable-${field.id}`}>nullable</label>
          <label className="toggle-switch" title={!field.required ? 'Nullable — default is null' : 'Not nullable'}>
            <input
              id={`nullable-${field.id}`}
              type="checkbox"
              checked={!field.required}
              onChange={(e) => handleRequiredChange(!e.target.checked)}
              data-testid={`field-required-${field.id}`}
            />
            <span className="toggle-track" />
          </label>
        </div>

        {/* Default input — always visible, disabled when nullable */}
        <div className="flex flex-col gap-0.5" style={{ width: 120, flexShrink: 0 }}>
          <label className="field-label">default</label>
          <div style={{ position: 'relative' }}>
            <DefaultInput
              field={field}
              onChange={handleDefaultChange}
              disabled={!field.required}
            />
            {defaultError && (
              <span
                className="text-error"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  background: 'var(--color-surface)',
                  padding: '1px 4px',
                  borderRadius: 3,
                  boxShadow: 'var(--shadow-sm)',
                  pointerEvents: 'none',
                }}
              >
                {defaultError.message}
              </span>
            )}
          </div>
        </div>

        {/* Doc */}
        <div className="flex flex-col gap-0.5" style={{ flex: 1 }}>
          <label className="field-label">doc</label>
          <input
            className="input-sm"
            placeholder="description"
            value={field.doc ?? ''}
            onChange={(e) => handleDocChange(e.target.value)}
            data-testid={`field-doc-${field.id}`}
            maxLength={1024}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-0.5 items-center" style={{ flexShrink: 0 }}>
          <label className="field-label" style={{ visibility: 'hidden' }}>·</label>
          <div className="flex items-center gap-0.5">
            <button
              className="btn-icon-sm"
              aria-label="Move up"
              disabled={isFirst}
              onClick={handleMoveUp}
              data-testid={`field-move-up-${field.id}`}
            >
              <span className="icon-sm">arrow_upward</span>
            </button>
            <button
              className="btn-icon-sm"
              aria-label="Move down"
              disabled={isLast}
              onClick={handleMoveDown}
              data-testid={`field-move-down-${field.id}`}
            >
              <span className="icon-sm">arrow_downward</span>
            </button>
            <button
              className="btn-icon-sm danger"
              aria-label="Remove field"
              onClick={handleRemove}
              data-testid={`field-remove-${field.id}`}
            >
              <span className="icon-sm">delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Type-specific editor ── */}
      {canExpand && (
        <TypeEditor type={field.type} fieldPath={path} expanded={expanded} />
      )}
    </div>
  );
}
