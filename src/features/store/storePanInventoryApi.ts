import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";
import type { LocationOption } from "../../domain/roles";
import { listLocations } from "../admin/staff/staffApi";
import { listFlavours } from "../catalog/catalogApi";
import { listAllPans } from "../lab/labApi";

export interface StorePanInventoryRow {
  storeId: string;
  storeName: string;
  flavourId: string;
  flavourName: string;
  backupPanCount: number;
  openPanCount: number;
}

function isNewBackupPan(pan: Pan): boolean {
  return pan.active && pan.panRole === "backup" && pan.status === "received";
}

function isOpenOrPartialPan(pan: Pan): boolean {
  if (!pan.active || (pan.currentWeightKg ?? 0) <= 0) return false;
  if (pan.status === "returned") return true;
  return pan.panRole === "display" && pan.status === "display";
}

function countRows(stores: LocationOption[], flavours: Flavour[], pans: Pan[]): StorePanInventoryRow[] {
  return stores
    .flatMap((store) =>
      flavours.map((flavour) => {
        const storeFlavourPans = pans.filter(
          (pan) => pan.currentLocationId === store.id && pan.flavourId === flavour.id,
        );
        return {
          storeId: store.id,
          storeName: store.name,
          flavourId: flavour.id,
          flavourName: flavour.name,
          backupPanCount: storeFlavourPans.filter(isNewBackupPan).length,
          openPanCount: storeFlavourPans.filter(isOpenOrPartialPan).length,
        };
      }),
    )
    .sort((a, b) => {
      const storeSort = a.storeName.localeCompare(b.storeName);
      if (storeSort !== 0) return storeSort;
      return a.flavourName.localeCompare(b.flavourName);
    });
}

export async function listStorePanInventoryRows(): Promise<StorePanInventoryRow[]> {
  const [locations, flavours, pans] = await Promise.all([listLocations(), listFlavours(true), listAllPans()]);
  const stores = locations.filter((location) => location.type === "store" && location.active);
  return countRows(stores, flavours, pans);
}
