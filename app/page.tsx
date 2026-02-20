import { AsciiWaveHero } from '@/components/AsciiWaveHero';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Reveal } from '@/components/Reveal';

export default function HomePage() {
  return (
    <div className="space-y-14 pb-16">
      <section className="container-shell">
        <div className="mb-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div className="space-y-6">
            <Badge>Serious statistical workflows</Badge>
            <h1 className="text-4xl font-medium leading-tight sm:text-5xl lg:text-6xl">
              Calm, serious modeling workflows built for real decisions.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Varyn gives teams a clean statistical workspace for regression, simulation, and scalable job execution—without notebook chaos or gimmicks.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href="/product">Explore Product</Button>
              <Button href="/pricing" variant="ghost">
                View Pricing
              </Button>
            </div>
          </div>
          <div aria-hidden className="hidden lg:block" />
        </div>
        <AsciiWaveHero />
      </section>

      <section className="container-shell grid gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:grid-cols-3">
        <Reveal>
          <p className="text-sm text-muted">Product-first workflow</p>
          <p className="mt-2 text-lg">The 80% modeling path is clear, fast, and reviewable.</p>
        </Reveal>
        <Reveal>
          <p className="text-sm text-muted">Progressive complexity</p>
          <p className="mt-2 text-lg">Beginner-friendly at entry, expert-capable at scale.</p>
        </Reveal>
        <Reveal>
          <p className="text-sm text-muted">Cloud execution with calm control</p>
          <p className="mt-2 text-lg">Parallel simulation and jobs when you need them, calm UI always.</p>
        </Reveal>
      </section>
    </div>
  );
}
