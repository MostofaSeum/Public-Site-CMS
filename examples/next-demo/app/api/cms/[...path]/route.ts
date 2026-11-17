import { createCmsRouteHandler } from '@brainicon/visual-cms/next';
import { storage } from '@/lib/storage';
import { cms } from '@/cms.config';

export const { GET, PUT, DELETE, POST } = createCmsRouteHandler({
  storage,
  allowedPages: cms.pages.map((p) => p.key),
  // DEMO ONLY: everyone is an editor while running `next dev`.
  // In a real app, check your session here, e.g. `return (await getSession(req))?.role === 'admin'`.
  authorize: () => process.env.NODE_ENV === 'development',
  getUserName: () => 'demo-editor',
});
