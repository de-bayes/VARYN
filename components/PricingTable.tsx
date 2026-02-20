const tiers = [
  {
    name: 'Starter',
    price: '$0',
    description: 'For individuals validating core modeling workflows.',
    bullets: ['1 active project', 'CSV + .dta upload', 'Core summarize + OLS tools']
  },
  {
    name: 'Pro',
    price: '$89',
    description: 'For teams running frequent analysis and simulation cycles.',
    bullets: ['Unlimited projects', 'Robust + cluster SE workflows', 'Higher simulation and job concurrency']
  },
  {
    name: 'Scale',
    price: 'Custom',
    description: 'For organizations operating cloud-scale statistical pipelines.',
    bullets: ['Dedicated execution capacity', 'Advanced governance controls', 'Priority support + onboarding']
  }
];

export function PricingTable() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {tiers.map((tier) => (
        <article key={tier.name} className="glass-panel rounded-2xl p-6">
          <h3 className="text-xl font-medium">{tier.name}</h3>
          <p className="mt-2 text-3xl text-accent">{tier.price}</p>
          <p className="mt-3 text-sm text-muted">{tier.description}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {tier.bullets.map((bullet) => (
              <li key={bullet}>• {bullet}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
