/**
 * apps/portal/src/app/layout.tsx
 *
 * Root layout for the public citizen portal (Phase 1 — Next.js, per ADR-UI-001).
 * Applies font CSS variables to <html> so all child components
 * can consume --font-sans, --font-mono, --font-serif via Tailwind.
 */
import type { Metadata } from 'next';
import { inter, jetbrainsMono, lora } from '@/lib/fonts';
import '@batac/ui/styles/globals.css';

export const metadata: Metadata = {
  title: 'Batac City — Official Legislative Records',
  description:
    'Search and verify ordinances, resolutions, and legislative documents enacted by the Sangguniang Panlungsod ng Lungsod ng Batac.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={[inter.variable, jetbrainsMono.variable, lora.variable].join(' ')}>
      <body>{children}</body>
    </html>
  );
}
