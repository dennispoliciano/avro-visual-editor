import { useMemo, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useEditorStore } from '../store/editorStore';
import { serializeSchema } from '../lib/serializer';
import { validateSchema } from '../lib/validator';
import { DEFAULT_NAMESPACE } from '../lib/constants';

export function PreviewPanel() {
  const root = useEditorStore((s) => s.root);
  const fields = useEditorStore((s) => s.fields);

  const [copied, setCopied] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  const rootNameTouched = useEditorStore((s) => s.rootNameTouched);

  const json = useMemo(() => {
    // Use placeholder values for preview when fields are empty,
    // so the preview always shows a valid-looking schema.
    const previewRoot = {
      ...root,
      name: root.name || 'MyEvent',
      namespace: root.namespace || DEFAULT_NAMESPACE,
    };
    const suffix = (previewRoot.schemaType ?? 'None') === 'None' ? '' : previewRoot.schemaType as string;
    const serializedName = previewRoot.name + suffix;
    previewRoot.connectName =
      root.connectName ||
      `${previewRoot.namespace}.${serializedName}`;
    return JSON.stringify(serializeSchema(previewRoot, fields), null, 2);
  }, [root, fields]);

  const allErrors = useMemo(() => validateSchema(root, fields), [root, fields]);
  // Suppress root.name error until the user has interacted with that field
  const errors = useMemo(
    () => rootNameTouched
      ? allErrors
      : allErrors.filter((e) => e.path !== 'root.name'),
    [allErrors, rootNameTouched],
  );
  const hasErrors = errors.length > 0;

  // Collapse error list when errors are resolved
  if (!hasErrors && errorsExpanded) setErrorsExpanded(false);

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleExport() {
    // Build filename: schema-{event-name-in-kebab-case}-{schema-type-lowercase}.avsc
    // e.g. root.name = "ProgramEnrollmentCreated", schemaType = "Value"
    //   → schema-program-enrollment-created-value.avsc
    const eventKebab = (root.name || 'schema')
      // Insert hyphen before each uppercase letter that follows a lowercase letter or digit
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      // Insert hyphen between consecutive uppercase letters followed by lowercase (e.g. "XMLParser" → "XML-Parser")
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();

    const typePart = (root.schemaType == null || root.schemaType === 'None') ? '' : `-${root.schemaType.toLowerCase()}`;
    const filename = `schema-${eventKebab}${typePart}.avsc`;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full gap-2" data-testid="preview-panel">
      {/* Header row */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="font-semibold flex-1"
          style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-on-surface)' }}
        >
          Value Schema
        </span>

        {/* Clickable error badge — toggles error list */}
        {hasErrors && (
          <button
            className="badge-error"
            style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
            onClick={() => setErrorsExpanded((v) => !v)}
            title="Click to see validation errors"
            data-testid="preview-error-badge"
          >
            {errors.length}
          </button>
        )}

        {/* Copy button */}
        <button
          className="btn-secondary-sm"
          onClick={handleCopy}
          data-testid="preview-copy-btn"
        >
          <span className="icon-sm">content_copy</span>
          {copied ? 'Copied!' : 'Copy'}
        </button>

        {/* Export button */}
        <button
          className="btn-primary-sm"
          onClick={handleExport}
          disabled={hasErrors}
          data-testid="preview-export-btn"
        >
          <span className="icon-sm">download</span>
          Export
        </button>
      </div>

      {/* Collapsible error panel */}
      {hasErrors && (
        <div
          className="rounded"
          style={{
            border: '1px solid var(--color-error)',
            background: 'var(--color-error-light)',
            overflow: 'hidden',
          }}
          data-testid="preview-error-panel"
        >
          {/* Summary row — always visible, click to expand */}
          <button
            className="flex items-center gap-2 w-full px-3 py-2"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
            onClick={() => setErrorsExpanded((v) => !v)}
            data-testid="preview-error-toggle"
          >
            <span className="icon-sm" style={{ color: 'var(--color-error)', flexShrink: 0 }}>
              error
            </span>
            <span
              className="flex-1"
              style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', fontWeight: 500 }}
            >
              {errors.length} validation error{errors.length > 1 ? 's' : ''} — fix before exporting
            </span>
            <span className="icon-sm" style={{ color: 'var(--color-error)', flexShrink: 0 }}>
              {errorsExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Error list — shown when expanded */}
          {errorsExpanded && (
            <ul
              style={{
                margin: 0,
                padding: '0 12px 10px 12px',
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                borderTop: '1px solid rgba(211,47,47,0.2)',
              }}
              data-testid="preview-error-list"
            >
              {errors.map((err, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    paddingTop: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-error)',
                      fontWeight: 500,
                    }}
                  >
                    {err.message}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--color-on-surface-muted)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {err.path}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* JSON preview — read-only */}
      <div
        className="flex-1 overflow-auto rounded"
        style={{ fontSize: 13, minHeight: 0 }}
        data-testid="preview-json"
      >
        <SyntaxHighlighter
          language="json"
          style={vs2015}
          customStyle={{
            margin: 0,
            borderRadius: 6,
            fontSize: 13,
            lineHeight: '1.5',
            height: '100%',
          }}
        >
          {json}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
