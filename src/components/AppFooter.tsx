// src/components/AppFooter.tsx
export function AppFooter() {
  return (
    <footer className="shrink-0" data-testid="app-footer">
      <hr className="divider" style={{ margin: 0 }} />
      <div className="flex justify-center py-3">
        <span
          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-on-surface-muted)' }}
          data-testid="footer-text"
        >
          Built by{' '}
          <a
            href="https://github.com/dennispoliciano"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            dennispoliciano
          </a>
        </span>
      </div>
    </footer>
  );
}
