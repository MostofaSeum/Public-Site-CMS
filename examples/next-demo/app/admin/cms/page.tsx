'use client';

import { CmsStudio } from '@brainicon/visual-cms/admin';
import { cms } from '@/cms.config';

export default function CmsPage() {
  return <CmsStudio config={cms} />;
}
