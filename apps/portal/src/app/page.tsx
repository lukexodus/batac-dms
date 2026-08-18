import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@batac/ui/components/ui/card';

/**
 * Portal home page (TASK-PORTAL-009). Pure navigation — no data fetching.
 * Links to the four Phase 1 portal capabilities: tracking lookup, published
 * documents, complaint submission, and document-request submission.
 */
const NAV_ITEMS: { href: string; title: string; description: string }[] = [
  {
    href: '/lookup',
    title: 'Track a document',
    description:
      'Check the status of a legislative document using its QR tracking number.',
  },
  {
    href: '/documents',
    title: 'Browse published documents',
    description:
      'Search resolutions, ordinances, and appropriation ordinances released to the public portal.',
  },
  {
    href: '/complaints/new',
    title: 'File a complaint',
    description:
      'Report an incident involving a public utility vehicle or city personnel to the SP Secretariat. No account needed.',
  },
  {
    href: '/requests/new',
    title: 'Request a document copy',
    description:
      'Request a certified copy of an official SP document. No account needed.',
  },
];

export default function PortalHomePage() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-12 text-text-primary">
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <h1 className="font-sans text-3xl font-bold">Batac City LGU — Public Portal</h1>
          <p className="mt-3 text-text-secondary">
            Search and verify ordinances, resolutions, and legislative documents enacted by the
            Sangguniang Panlungsod ng Lungsod ng Batac.
          </p>
        </header>

        <nav aria-label="Portal services" className="mt-10 grid gap-4 sm:grid-cols-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="h-full transition-colors group-hover:bg-surface-raised">
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-semibold text-text-link group-hover:underline">
                    Open →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </nav>

        <p className="mt-10 text-center text-sm text-text-secondary">
          The Batac City SP Secretariat · Legislative Building, Batac City
        </p>
      </div>
    </main>
  );
}
