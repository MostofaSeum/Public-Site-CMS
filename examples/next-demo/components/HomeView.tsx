'use client';

import { CmsSection, getDynamicIcon, usePageContent } from '@brainicon/visual-cms/site';
import type homeDefaults from '@/content/home.json';

type HomeContent = typeof homeDefaults;

export function HomeView({ initialData }: { initialData: HomeContent }) {
  const { hero, features, faq } = usePageContent<HomeContent>('home', { initialData });

  return (
    <main>
      <CmsSection sectionKey="hero" title="Hero">
        <section className="grid md:grid-cols-2 gap-10 items-center px-6 py-20 max-w-6xl mx-auto">
          <div className="space-y-5">
            {hero.badge && (
              <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-purple-100 text-purple-700">
                {hero.badge}
              </span>
            )}
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">{hero.title}</h1>
            <p className="text-lg text-slate-600">{hero.subtitle}</p>
            <a href={hero.primaryHref} className="inline-block px-5 py-3 rounded-xl bg-purple-600 text-white font-semibold">
              {hero.primaryText}
            </a>
          </div>
          {hero.heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero.heroImage} alt="" className="rounded-2xl shadow-xl w-full object-cover aspect-video" />
          )}
        </section>
      </CmsSection>

      <CmsSection sectionKey="features" title="Features">
        <section className="px-6 py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">{features.title}</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {features.items.map((item) => {
                const Icon = getDynamicIcon(item.icon);
                return (
                  <div key={item.id} className="p-6 rounded-2xl bg-white border border-slate-200">
                    <Icon className="w-6 h-6 text-purple-600 mb-3" />
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-600">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </CmsSection>

      <CmsSection sectionKey="faq" title="FAQ">
        <section className="px-6 py-16 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">{faq.title}</h2>
          <div className="space-y-4">
            {faq.items.map((item, i) => (
              <details key={i} className="p-4 rounded-xl border border-slate-200">
                <summary className="font-semibold cursor-pointer">{item.question}</summary>
                <p className="mt-2 text-slate-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </CmsSection>
    </main>
  );
}
