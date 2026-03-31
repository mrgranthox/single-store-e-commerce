import { adminSidebarGroups, type AdminScreenResolved } from "@/lib/contracts/admin-screen-catalog";

export type AdminBreadcrumbItem = { label: string; to?: string };

/** Stitch-style trail: group hub (linked) + current screen label. */
export const getAdminBreadcrumbTrail = (
  screen: AdminScreenResolved | undefined
): AdminBreadcrumbItem[] => {
  if (!screen || screen.group === "access-shell") {
    return [];
  }

  const group = adminSidebarGroups.find((g) => g.id === screen.group);
  const sorted = [...(group?.screens ?? [])].sort((a, b) => a.sequence - b.sequence);
  const hub = sorted[0];
  const parentLabel = (group?.title ?? screen.group.replace(/-/g, " ")).toUpperCase();

  return [
    { label: parentLabel, to: hub?.path },
    { label: (screen.navLabel ?? screen.title).toUpperCase() }
  ];
};
