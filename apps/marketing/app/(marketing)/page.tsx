import { AsciiWaveHero } from '@/components/AsciiWaveHero';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Reveal } from '@/components/Reveal';

export default function HomePage() {
  return (
    <div className="space-y-14 pb-16">
      <section className="container-shell">
        <div className="mb-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div className="space-y-6 lg:-translate-y-4">
            <h1 className="text-4xl font-medium leading-tight sm:text-5xl lg:text-6xl">
              Calm, serious modeling workflows built for real decisions.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Varyn gives teams a clean statistical workspace for regression, simulation, and scalable job execution--without notebook chaos or gimmicks.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href="/app/onboarding">Try VARYN Free</Button>
              <Button href="/product" variant="ghost">
                Explore Product
              </Button>
            </div>
          </div>
          <div aria-hidden className="hidden lg:block" />
        </div>
        <AsciiWaveHero />
      </section>
    </div>
  );
}
