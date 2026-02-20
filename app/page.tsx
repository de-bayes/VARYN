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
            <Badge>Cloud-native statistical IDE</Badge>
            <h1 className="text-4xl font-medium leading-tight sm:text-5xl lg:text-6xl">
              Cloud statistical software with a calm Stata-like spirit.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Varyn is cloud software for serious statistical work: Stata-like discipline, modern UX, and progressive cloud execution for regression and Monte Carlo simulation.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href="/product">Explore Product</Button>
              <Button href="/pricing" variant="ghost">
                View Pricing
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted lg:pb-4">
            <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">A modern cloud statistical IDE.</p>
            <p className="mt-3">Progressive power from first model to cloud-scale simulation, without noise.</p>
          </div>
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
