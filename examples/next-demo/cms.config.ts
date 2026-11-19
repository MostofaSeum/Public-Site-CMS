import { defineCms } from '@brainicon/storio-elements-editor';
import { restAdapter } from '@brainicon/storio-elements-editor/adapters';
import { Home, DollarSign, Sparkles, LayoutGrid, HelpCircle, Search } from 'lucide-react';
import home from './content/home.json';
import pricing from './content/pricing.json';

export const cms = defineCms({
  title: 'Demo Site CMS',
  adapter: restAdapter({ baseUrl: '/api/cms' }),
  pages: [
    {
      key: 'home',
      title: 'Home',
      route: '/',
      icon: Home,
      defaults: home,
      sections: [
        { key: 'hero', label: '1. Hero', icon: Sparkles },
        { key: 'features', label: '2. Features', icon: LayoutGrid },
        { key: 'faq', label: '3. FAQ', icon: HelpCircle },
        { key: 'seo', label: 'SEO', icon: Search },
      ],
    },
    {
      key: 'pricing',
      title: 'Pricing',
      route: '/pricing',
      icon: DollarSign,
      defaults: pricing,
      sections: [
        { key: 'hero', label: '1. Header', icon: Sparkles },
        { key: 'plans', label: '2. Plans', icon: DollarSign },
        { key: 'seo', label: 'SEO', icon: Search },
      ],
    },
  ],
  collectionLimits: {
    'home.features.items': { max: 6, label: 'Feature cards' },
    'pricing.plans.items': { max: 3, label: 'Plans' },
  },
});
