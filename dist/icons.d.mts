import React from 'react';

/**
 * Universal dynamic Lucide icon resolver
 * Safely resolves any icon name string to a Lucide React component with fallback.
 */
declare function getDynamicIcon(iconName?: string, fallback?: React.ComponentType<{
    className?: string;
}>): React.ComponentType<{
    className?: string;
}>;

export { getDynamicIcon };
