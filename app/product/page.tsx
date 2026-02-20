import { AppMock } from '@/components/AppMock';
import { Reveal } from '@/components/Reveal';

const sections = [
  {
    title: 'Data',
    body: 'Ingest structured and unstructured inputs, normalize them, and keep source context attached to each step.'
  },
  {
    title: 'Models',
    body: 'Route workloads across foundation and specialist models with consistent controls and version history.'
  },
  {
    title: 'Simulations',
    body: 'Stress-test decisions with scenario branches and confidence scoring tuned to operational constraints.'
  },
  {
    title: 'Exports',
    body: 'Package conclusions into executive briefs, dashboards, and machine-readable artifacts instantly.'
  }
];

export default function ProductPage() {
  return (
    <div className="container-shell space-y-14 pb-16">
      <section className="space-y-4">
        <p className="text-sm tracking-[0.14em] text-accent uppercase">Product</p>
        <h1 className="text-4xl font-medium sm:text-5xl">Product</h1>
        <p className="max-w-2xl text-muted">The Varis workspace combines deliberate UX with serious compute posture.</p>
      </section>

      <Reveal>
        <AppMock showCallouts />
      </Reveal>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="glass-panel rounded-2xl p-6">
            <h2 className="mb-2 text-2xl font-medium">{section.title}</h2>
            <p className="text-muted">{section.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
