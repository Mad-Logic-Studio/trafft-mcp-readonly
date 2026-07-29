const collectionUrl = "https://documenter.gw.postman.com/api/collections/1487056/2sAY4x9MRe?segregateAuth=true&versionTag=latest";

const response = await fetch(collectionUrl, {
  redirect: "error",
  headers: {
    "user-agent": "Mad-Logic-Studio-public-docs-verifier/1.0",
    accept: "application/json"
  }
});

console.log(`STATUS ${response.status}`);
console.log(`TYPE ${response.headers.get("content-type") ?? "unknown"}`);
if (!response.ok) process.exit(1);

const document = await response.json();
const matches = [];

function normalizedUrl(url) {
  if (typeof url === "string") return url;
  if (!url || typeof url !== "object") return "unknown";
  if (typeof url.raw === "string") return url.raw;
  const host = Array.isArray(url.host) ? url.host.join(".") : "";
  const path = Array.isArray(url.path) ? `/${url.path.join("/")}` : "";
  return `${host}${path}` || "unknown";
}

function bodyKeys(body) {
  if (!body || typeof body !== "object") return [];
  if (body.mode === "raw" && typeof body.raw === "string") {
    try {
      const parsed = JSON.parse(body.raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return Object.keys(parsed).sort();
    } catch {
      return [...new Set((body.raw.match(/[A-Za-z_][A-Za-z0-9_]*(?=\s*[:=])/g) ?? []))].sort();
    }
  }
  const entries = body[body.mode];
  if (Array.isArray(entries)) return entries.map((entry) => entry?.key).filter((key) => typeof key === "string").sort();
  return [];
}

function responseFieldNames(item) {
  const names = new Set();
  for (const example of Array.isArray(item.response) ? item.response : []) {
    if (typeof example?.body !== "string") continue;
    try {
      const parsed = JSON.parse(example.body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const key of Object.keys(parsed)) names.add(key);
      }
    } catch {
      // Public example is not JSON; reveal nothing from it.
    }
  }
  return [...names].sort();
}

function visit(node, trail = []) {
  if (!node || typeof node !== "object") return;
  if (node.request && typeof node.request === "object") {
    const request = node.request;
    const name = typeof node.name === "string" ? node.name : "unnamed";
    const url = normalizedUrl(request.url);
    const searchable = `${name} ${url}`.toLowerCase();
    if (searchable.includes("auth/token") || searchable.includes("authenticate") || searchable.includes("authentication")) {
      const headers = Array.isArray(request.header)
        ? request.header.map((header) => header?.key).filter((key) => typeof key === "string").sort()
        : [];
      const contentType = Array.isArray(request.header)
        ? request.header.find((header) => String(header?.key).toLowerCase() === "content-type")?.value
        : undefined;
      matches.push({
        trail: [...trail, name],
        name,
        method: request.method ?? "unknown",
        url,
        authType: request.auth?.type ?? "none",
        headerNames: headers,
        contentType: typeof contentType === "string" ? contentType : "unspecified",
        bodyMode: request.body?.mode ?? "none",
        bodyKeys: bodyKeys(request.body),
        responseFieldNames: responseFieldNames(node)
      });
    }
  }
  for (const key of ["item", "items", "children"]) {
    if (Array.isArray(node[key])) {
      for (const child of node[key]) visit(child, [...trail, typeof node.name === "string" ? node.name : key]);
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (["item", "items", "children", "request", "response"].includes(key)) continue;
    if (value && typeof value === "object") visit(value, trail);
  }
}

visit(document);

const variableNames = new Set();
function collectVariableNames(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const value of node) collectVariableNames(value);
    return;
  }
  if (Array.isArray(node.variable)) {
    for (const variable of node.variable) {
      if (typeof variable?.key === "string") variableNames.add(variable.key);
    }
  }
  for (const value of Object.values(node)) collectVariableNames(value);
}
collectVariableNames(document);

console.log(`MATCH_COUNT ${matches.length}`);
for (const match of matches) console.log(`AUTH_REQUEST ${JSON.stringify(match)}`);
console.log(`VARIABLE_NAMES ${JSON.stringify([...variableNames].sort())}`);
if (matches.length === 0) process.exitCode = 2;
