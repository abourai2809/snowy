import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  FlaskConical,
  Home,
  PackageSearch,
  Settings2,
  Store,
  UserRoundCog,
} from "lucide-react";
import { APP_ROLES, type AppRole } from "../domain/roles";

export type RouteId =
  | "dashboard"
  | "attendance"
  | "lab"
  | "store"
  | "stores"
  | "catalog"
  | "staff";

export interface AppRoute {
  id: RouteId;
  label: string;
  navLabel: string;
  icon: LucideIcon;
  roles: readonly AppRole[];
}

const allRoles = APP_ROLES;
const labRoles = ["admin", "lab_manager", "lab_staff"] as const;
const storeRoles = ["store_manager", "store_staff"] as const;

export const APP_ROUTES: readonly AppRoute[] = [
  {
    id: "dashboard",
    label: "Home",
    navLabel: "Home",
    icon: Home,
    roles: allRoles,
  },
  {
    id: "attendance",
    label: "Attendance",
    navLabel: "Attend",
    icon: ClipboardCheck,
    roles: allRoles,
  },
  {
    id: "lab",
    label: "Lab",
    navLabel: "Lab",
    icon: FlaskConical,
    roles: labRoles,
  },
  {
    id: "store",
    label: "Store",
    navLabel: "Store",
    icon: Store,
    roles: storeRoles,
  },
  {
    id: "stores",
    label: "Stores",
    navLabel: "Stores",
    icon: Store,
    roles: ["admin"],
  },
  {
    id: "catalog",
    label: "Catalog",
    navLabel: "Catalog",
    icon: Settings2,
    roles: ["admin"],
  },
  {
    id: "staff",
    label: "Staff",
    navLabel: "Staff",
    icon: UserRoundCog,
    roles: ["admin"],
  },
] as const;

export const HOME_CARDS: Record<AppRole, readonly string[]> = {
  admin: ["Catalog setup", "Staff roster", "Store reports", "Lab overview"],
  store_manager: ["Incoming pans", "EOD review", "Same-day corrections", "Store supplies"],
  lab_manager: ["Production batches", "Dispatch queue", "Raw materials", "Lab supplies"],
  store_staff: ["Check in", "Incoming pans", "Move to display", "EOD display count"],
  lab_staff: ["Check in", "Production entry", "Dispatch pans", "Lab supplies"],
};

export const OPERATION_CARDS: Record<RouteId, readonly string[]> = {
  dashboard: [],
  attendance: ["Check in", "Check out", "My history", "Weekly off"],
  lab: ["Production", "Dispatch", "Raw materials", "Lab supplies"],
  store: ["Incoming pans", "Backup freezer", "Move to display", "End of day"],
  stores: ["Rajpur Road", "Malsi", "Mussoorie", "All stores"],
  catalog: ["Flavours", "Products", "Store supplies", "Lab supplies", "Raw materials", "Packaging"],
  staff: ["Staff roster", "Holiday allowance", "Bonus days", "Inactive staff"],
};

const ROLE_ROUTE_CARDS: Partial<Record<RouteId, Partial<Record<AppRole, readonly string[]>>>> = {
  attendance: {
    admin: ["Today roster", "Salary sheet", "Holiday allowance", "Approvals"],
  },
  store: {
    store_manager: ["Incoming pans", "Backup freezer", "Move to display", "Same-day corrections"],
    store_staff: ["Incoming pans", "Backup freezer", "Move to display", "EOD display count"],
  },
};

export function getRoutesForRole(role: AppRole): AppRoute[] {
  return APP_ROUTES.filter((route) => route.roles.includes(role));
}

export function canAccessRoute(role: AppRole, routeId: RouteId): boolean {
  return getRoutesForRole(role).some((route) => route.id === routeId);
}

export function getDefaultRouteForRole(role: AppRole): RouteId {
  return getRoutesForRole(role)[0]?.id ?? "dashboard";
}

export function getRoute(routeId: RouteId): AppRoute {
  const route = APP_ROUTES.find((item) => item.id === routeId);

  if (!route) {
    throw new Error(`Unknown route: ${routeId}`);
  }

  return route;
}

export function getRouteCards(routeId: RouteId, role?: AppRole): readonly string[] {
  if (routeId === "dashboard" && role) {
    return HOME_CARDS[role];
  }

  if (role) {
    const roleCards = ROLE_ROUTE_CARDS[routeId]?.[role];
    if (roleCards) {
      return roleCards;
    }
  }

  return OPERATION_CARDS[routeId] ?? [];
}

export function getRouteSummary(routeId: RouteId): string {
  const summaries: Record<RouteId, string> = {
    dashboard: "Today",
    attendance: "Daily roster",
    lab: "Production desk",
    store: "Store desk",
    stores: "Store oversight",
    catalog: "Master data",
    staff: "Team setup",
  };

  return summaries[routeId];
}

export const inventoryIcon = PackageSearch;
