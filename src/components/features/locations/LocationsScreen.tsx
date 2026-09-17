"use client";

import { useLocationsList } from "@/components/hooks/locations/useLocationsList";
import { LocationsTable } from "./locations-table";

/** Superadmin clinic site management — gated by locations:* permission slugs. */
export function LocationsScreen() {
  const list = useLocationsList();

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="locations-denied">
        <main className="p-main">
          <section className="p-devhead">
            <h2>Locations</h2>
            <p className="p-requests__sub">You don&apos;t have permission to view locations.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="locations-page">
      <main className="p-main">
        <div className="p-admin">
          <section className="p-devhead p-admin__head">
            <div className="p-admin__head-copy">
              <h2>Locations</h2>
              <p className="p-requests__sub">
                Location → Area → Room. Maintain areas centrally so selection lists stay consistent (no five
                spellings of the same station).
              </p>
            </div>
          </section>

          <LocationsTable list={list} />
        </div>
      </main>
    </div>
  );
}
