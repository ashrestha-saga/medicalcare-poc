import * as XLSX from "xlsx";
import { requirePermission, requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse, unprocessable } from "@/lib/errors";
import {
  catalogModelSourceSchema,
  catalogModelStateSchema,
  type UpdateCatalogModelInput,
} from "@/schemas/catalogModel";
import { deviceModelCatalogService } from "@/services/catalog/deviceModelCatalogService";

type RowPatch = UpdateCatalogModelInput & { _identity: boolean };

const HEADER_ALIASES: Record<string, keyof UpdateCatalogModelInput> = {
  basicudidi: "basicUdiDi",
  "basic udi-di": "basicUdiDi",
  "basic_udi_di": "basicUdiDi",
  udidi: "udiDi",
  "udi-di": "udiDi",
  udi_di: "udiDi",
  gtin: "gtins",
  gtins: "gtins",
  manufacturer: "manufacturer",
  manufacturersrn: "manufacturerSrn",
  manufacturer_srn: "manufacturerSrn",
  tradename: "tradeName",
  trade_name: "tradeName",
  modelname: "modelName",
  model_name: "modelName",
  model: "modelName",
  riskclass: "riskClass",
  risk_class: "riskClass",
  emdn: "emdnCode",
  emdncode: "emdnCode",
  emdn_code: "emdnCode",
  gmdn: "gmdnCode",
  gmdncode: "gmdnCode",
  gmdn_code: "gmdnCode",
  source: "source",
  state: "state",
  status: "state",
};

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveField(header: string): keyof UpdateCatalogModelInput | undefined {
  const spaced = normalizeHeader(header);
  return HEADER_ALIASES[spaced] ?? HEADER_ALIASES[spaced.replace(/[\s_-]+/g, "")];
}

function cellString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number") return String(value);
  const s = String(value).trim();
  return s || null;
}

function mapRow(raw: Record<string, unknown>): RowPatch | null {
  const mapped: UpdateCatalogModelInput = {};
  let hasIdentity = false;

  for (const [key, value] of Object.entries(raw)) {
    const field = resolveField(key);
    if (!field) continue;
    const text = cellString(value);

    if (field === "gtins") {
      if (text == null) continue;
      mapped.gtins = text
        .split(/[,;|]/)
        .map((g) => g.trim())
        .filter(Boolean);
      continue;
    }
    if (field === "state") {
      if (!text) continue;
      const normalized =
        text.toLowerCase() === "under review" || text.toLowerCase() === "under_review"
          ? "review"
          : text.toLowerCase();
      const parsed = catalogModelStateSchema.safeParse(normalized);
      if (parsed.success) mapped.state = parsed.data;
      continue;
    }
    if (field === "source") {
      if (!text) continue;
      const parsed = catalogModelSourceSchema.safeParse(text.toLowerCase());
      if (parsed.success) mapped.source = parsed.data;
      continue;
    }

    if (text == null) continue;
    (mapped as Record<string, unknown>)[field] = text;
    if (field === "basicUdiDi" || field === "udiDi" || field === "tradeName" || field === "modelName") {
      hasIdentity = true;
    }
  }

  if (!hasIdentity) return null;
  return { ...mapped, _identity: true };
}

/** POST /api/catalog/models/import — multipart Excel/CSV (catalog:update). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    requirePermission(ctx, "catalog:update");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw unprocessable("Expected multipart field `file`.");

    const name = file.name.toLowerCase();
    if (!/\.(xlsx|xls|csv)$/.test(name)) {
      throw unprocessable("Upload an Excel (.xlsx / .xls) or CSV file.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw unprocessable("Workbook has no sheets.");
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (!json.length) throw unprocessable("Sheet is empty.");

    const patches = json.map(mapRow).filter((r): r is RowPatch => Boolean(r));
    if (!patches.length) {
      throw unprocessable(
        "No valid rows. Use headers like manufacturer, modelName, tradeName, basicUdiDi, udiDi, gtins, state.",
      );
    }

    const rows: UpdateCatalogModelInput[] = patches.map(({ _identity: _, ...patch }) => patch);

    const result = await deviceModelCatalogService.importRows(ctx, rows);
    return Response.json({ result }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
