export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/5 py-8 text-sm text-muted">
      <div className="container-shell flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} Varis. Designed for modern compute teams.</p>
        <p className="text-xs tracking-[0.14em] uppercase">Precision workflows, quiet confidence.</p>
      </div>
    </footer>
  );
}
