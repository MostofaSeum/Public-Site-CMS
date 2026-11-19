import { fileStorage } from '@brainicon/storio-elements-editor/next';

// Server-side storage shared by the API route and server-rendered pages.
// Content lives in .cms/content.json; uploads go to public/cms-uploads.
export const storage = fileStorage();
