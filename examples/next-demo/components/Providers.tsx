'use client';

import { CmsProvider } from '@brainicon/storio-elements-editor/site';
import { cms } from '@/cms.config';

export function Providers({ children }: { children: React.ReactNode }) {
  return <CmsProvider config={cms}>{children}</CmsProvider>;
}
