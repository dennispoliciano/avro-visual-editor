import type { AvroFieldNode, AvroTypeNode } from '../types/avro';

interface DefaultInputProps {
  field: AvroFieldNode;
  onChange: (value: unknown) => void;
  /** When true, the control is rendered but disabled (nullable is on). */
  disabled?: boolean;
}

export function DefaultInput({ field, onChange, disabled = false }: DefaultInputProps) {
  const type = field.type;
  const value = field.default;

  return renderControl(type, value, onChange, field.id, disabled);
}

function renderControl(
  type: AvroTypeNode,
  value: unknown,
  onChange: (v: unknown) => void,
  fieldId: string,
  disabled: boolean,
): React.ReactElement | null {
  switch (type.kind) {
    case 'primitive':
      switch (type.type) {
        case 'boolean':
          return (
            <select
              className="select-sm"
              style={{ width: 120 }}
              value={value === true ? 'true' : value === false ? 'false' : ''}
              onChange={(e) => onChange(e.target.value === 'true')}
              disabled={disabled}
              data-testid={`default-boolean-${fieldId}`}
            >
              <option value="">—</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          );

        case 'int':
        case 'long':
          return (
            <input
              type="number"
              step="1"
              className="input-sm"
              style={{ width: 120 }}
              value={value !== undefined ? String(value) : ''}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onChange(isNaN(n) ? undefined : n);
              }}
              placeholder="0"
              disabled={disabled}
              data-testid={`default-int-${fieldId}`}
            />
          );

        case 'float':
        case 'double':
          return (
            <input
              type="number"
              className="input-sm"
              style={{ width: 120 }}
              value={value !== undefined ? String(value) : ''}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                onChange(isNaN(n) ? undefined : n);
              }}
              placeholder="0.0"
              disabled={disabled}
              data-testid={`default-float-${fieldId}`}
            />
          );

        case 'string':
          return (
            <input
              type="text"
              className="input-sm"
              style={{ width: 120 }}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="default"
              disabled={disabled}
              data-testid={`default-string-${fieldId}`}
            />
          );

        case 'null':
          return null;
      }
      break;

    case 'enum':
      return (
        <select
          className="select-sm"
          style={{ width: 120 }}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          disabled={disabled}
          data-testid={`default-enum-${fieldId}`}
        >
          <option value="">—</option>
          {type.symbols.map((sym) => (
            <option key={sym} value={sym}>{sym}</option>
          ))}
        </select>
      );

    case 'logical':
    case 'record':
    case 'array':
      // Show a disabled placeholder for complex types
      return (
        <input
          type="text"
          className="input-sm"
          style={{ width: 120 }}
          value=""
          placeholder="—"
          disabled
          readOnly
          data-testid={`default-complex-${fieldId}`}
        />
      );
  }

  return null;
}
