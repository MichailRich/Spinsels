import { OFFENSES, GROUPS } from "./reference/offenses";
import { CURRENT_COURTS } from "./reference/courts";
import { CIRCUMSTANCES } from "./extract/circumstances";

export type FilterOptions = {
  categories: { code: string; label: string; group: string; groupLabel: string }[];
  courts: { code: string; name: string }[];
  verzwarend: { code: string; label: string }[];
  verminderend: { code: string; label: string }[];
};

export function filterOptions(): FilterOptions {
  return {
    categories: OFFENSES.map((o) => ({ code: o.code, label: o.label, group: o.group, groupLabel: GROUPS[o.group] })),
    courts: CURRENT_COURTS.map((c) => ({ code: c.code, name: c.name })),
    verzwarend: Object.entries(CIRCUMSTANCES).filter(([, v]) => v.polarity === "verzwarend").map(([code, v]) => ({ code, label: v.label })),
    verminderend: Object.entries(CIRCUMSTANCES).filter(([, v]) => v.polarity === "verminderend").map(([code, v]) => ({ code, label: v.label })),
  };
}
