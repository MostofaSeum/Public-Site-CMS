'use client';

import { CmsSection, usePageContent } from '@brainicon/visual-cms/site';
import type pricingDefaults from '@/content/pricing.json';

type PricingContent = typeof pricingDefaults;

export function PricingView({ initialData }: { initialData: PricingContent }) {
  const { hero, plans } = usePageContent<PricingContent>('pricing', { initialData });

  return (
    <main className="px-6 py-16 max-w-5xl mx-auto space-y-12">
      <CmsSection sectionKey="hero" title="Header">
        <header className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold">{hero.title}</h1>
          <p className="text-slate-600">{hero.subtitle}</p>
        </header>
      </CmsSection>

      <CmsSection sectionKey="plans" title="Plans">
        <div className="grid sm:grid-cols-2 gap-6">
          {plans.items.map((plan) => (
            <div
              key={plan.id}
              className={`p-8 rounded-2xl border ${plan.highlighted ? 'border-purple-500 shadow-lg' : 'border-slate-200'}`}
            >
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-4 text-4xl font-bold">
                {plan.price}
                <span className="text-base font-normal text-slate-500">{plan.period}</span>
              </p>
            </div>
          ))}
        </div>
      </CmsSection>
    </main>
  );
}
