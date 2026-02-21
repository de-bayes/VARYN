import Link from 'next/link';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/product', label: 'Product' },
  { href: '/pricing', label: 'Pricing' }
];

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-background/85 backdrop-blur">
      <nav className="container-shell flex h-16 items-center justify-between">
        <Link
          href="/"
          className="text-xl font-semibold tracking-[-0.01em] text-foreground transition hover:opacity-85 sm:text-2xl"
        >
          VARYN
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted sm:gap-6">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-foreground">
              {item.label}
            </Link>
          ))}
          <Link
            href="/app/workspace"
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Open App
          </Link>
        </div>
      </nav>
    </header>
  );
}
