import { PricingTable } from '@/components/PricingTable';

const faqs = [
  {
    q: 'How is compute measured?',
    a: 'Usage blends model context window size, inference time, and simulation parallelism into a transparent monthly meter.'
  },
  {
    q: 'Can we start small and scale later?',
    a: 'Yes. Teams commonly begin on Pro and migrate to Scale when governance and dedicated throughput become mandatory.'
  },
  {
    q: 'Do you support procurement requirements?',
    a: 'Scale plans include enterprise security documentation, invoicing support, and custom terms.'
  }
];

export default function PricingPage() {
  return (
    <div className="container-shell space-y-12 pb-16">
      <section className="space-y-4">
        <p className="text-sm tracking-[0.14em] text-accent uppercase">Pricing</p>
        <h1 className="text-4xl font-medium sm:text-5xl">Pricing</h1>
        <p className="max-w-2xl text-muted">Straightforward tiers for teams optimizing both output quality and compute spend.</p>
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
