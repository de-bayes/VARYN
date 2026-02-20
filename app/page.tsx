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
            <Badge>Compute-native planning</Badge>
            <h1 className="text-4xl font-medium leading-tight sm:text-5xl lg:text-6xl">
              Clear strategy software for simulation-heavy teams.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Varis keeps your forecasting pipeline, model runs, and final decisions in one calm space.
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
            <p className="mt-3">Every run is easy to review, compare, and share.</p>
          </div>
        </div>
        <AsciiWaveHero />
      </section>

      <section className="container-shell grid gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:grid-cols-3">
        <Reveal>
          <p className="text-sm text-muted">Fast scenario setup</p>
          <p className="mt-2 text-lg">Build and run what-if plans in seconds.</p>
        </Reveal>
        <Reveal>
          <p className="text-sm text-muted">Traceable outputs</p>
          <p className="mt-2 text-lg">Every decision includes context and export-ready notes.</p>
        </Reveal>
        <Reveal>
          <p className="text-sm text-muted">Team-friendly pace</p>
          <p className="mt-2 text-lg">A focused interface with less noise on day one.</p>
        </Reveal>
      </section>
    </div>
  );
}
