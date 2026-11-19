import type { Metadata } from 'next';
import { getPageContent, getPageMetadata } from '@brainicon/storio-elements-editor/next';
import { cms } from '@/cms.config';
import { storage } from '@/lib/storage';
import { SiteNav } from '@/components/SiteNav';
import { HomeView } from '@/components/HomeView';
import type homeDefaults from '@/content/home.json';

// Always read fresh content (the file can change at any time from the CMS).
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata(cms, 'home', { storage, fallback: { title: 'Demo site' } });
}

export default async function HomePage() {
  const content = await getPageContent<typeof homeDefaults>(cms, 'home', { storage });
  return (
    <>
      <SiteNav />
      <HomeView initialData={content} />
    </>
  );
}
