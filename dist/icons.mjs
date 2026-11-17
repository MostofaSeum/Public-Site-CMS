// src/admin/dynamicIcon.tsx
import * as LucideIcons from "lucide-react";
function getDynamicIcon(iconName, fallback = LucideIcons.Circle) {
  if (!iconName || typeof iconName !== "string") return fallback;
  const cleanName = iconName.trim();
  const pascalName = cleanName.split(/[-_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  const Resolved = LucideIcons[cleanName] || LucideIcons[pascalName];
  if (Resolved && typeof Resolved === "object") {
    return Resolved;
  }
  const lowerLookup = Object.keys(LucideIcons).find(
    (k) => k.toLowerCase() === cleanName.toLowerCase() || k.toLowerCase() === pascalName.toLowerCase()
  );
  if (lowerLookup) {
    const LowerResolved = LucideIcons[lowerLookup];
    if (LowerResolved && typeof LowerResolved === "object") {
      return LowerResolved;
    }
  }
  return fallback;
}
export {
  getDynamicIcon
};
