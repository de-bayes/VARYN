export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/5 py-8 text-sm text-muted">
      <div className="container-shell flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} Varyn. A modern statistical workspace.</p>
        <p className="text-xs tracking-[0.14em] uppercase">Elegant. Calm. Powerful. Inevitable.</p>
      </div>
    </footer>
  );
}
