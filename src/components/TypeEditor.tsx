import type { AvroTypeNode, FieldPath } from '../types/avro';
import { RecordTypeEditor } from './RecordTypeEditor';
import { EnumTypeEditor } from './EnumTypeEditor';
import { ArrayTypeEditor } from './ArrayTypeEditor';

interface TypeEditorProps {
  type: AvroTypeNode;
  /** Path to the field that owns this type (used for nested store actions). */
  fieldPath: FieldPath;
  /** Whether this editor is expanded (controlled by parent FieldEditor). */
  expanded?: boolean;
  /**
   * When provided, the sub-editor calls this instead of writing to the store
   * directly. Used by ArrayTypeEditor to update only the items node without
   * replacing the whole field type.
   */
  onTypeChange?: (updated: AvroTypeNode) => void;
}

/**
 * Dispatcher — renders the type-specific editor based on AvroTypeNode.kind.
 * Primitive and logical types have no extra controls.
 */
export function TypeEditor({ type, fieldPath, expanded = true, onTypeChange }: TypeEditorProps) {
  if (!expanded) return null;

  switch (type.kind) {
    case 'primitive':
    case 'logical':
      return null;

    case 'record':
      return (
        <RecordTypeEditor
          type={type}
          fieldPath={fieldPath}
          onTypeChange={onTypeChange}
        />
      );

    case 'enum':
      return (
        <EnumTypeEditor
          type={type}
          fieldPath={fieldPath}
          onTypeChange={onTypeChange}
        />
      );

    case 'array':
      return (
        <ArrayTypeEditor
          type={type}
          fieldPath={fieldPath}
          onTypeChange={onTypeChange}
        />
      );
  }
}
