import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CmsConfig } from '../core/types';
import { originOf, trustedOrigins } from '../core/messages';

interface StudioContextValue {
  config: CmsConfig;
  /** Origins the studio exchanges preview messages with. */
  origins: string[];
}

const StudioContext = createContext<StudioContextValue | null>(null);

export const StudioProvider: React.FC<{ config: CmsConfig; children: React.ReactNode }> = ({ config, children }) => {
  const [origins, setOrigins] = useState<string[]>([]);

  useEffect(() => {
    const extra = [...(config.allowedOrigins ?? [])];
    const siteOrigin = originOf(config.publicSiteUrl);
    if (siteOrigin) extra.push(siteOrigin);
    setOrigins(trustedOrigins(extra));
  }, [config.allowedOrigins, config.publicSiteUrl]);

  const value = useMemo(() => ({ config, origins }), [config, origins]);
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('[visual-cms] Studio components must be rendered inside <CmsStudio>.');
  return ctx;
}
