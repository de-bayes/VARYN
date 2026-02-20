import { PricingTable } from '@/components/PricingTable';

const faqs = [
  {
    q: 'How do tiers scale?',
    a: 'Two plans keep pricing clear: Pro for daily modeling teams, Scale for high-throughput simulation organizations.'
  },
  {
    q: 'Do users see CPU or infrastructure details?',
    a: 'No. We keep pricing understandable with outcome-based tiers instead of exposing raw infrastructure metrics.'
  },
  {
    q: 'Can we start lean and grow into cloud execution?',
    a: 'Yes. Teams typically begin with core workflows and move up as simulation depth and organizational needs increase.'
  }
];

export default function PricingPage() {
  return (
    <div className="container-shell space-y-12 pb-16">
      <section className="space-y-4">
        <p className="text-sm tracking-[0.14em] text-accent uppercase">Pricing</p>
        <h1 className="text-4xl font-medium sm:text-5xl">Two plans. Serious modeling power.</h1>
        <p className="max-w-2xl text-muted">
          Built in the same spirit as the product: calm, minimal, and focused. Pick Pro or Scale based on simulation throughput and modeling depth.
        </p>
      </section>

      <PricingTable />

      <section className="space-y-4">
        <h2 className="text-2xl font-medium">FAQ</h2>
        {faqs.map((faq) => (
          <details key={faq.q} className="glass-panel rounded-xl p-4">
            <summary className="cursor-pointer text-sm font-medium">{faq.q}</summary>
            <p className="mt-3 text-sm text-muted">{faq.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
