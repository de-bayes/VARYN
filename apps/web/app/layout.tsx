import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { SkillLevelProvider } from '@/lib/skill-level-context';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Varyn',
  description: 'A modern statistical workspace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="font-[family-name:var(--font-sans)] h-screen">
        <AuthProvider>
          <SkillLevelProvider>{children}</SkillLevelProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
