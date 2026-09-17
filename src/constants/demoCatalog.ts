import type { SparePartDTO } from "@/interfaces/orderRequest";

/**
 * Demo spare-parts catalog. Used by the OXID *mock* catalog adapter and as a
 * fallback when the catalog is unreachable. Replaced by real OXID category
 * search results once the API spec lands (⚠ PENDING API SPEC).
 */
export const DEMO_SPARE_PARTS: SparePartDTO[] = [
  {
    id: "part-x200-battery",
    articleNumber: "X200-BAT-01",
    description: "Battery pack Li-Ion 7.2V for Infusion Pump X200",
    manufacturer: "Example Medical",
    unitPrice: 189.0,
    currency: "EUR",
    fitsModelIds: ["model-pump-x200"],
    category: "Power",
  },
  {
    id: "part-x200-door",
    articleNumber: "X200-DOOR-02",
    description: "Pump door assembly incl. hinge, X200",
    manufacturer: "Example Medical",
    unitPrice: 74.5,
    currency: "EUR",
    fitsModelIds: ["model-pump-x200"],
    category: "Housing",
  },
  {
    id: "part-x200-sensor",
    articleNumber: "X200-AIR-03",
    description: "Air-in-line sensor module, X200",
    manufacturer: "Example Medical",
    unitPrice: 312.0,
    currency: "EUR",
    fitsModelIds: ["model-pump-x200"],
    category: "Sensors",
  },
  {
    id: "part-m10-spo2",
    articleNumber: "M10-SPO2-01",
    description: "SpO2 finger sensor, reusable, adult — Monitor M10",
    manufacturer: "Example Medical",
    unitPrice: 95.0,
    currency: "EUR",
    fitsModelIds: ["model-monitor-m10"],
    category: "Sensors",
  },
  {
    id: "part-m10-nibp",
    articleNumber: "M10-NIBP-02",
    description: "NIBP hose 3m with connector — Monitor M10",
    manufacturer: "Example Medical",
    unitPrice: 41.9,
    currency: "EUR",
    fitsModelIds: ["model-monitor-m10"],
    category: "Accessories",
  },
  {
    id: "part-v3-filter",
    articleNumber: "V3-FILT-01",
    description: "Inspiratory bacterial filter, pack of 10 — Ventilator V3",
    manufacturer: "Example Respiratory",
    unitPrice: 58.0,
    currency: "EUR",
    fitsModelIds: ["model-ventilator-v3"],
    category: "Consumables",
  },
  {
    id: "part-generic-fuse",
    articleNumber: "GEN-FUSE-T2A",
    description: "Fuse T2A 250V, pack of 5",
    manufacturer: null,
    unitPrice: 6.5,
    currency: "EUR",
    fitsModelIds: [],
    category: "Electrical",
  },
  {
    id: "part-generic-cable",
    articleNumber: "GEN-PWR-EU",
    description: "Hospital-grade power cord, 3m, Schuko",
    manufacturer: null,
    unitPrice: 18.0,
    currency: "EUR",
    fitsModelIds: [],
    category: "Electrical",
  },
];
