import { useEditorStore } from '../store/editorStore';
import type { AvroFieldNode, FieldPath } from '../types/avro';
import { FieldEditor } from './FieldEditor';

interface FieldListProps {
  /** The fields to render. For root level, pass store fields. For nested, pass record.fields. */
  fields: AvroFieldNode[];
  /**
   * Path to the parent record field.
   * - Root level: undefined (uses root store actions)
   * - Nested: path to the parent record field (e.g. ["0"] for root fields[0])
   */
  parentPath?: FieldPath;
}

/**
 * Renders a list of FieldEditor components and an "Adicionar campo" button.
 *
 * For root-level fields: parentPath is undefined → uses addField()
 * For nested fields: parentPath is the path to the parent record → uses addNestedField(parentPath)
 */
export function FieldList({ fields, parentPath }: FieldListProps) {
  const addField = useEditorStore((s) => s.addField);
  const addNestedField = useEditorStore((s) => s.addNestedField);

  const isRoot = parentPath === undefined;

  function handleAddField() {
    if (isRoot) {
      addField();
    } else {
      addNestedField(parentPath!);
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Section title — only at root level */}
      {isRoot && (
        <span
          className="font-semibold mb-2"
          style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-on-surface)' }}
        >
          Schema Fields
        </span>
      )}
      {fields.map((field, index) => {
        // Build the path for this field
        const fieldPath: FieldPath = isRoot
          ? [String(index)]
          : [...parentPath!, String(index)];

        return (
          <FieldEditor
            key={field.id}
            field={field}
            path={fieldPath}
            isFirst={index === 0}
            isLast={index === fields.length - 1}
          />
        );
      })}

      <button
        className="btn-primary-sm self-start mt-2"
        onClick={handleAddField}
        data-testid={isRoot ? 'add-field-root' : `add-field-nested-${parentPath!.join('-')}`}
      >
        <span className="icon-sm">add</span>
        Add field
      </button>
    </div>
  );
}
