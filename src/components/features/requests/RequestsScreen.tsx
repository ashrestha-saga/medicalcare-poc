"use client";

import { useRequestsList } from "@/components/hooks/requests";
import { RequestDetail } from "./RequestDetail";
import { RequestsTable } from "./requests-table";

/** Service request history, open queue, and start/complete maintenance. */
export function RequestsScreen() {
  const list = useRequestsList();

  return (
    <div className="p-work" data-testid="requests-page">
      <main className="p-main">
        <div className="p-admin">
          {list.selected ? (
            <RequestDetail
              request={list.selected}
              canWork={list.canWork}
              onBack={list.clearSelection}
              onUpdated={list.applyUpdated}
            />
          ) : (
            <>
              <section className="p-devhead p-admin__head">
                <div className="p-admin__head-copy">
                  <h2>Requests</h2>
                  <p className="p-requests__sub">History and open maintenance work</p>
                </div>
              </section>
              <RequestsTable list={list} onSelect={list.selectRequest} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
