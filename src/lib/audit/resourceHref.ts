export function auditResourceHref(resource: string, resourceId: string): string | null {
  switch (resource) {
    case "request":
      return `/requests/${encodeURIComponent(resourceId)}`;
    case "catalog_model":
      return `/catalog/${encodeURIComponent(resourceId)}`;
    case "device":
      return "/devices";
    case "user":
    case "role":
      return resource === "user" ? "/users" : "/roles";
    case "site":
    case "area":
      return "/locations";
    case "training":
      return "/training";
    case "oxid":
      return "/settings";
    default:
      return null;
  }
}

export function actorKindLabel(kind: string | null | undefined): string {
  if (kind === "partner") return "Partner";
  if (kind === "platform") return "Platform";
  if (kind === "system") return "System";
  if (kind === "clinic") return "Clinic";
  return kind ?? "";
}
