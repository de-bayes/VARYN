const tiers = [
  {
    name: 'Pro',
    price: '$20/mo',
    description: 'For solo analysts and small teams who need a serious cloud statistical workspace every day.',
    bullets: [
      'Unlimited graphs and model runs',
      'Up to 5,000,000 vCPU Monte Carlo simulations / month',
      'Core regression, summarize, and cloud job execution'
    ]
  },
  {
    name: 'Scale',
    price: '$35/mo',
    description: 'For heavy simulation teams that need higher throughput without sacrificing a calm interface.',
    bullets: [
      'Up to 100,000,000 vCPU Monte Carlo simulations / month',
      'Unlimited independent variables',
      'Unlimited graphs, projects, and parallel cloud jobs'
    ]
  }
];

export function PricingTable() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
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
