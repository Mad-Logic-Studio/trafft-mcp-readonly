const collectionUrl = "https://documenter.gw.postman.com/api/collections/1487056/2sAY4x9MRe?segregateAuth=true&versionTag=latest";
const response = await fetch(collectionUrl, {
  redirect: "error",
  headers: { "user-agent": "Mad-Logic-Studio-public-docs-verifier/1.0", accept: "application/json" }
});
if (!response.ok) throw new Error(`Public collection fetch failed (${response.status}).`);
const document = await response.json();

let tokenItem;
function walk(node) {
  if (!node || typeof node !== "object" || tokenItem) return;
  if (Array.isArray(node)) {
    for (const value of node) walk(value);
    return;
  }
  if (node.request && typeof node.request === "object") {
    const name = String(node.name ?? "").toLowerCase();
    const raw = typeof node.request.url?.raw === "string" ? node.request.url.raw : "";
    const path = Array.isArray(node.request.url?.path) ? `/${node.request.url.path.join("/")}` : "";
    if (name === "token" || `${raw}${path}`.includes("/api/v2/token")) tokenItem = node;
  }
  for (const value of Object.values(node)) walk(value);
}
walk(document);
if (!tokenItem) throw new Error("Published token request was not found.");

const request = tokenItem.request;
const entries = Array.isArray(request.body?.urlencoded) ? request.body.urlencoded : [];
const form = entries.map((entry) => ({
  key: entry?.key,
  value: entry?.key === "grant_type" ? entry?.value : "[credential-variable]",
  type: entry?.type ?? "text",
  disabled: Boolean(entry?.disabled)
}));

const responseFields = new Set();
for (const example of Array.isArray(tokenItem.response) ? tokenItem.response : []) {
  if (typeof example?.body !== "string") continue;
  try {
    const parsed = JSON.parse(example.body);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const key of Object.keys(parsed)) responseFields.add(key);
    }
  } catch {
    // Ignore non-JSON examples.
  }
}

const headers = Array.isArray(request.header)
  ? request.header.map((header) => ({ key: header?.key, value: String(header?.value ?? "").slice(0, 120) }))
  : [];

const rawUrl = typeof request.url?.raw === "string"
  ? request.url.raw
  : `/${Array.isArray(request.url?.path) ? request.url.path.join("/") : ""}`;

console.log(JSON.stringify({
  name: tokenItem.name,
  method: request.method,
  url: rawUrl,
  bodyMode: request.body?.mode,
  form,
  headers,
  authType: request.auth?.type ?? "none",
  responseFields: [...responseFields].sort()
}, null, 2));
