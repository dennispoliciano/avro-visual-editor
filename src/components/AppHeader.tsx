// src/components/AppHeader.tsx
export function AppHeader() {
  return (
    <header
      className="flex items-center gap-3 px-4 py-2 shrink-0"
      style={{ background: 'var(--color-primary)' }}
      data-testid="app-header"
    >
      <span
        className="font-bold text-white"
        style={{ fontSize: 'var(--font-size-md)', letterSpacing: '0.02em' }}
        data-testid="header-app-name"
      >
        Avro Visual Editor
      </span>
    </header>
  );
}
