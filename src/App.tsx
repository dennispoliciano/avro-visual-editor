import { AppHeader } from './components/AppHeader';
import { AppFooter } from './components/AppFooter';
import { SchemaHeader } from './components/SchemaHeader';
import { FieldList } from './components/FieldList';
import { PreviewPanel } from './components/PreviewPanel';
import { useEditorStore } from './store/editorStore';

function App() {
  const fields = useEditorStore((s) => s.fields);

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100vh', background: 'var(--color-surface-alt)' }}
    >
      <AppHeader />

      <main
        className="flex-1 flex flex-col lg:flex-row"
        style={{ minHeight: 0, overflow: 'hidden' }}
      >
        {/* ── Left column: form ── */}
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ borderRight: '1px solid var(--color-border)' }}
          data-testid="formulario-visual"
        >
          <SchemaHeader />
          <FieldList fields={fields} />
        </div>

        {/* ── Right column: preview ── */}
        <div
          className="flex-1 flex flex-col overflow-y-auto p-4"
          data-testid="preview-column"
        >
          <PreviewPanel />
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

export default App;
