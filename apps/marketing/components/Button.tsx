import Link from 'next/link';
import { ReactNode } from 'react';

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: 'solid' | 'ghost';
};

export function Button({ href, children, variant = 'solid' }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition duration-200';
  const styles =
    variant === 'solid'
      ? 'bg-accent text-background hover:brightness-110'
      : 'border border-accent/40 text-foreground hover:border-accent hover:text-accent';

  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}
