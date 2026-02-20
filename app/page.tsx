import { AppMock } from '@/components/AppMock';
import { AsciiWaveHero } from '@/components/AsciiWaveHero';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { FeatureCard } from '@/components/FeatureCard';
import { Reveal } from '@/components/Reveal';

export default function HomePage() {
  return (
    <div className="space-y-24 pb-16">
      <section className="container-shell">
        <div className="mb-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div className="space-y-6">
            <Badge>Compute-native planning</Badge>
            <h1 className="text-4xl font-medium leading-tight sm:text-5xl lg:text-6xl">
              Strategy software tuned for simulation-heavy teams.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Varis brings data pipelines, model orchestration, and decision outputs into one deliberate, premium workflow.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href="/product">Explore Product</Button>
              <Button href="/pricing" variant="ghost">
                View Pricing
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted lg:pb-4">
            <p className="font-[family-name:var(--font-serif)] text-2xl text-foreground">Built for calm operators.</p>
            <p className="mt-3">From demand forecasting to full scenario simulation, every run is traceable and export-ready.</p>
          </div>
        </div>
        <AsciiWaveHero />
      </section>

      <section className="container-shell grid gap-5 md:grid-cols-3">
        <Reveal>
          <FeatureCard title="Command-first control" body="Operate through concise prompts or structured inputs without breaking flow." icon="⌘" />
        </Reveal>
        <Reveal>
          <FeatureCard title="Measured throughput" body="Balance quality and compute costs with policy-aware simulation presets." icon="◌" />
        </Reveal>
        <Reveal>
          <FeatureCard title="Instant exports" body="Move from model run to polished brief in one path with citations included." icon="⇢" />
        </Reveal>
      </section>

      <section className="container-shell space-y-6">
        <Reveal>
          <h2 className="text-3xl font-medium">A single surface for critical runbooks.</h2>
        </Reveal>
        <Reveal>
          <AppMock />
        </Reveal>
      </section>
    </div>
  );
}
