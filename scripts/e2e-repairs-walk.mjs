#!/usr/bin/env node
/**
 * Seeded repairs E2E walk (A19–A21 + A17/A18 + E77/E78/E80 wiring).
 * Usage: node scripts/e2e-repairs-walk.mjs
 */
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const TENANT = "demo-tenant";

const results = [];
function ok(name, cond, detail) {
  results.push({ name, ok: Boolean(cond), detail: detail ?? null });
  console.log(cond ? "PASS" : "FAIL", name, detail == null ? "" : detail);
}

function jarStore() {
  const cookies = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      for (const line of raw) {
        const [pair] = line.split(";");
        const i = pair.indexOf("=");
        if (i > 0) cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function login(email, password, door) {
  const jar = jarStore();
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, door }),
  });
  jar.store(res);
  const body = await res.json();
  if (!res.ok) throw new Error(`login failed ${res.status} ${JSON.stringify(body)}`);
  return {
    jar,
    async call(method, path, body, acting = false) {
      const headers = {
        accept: "application/json",
        cookie: jar.header(),
      };
      if (acting) headers["X-Acting-Tenant-Id"] = TENANT;
      let payload;
      if (body !== undefined) {
        headers["content-type"] = "application/json";
        payload = JSON.stringify(body);
      }
      const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
      jar.store(res);
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      return { status: res.status, data };
    },
  };
}

async function main() {
  const partner = await login("k.adler@msr.example", "demo", "partner");
  const clinic = await login("anna@demo.local", "demo", "clinic");
  const ts = Date.now();

  // A19: untrained create blocked
  {
    const { status, data } = await partner.call(
      "POST",
      "/api/partner/orders",
      {
        idempotencyKey: `e2e-block-${ts}`,
        tenantId: TENANT,
        deviceInstanceId: "25be582a-6e30-59f6-b97a-6a0d6511a73c",
        serviceType: "repair",
        reason: "stoerung",
        fulfilment: "on_site",
        urgency: "immediate",
        faultDescription: "E2E block recheck",
        faultConsequence: "out_of_service",
        faultReportedBy: "e2e",
        assigneeUserId: "user-partner-msr-reinhardt",
      },
      true,
    );
    ok(
      "A19 create untrained → 423 TRAINING_GATE",
      status === 423 && data?.error?.code === "TRAINING_GATE",
      status,
    );
  }

  // A19: assign override path
  let overrideRef;
  {
    const created = await partner.call(
      "POST",
      "/api/partner/orders",
      {
        idempotencyKey: `e2e-ov-${ts}`,
        tenantId: TENANT,
        deviceInstanceId: "cc32036a-c794-5ec6-80f3-e61c3fc50f02",
        serviceType: "repair",
        reason: "stoerung",
        fulfilment: "on_site",
        urgency: "immediate",
        faultDescription: "E2E override path",
        faultConsequence: "out_of_service",
        faultReportedBy: "e2e",
      },
      true,
    );
    overrideRef = created.data?.request?.reference;
    const blocked = await partner.call(
      "PATCH",
      `/api/partner/disposition/${overrideRef}`,
      { assigneeUserId: "user-partner-msr-reinhardt" },
      true,
    );
    const overridden = await partner.call(
      "PATCH",
      `/api/partner/disposition/${overrideRef}`,
      {
        assigneeUserId: "user-partner-msr-reinhardt",
        gateOverrideReason: "E2E accompanied",
      },
      true,
    );
    ok(
      "A19 assign blocked then override",
      blocked.status === 423 &&
        overridden.status === 200 &&
        overridden.data?.row?.gateOverridden === true,
      {
        block: blocked.status,
        ok: overridden.status,
        flag: overridden.data?.row?.gateOverridden,
      },
    );
  }

  // A17 / E77 clinic
  {
    const { data: sr } = await clinic.call(
      "GET",
      "/api/service-requests/SR-SEED-PARTNER-SENDIN",
    );
    ok(
      "A17 clinic sendIn DTO",
      sr?.fulfilment === "send_in" && Boolean(sr?.sendIn?.shippedAt),
      sr?.sendIn,
    );
    const { data: wrap } = await clinic.call("GET", "/api/devices/instance-inv-10001");
    const dev = wrap?.device || wrap;
    ok(
      "E77 device openSendIn chip",
      dev?.openSendInRepair?.reference === "SR-SEED-PARTNER-SENDIN",
      dev?.openSendInRepair,
    );
  }

  // Adler K-REP path
  const adler = await partner.call(
    "POST",
    "/api/partner/orders",
    {
      idempotencyKey: `e2e-krep-${ts}`,
      tenantId: TENANT,
      deviceInstanceId: "176e2ea4-aca1-5c6e-828b-132ab928eecb",
      serviceType: "repair",
      reason: "stoerung",
      fulfilment: "on_site",
      urgency: "immediate",
      faultDescription: "E2E K-REP seal path",
      faultConsequence: "out_of_service",
      faultReportedBy: "e2e",
      assigneeUserId: "user-partner-msr-adler",
    },
    true,
  );
  const aref = adler.data?.request?.reference;
  const asid = adler.data?.request?.id;
  ok("Create Adler repair", Boolean(aref), aref);

  const previewRes = await partner.call(
    "GET",
    `/api/partner/inspection-runs/resolve?reference=${encodeURIComponent(aref)}`,
    undefined,
    true,
  );
  const preview = previewRes.data;
  ok(
    "Repair→K-REP preview",
    preview?.inspectionTypeCode === "REPAIR" && preview?.catalogue?.code === "K-REP",
    { t: preview?.inspectionTypeCode, c: preview?.catalogue?.code },
  );

  const started = await partner.call(
    "POST",
    "/api/partner/inspection-runs",
    { reference: aref, occasionCode: "repair" },
    true,
  );
  const runId = started.data?.run?.id;
  ok("Start K-REP run", Boolean(runId), { status: started.status, err: started.data?.error });
  if (!runId) {
    console.log(JSON.stringify({ results }, null, 2));
    process.exit(1);
  }

  await partner.call("POST", `/api/partner/inspection-runs/${runId}/visit/start`, {}, true);
  await partner.call(
    "POST",
    `/api/partner/inspection-runs/${runId}/confirm-device`,
    { skip: true },
    true,
  );

  const preview2 = (
    await partner.call(
      "GET",
      `/api/partner/inspection-runs/resolve?reference=${encodeURIComponent(aref)}`,
      undefined,
      true,
    )
  ).data;
  let catSteps = preview2?.catalogue?.steps || [];
  if (!catSteps.length) {
    const runGet = await partner.call("GET", `/api/partner/inspection-runs/${runId}`, undefined, true);
    catSteps = runGet.data?.run?.steps || runGet.data?.steps || [];
  }
  console.log(
    "cat_steps",
    catSteps.map((s) => [s.id || s.stepId, s.inputKind]),
  );

  const patches = catSteps.map((s) => {
    const kind = s.inputKind;
    const stepId = s.id || s.stepId;
    if (kind === "check") return { stepId, confirmed: true };
    if (kind === "text") return { stepId, confirmed: true, note: "Sensor drift" };
    if (kind === "select") return { stepId, confirmed: true, note: "repaired" };
    if (kind === "parts") return { stepId, confirmed: true, note: "" };
    if (kind === "number") return { stepId, confirmed: true, measuredValue: "30" };
    if (kind === "measurement") return { stepId, confirmed: true, measuredValue: "ok" };
    if (kind === "result")
      return { stepId, confirmed: true, note: "repaired\nsicherheitsrelevant: ja" };
    return { stepId, confirmed: true, note: "ok" };
  });

  const saved = await partner.call(
    "PATCH",
    `/api/partner/inspection-runs/${runId}/steps`,
    { steps: patches },
    true,
  );
  ok("Save steps", saved.status < 300, { status: saved.status, err: saved.data?.error });

  const tiny =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  for (const kind of ["inspector", "institution"]) {
    const sig = await partner.call(
      "PUT",
      `/api/partner/inspection-runs/${runId}/signatures`,
      { kind, signerName: "E2E", signerRole: "tech", imageDataUrl: tiny },
      true,
    );
    ok(`Sign ${kind}`, sig.status < 300, { status: sig.status, err: sig.data?.error });
  }

  const done = await partner.call(
    "POST",
    `/api/partner/inspection-runs/${runId}/complete`,
    { result: "passed", note: "E2E" },
    true,
  );
  ok("Seal K-REP", done.status < 300, { status: done.status, err: done.data?.error });

  const order = (
    await partner.call("GET", `/api/partner/orders/${encodeURIComponent(aref)}`, undefined, true)
  ).data?.order;
  const children = order?.childReferences || [];
  console.log("after seal", {
    state: order?.state,
    mandatory: order?.mandatory,
    checkType: order?.checkType,
    proposalState: order?.proposalState,
    childReferences: children,
  });
  ok(
    "Follow-up after safety repair",
    children.length > 0 || order?.mandatory || order?.proposalState === "proposed",
    {
      children,
      mandatory: order?.mandatory,
      proposal: order?.proposalState,
    },
  );

  const followRef = children[0] || null;
  if (followRef) {
    const fprev = (
      await partner.call(
        "GET",
        `/api/partner/inspection-runs/resolve?reference=${encodeURIComponent(followRef)}`,
        undefined,
        true,
      )
    ).data;
    const ford = (
      await partner.call(
        "GET",
        `/api/partner/orders/${encodeURIComponent(followRef)}`,
        undefined,
        true,
      )
    ).data?.order;
    ok(
      "E78 follow-up checkType+catalogue",
      Boolean(ford?.checkType) && fprev?.inspectionTypeCode !== "REPAIR",
      {
        checkType: ford?.checkType,
        type: fprev?.inspectionTypeCode,
        cat: fprev?.catalogue?.code,
      },
    );
  } else {
    ok("E78 follow-up checkType+catalogue", false, "no child follow-up");
  }

  // E80 BV
  const bv = await partner.call(
    "POST",
    `/api/partner/requests/${asid}/parts-proposal`,
    { lines: [{ description: "IR module", partNo: "TS9-IR", qty: 1 }] },
    true,
  );
  const pid = bv.data?.proposal?.id;
  ok("E80 BV create", Boolean(pid), { status: bv.status, err: bv.data?.error, id: pid });
  const bv2 = await partner.call(
    "POST",
    `/api/partner/requests/${asid}/parts-proposal`,
    { lines: [{ description: "IR module", partNo: "TS9-IR", qty: 1 }] },
    true,
  );
  ok("E80 BV idempotent", Boolean(pid) && pid === bv2.data?.proposal?.id);

  const bad = await clinic.call(
    "POST",
    `/api/partner/requests/${asid}/parts-proposal`,
    { lines: [{ description: "x", qty: 1 }] },
    true,
  );
  ok("E80 clinic cannot create BV", bad.status >= 400, { status: bad.status });

  // Inspect resolve is assignee-strict; fulfilment for Heute filtering comes from order/DTO.
  const sendInOrder = (
    await partner.call(
      "GET",
      "/api/partner/orders/SR-SEED-PARTNER-SENDIN",
      undefined,
      true,
    )
  ).data?.order;
  ok(
    "Send-in fulfilment available for Heute filter",
    sendInOrder?.fulfilment === "send_in",
    sendInOrder?.fulfilment,
  );

  const cats = (
    await partner.call("GET", "/api/partner/inspect/catalogues", undefined, true)
  ).data;
  const codes = new Set((cats?.catalogues || []).map((c) => c.code));
  ok("E78 generic K-PNI + K-MTK-gen seeded", codes.has("K-PNI") && codes.has("K-MTK-gen"));

  const failed = results.filter((r) => !r.ok);
  console.log("---");
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILED:");
    for (const f of failed) console.log(" ", f);
    process.exit(1);
  }
  console.log("ALL CHECKS PASSED");
  console.log(
    JSON.stringify({ aref, asid, runId, followRef, overrideRef }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
