const tiers = [
  {
    name: 'Free',
    price: '$0',
    description: 'Ideal for early exploration with light compute budgets.',
    bullets: ['3 projects', 'Community model catalog', 'Weekly exports']
  },
  {
    name: 'Pro',
    price: '$79',
    description: 'For analysts shipping production-ready simulations weekly.',
    bullets: ['Unlimited projects', 'Priority GPU queue', 'Daily exports + API']
  },
  {
    name: 'Scale',
    price: 'Custom',
    description: 'For cross-functional teams requiring governance and throughput.',
    bullets: ['Dedicated infra', 'Advanced controls', 'Enterprise support']
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
