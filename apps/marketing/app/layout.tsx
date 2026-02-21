import type { Metadata } from 'next';
import { Inter, Cormorant_Garamond } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { SkillLevelProvider } from '@/lib/skill-level-context';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const serif = Cormorant_Garamond({ subsets: ['latin'], variable: '--font-serif', weight: ['500'] });

export const metadata: Metadata = {
  title: 'Varyn',
  description: 'A cloud-native statistical IDE with progressive power scaling.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-[family-name:var(--font-sans)]">
        <AuthProvider>
          <SkillLevelProvider>{children}</SkillLevelProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
