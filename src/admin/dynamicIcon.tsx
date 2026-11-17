import React from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * Universal dynamic Lucide icon resolver
 * Safely resolves any icon name string to a Lucide React component with fallback.
 */
export function getDynamicIcon(iconName?: string, fallback: React.ComponentType<{ className?: string }> = LucideIcons.Circle): React.ComponentType<{ className?: string }> {
  if (!iconName || typeof iconName !== 'string') return fallback;

  // Clean and normalize icon name (e.g. 'calendar-check' -> 'CalendarCheck', 'phone' -> 'Phone')
  const cleanName = iconName.trim();
  const pascalName = cleanName
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  // Direct lookup in Lucide namespace
  const Resolved = (LucideIcons as Record<string, unknown>)[cleanName] ||
    (LucideIcons as Record<string, unknown>)[pascalName];

  if (Resolved && typeof Resolved === 'object') {
    return Resolved as React.ComponentType<{ className?: string }>;
  }

  // Handle common case mismatches
  const lowerLookup = Object.keys(LucideIcons).find(
    (k) => k.toLowerCase() === cleanName.toLowerCase() || k.toLowerCase() === pascalName.toLowerCase()
  );
  if (lowerLookup) {
    const LowerResolved = (LucideIcons as Record<string, unknown>)[lowerLookup];
    if (LowerResolved && typeof LowerResolved === 'object') {
      return LowerResolved as React.ComponentType<{ className?: string }>;
    }
  }

  return fallback;
}

/**
 * Popular icons catalog for the visual icon picker
 */
export const POPULAR_ICONS: { name: string; category: string }[] = [
  // Education & Academics
  { name: 'GraduationCap', category: 'Education' },
  { name: 'School', category: 'Education' },
  { name: 'BookOpen', category: 'Education' },
  { name: 'Award', category: 'Education' },
  { name: 'Trophy', category: 'Education' },
  { name: 'Medal', category: 'Education' },
  { name: 'FlaskConical', category: 'Education' },
  { name: 'Compass', category: 'Education' },
  { name: 'PenTool', category: 'Education' },

  // System & Technology
  { name: 'Zap', category: 'Technology' },
  { name: 'Globe', category: 'Technology' },
  { name: 'Globe2', category: 'Technology' },
  { name: 'Terminal', category: 'Technology' },
  { name: 'Laptop', category: 'Technology' },
  { name: 'Smartphone', category: 'Technology' },
  { name: 'Layers', category: 'Technology' },
  { name: 'Layout', category: 'Technology' },
  { name: 'LayoutDashboard', category: 'Technology' },
  { name: 'Cloud', category: 'Technology' },
  { name: 'Radio', category: 'Technology' },
  { name: 'Settings2', category: 'Technology' },

  // Business & Institutional
  { name: 'Landmark', category: 'Business' },
  { name: 'Building2', category: 'Business' },
  { name: 'Briefcase', category: 'Business' },
  { name: 'Users', category: 'Business' },
  { name: 'CreditCard', category: 'Business' },
  { name: 'BarChart3', category: 'Business' },
  { name: 'TrendingUp', category: 'Business' },
  { name: 'ShieldCheck', category: 'Business' },
  { name: 'Lock', category: 'Business' },

  // Communication & Status
  { name: 'Calendar', category: 'Communication' },
  { name: 'CalendarCheck', category: 'Communication' },
  { name: 'Headphones', category: 'Communication' },
  { name: 'Phone', category: 'Communication' },
  { name: 'Mail', category: 'Communication' },
  { name: 'MessageSquare', category: 'Communication' },
  { name: 'MessageCircle', category: 'Communication' },
  { name: 'BellRing', category: 'Communication' },
  { name: 'Megaphone', category: 'Communication' },
  { name: 'Check', category: 'Communication' },
  { name: 'CheckCircle2', category: 'Communication' },
  { name: 'ArrowRight', category: 'Communication' },
  { name: 'ExternalLink', category: 'Communication' },
  { name: 'FileText', category: 'Communication' },
  { name: 'FileCheck2', category: 'Communication' },
  { name: 'MapPin', category: 'Communication' },

  // Social
  { name: 'Facebook', category: 'Social' },
  { name: 'Twitter', category: 'Social' },
  { name: 'Linkedin', category: 'Social' },
  { name: 'Instagram', category: 'Social' },
];

