import type { Metadata } from 'next';
import { getPageContent, getPageMetadata } from '@brainicon/visual-cms/next';
import { cms } from '@/cms.config';
import { storage } from '@/lib/storage';
import { SiteNav } from '@/components/SiteNav';
import { PricingView } from '@/components/PricingView';
import type pricingDefaults from '@/content/pricing.json';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata(cms, 'pricing', { storage, fallback: { title: 'Pricing' } });
}

export default async function PricingPage() {
  const content = await getPageContent<typeof pricingDefaults>(cms, 'pricing', { storage });
  return (
    <>
      <SiteNav />
      <PricingView initialData={content} />
    </>
  );
}
