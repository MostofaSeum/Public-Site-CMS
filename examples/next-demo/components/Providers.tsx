'use client';

import { CmsProvider } from '@brainicon/visual-cms/site';
import { cms } from '@/cms.config';

export function Providers({ children }: { children: React.ReactNode }) {
  return <CmsProvider config={cms}>{children}</CmsProvider>;
}
