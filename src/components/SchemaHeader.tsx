import { useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { validateSchema } from '../lib/validator';
import type { SchemaType } from '../types/avro';

const SCHEMA_TYPE_OPTIONS: { value: SchemaType; label: string }[] = [
  { value: 'None',  label: '--'    },
  { value: 'Value', label: 'Value' },
  { value: 'Key',   label: 'Key'   },
];

export function SchemaHeader() {
  const root = useEditorStore((s) => s.root);
  const fields = useEditorStore((s) => s.fields);
  const updateRoot = useEditorStore((s) => s.updateRoot);
  const rootNameTouched = useEditorStore((s) => s.rootNameTouched);
  const setRootNameTouched = useEditorStore((s) => s.setRootNameTouched);

  const [connectNameTouched, setConnectNameTouched] = useState(false);

  const errors = validateSchema(root, fields);
  const nameError = rootNameTouched ? errors.find((e) => e.path === 'root.name') : undefined;

  // Derived serialized name (what will appear in the JSON "name" field)
  const suffix = (root.schemaType ?? 'None') === 'None' ? '' : root.schemaType as string;
  const serializedName = root.name ? root.name + suffix : '';

  // Auto-suggest connectName as "namespace.serializedName"
  useEffect(() => {
    if (!connectNameTouched && serializedName && root.namespace) {
      updateRoot({ connectName: `${root.namespace}.${serializedName}` });
    }
  }, [serializedName, root.namespace]);

  return (
    <div
      className="flex flex-col gap-2 pb-3 mb-3"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      {/* Title */}
      <span
        className="font-semibold"
        style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-on-surface)' }}
      >
        Schema Metadata
      </span>

      {/* Row 1: name · schema type · namespace · connect.name */}
      <div className="flex gap-2">

        {/* name */}
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="field-label" htmlFor="schema-name">name *</label>
          <div style={{ position: 'relative' }}>
            <input
              id="schema-name"
              className={`input-sm w-full${nameError ? ' has-error' : ''}`}
              placeholder="MyEvent"
              value={root.name}
              onChange={(e) => updateRoot({ name: e.target.value })}
              onBlur={() => setRootNameTouched()}
              data-testid="schema-name-input"
              maxLength={256}
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

        {/* schema type */}
        <div className="flex flex-col gap-0.5" style={{ width: 90 }}>
          <label className="field-label" htmlFor="schema-type">schema type</label>
          <select
            id="schema-type"
            className="select-sm w-full"
            value={root.schemaType ?? 'None'}
            onChange={(e) => {
              updateRoot({ schemaType: e.target.value as SchemaType });
              // Reset connectName auto-suggestion when type changes
              setConnectNameTouched(false);
            }}
            data-testid="schema-type-select"
          >
            {SCHEMA_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* namespace */}
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="field-label" htmlFor="schema-namespace">namespace</label>
          <input
            id="schema-namespace"
            className="input-sm"
            placeholder="com.example"
            value={root.namespace ?? ''}
            onChange={(e) => updateRoot({ namespace: e.target.value })}
            data-testid="schema-namespace-input"
            maxLength={256}
          />
        </div>

        {/* connect.name */}
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="field-label" htmlFor="schema-connect-name">
            connect.name
            {serializedName && root.namespace && (
              <span
                style={{
                  marginLeft: 4,
                  fontWeight: 400,
                  color: 'var(--color-on-surface-muted)',
                  fontSize: 10,
                }}
              >
                ({root.namespace}.{serializedName})
              </span>
            )}
          </label>
          <input
            id="schema-connect-name"
            className="input-sm"
            placeholder="com.example.MyEventValue"
            value={root.connectName ?? ''}
            onChange={(e) => {
              setConnectNameTouched(true);
              updateRoot({ connectName: e.target.value });
            }}
            data-testid="schema-connect-name-input"
            maxLength={256}
          />
        </div>
      </div>

      {/* Row 2: doc — full width */}
      <div className="flex flex-col gap-0.5">
        <label className="field-label" htmlFor="schema-doc">doc</label>
        <input
          id="schema-doc"
          className="input-sm"
          placeholder="Event description"
          value={root.doc ?? ''}
          onChange={(e) => updateRoot({ doc: e.target.value })}
          data-testid="schema-doc-input"
          maxLength={1024}
        />
      </div>
    </div>
  );
}
