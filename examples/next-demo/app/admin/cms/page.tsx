'use client';

import { CmsStudio } from '@brainicon/storio-elements-editor/admin';
import { cms } from '@/cms.config';

export default function CmsPage() {
  return <CmsStudio config={cms} />;
}
