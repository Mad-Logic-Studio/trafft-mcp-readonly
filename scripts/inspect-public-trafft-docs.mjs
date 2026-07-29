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
console.log(`ROOT_KEYS ${JSON.stringify(Object.keys(document).sort())}`);

function bodyKeys(body) {
  if (!body || typeof body !== "object") return [];
  if (body.mode === "raw" && typeof body.raw === "string") {
    try {
      const parsed = JSON.parse(body.raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return Object.keys(parsed).sort();
    } catch {
      return [...new Set(body.raw.match(/[A-Za-z_][A-Za-z0-9_]*(?=\s*[:=])/g) ?? [])].sort();
    }
  }
  const entries = body[body.mode];
  return Array.isArray(entries)
    ? entries.map((entry) => entry?.key).filter((key) => typeof key === "string").sort()
    : [];
}

function urlText(url) {
  if (typeof url === "string") return url;
  if (!url || typeof url !== "object") return "unknown";
  if (typeof url.raw === "string") return url.raw;
  const host = Array.isArray(url.host) ? url.host.join(".") : "";
  const path = Array.isArray(url.path) ? `/${url.path.join("/")}` : "";
  return `${host}${path}` || "unknown";
}

const requestShapes = [];
const relevantStrings = [];
const structuralAuthObjects = [];
const visited = new WeakSet();

function walk(node, path = []) {
  if (!node || typeof node !== "object") return;
  if (visited.has(node)) return;
  visited.add(node);

  if (Array.isArray(node)) {
    node.forEach((value, index) => walk(value, [...path, `[${index}]`]));
    return;
  }

  const keys = Object.keys(node);
  if (keys.some((key) => /auth|token|request/i.test(key))) {
    structuralAuthObjects.push({ path: path.join("."), keys: keys.filter((key) => /auth|token|request|body|header|url|method|key|type|value/i.test(key)).sort() });
  }

  if (node.request && typeof node.request === "object") {
    const request = node.request;
    requestShapes.push({
      path: path.join("."),
      name: typeof node.name === "string" ? node.name : "unnamed",
      method: request.method ?? "unknown",
      url: urlText(request.url),
      bodyMode: request.body?.mode ?? "none",
      bodyKeys: bodyKeys(request.body),
      authType: request.auth?.type ?? "none",
      headerNames: Array.isArray(request.header)
        ? request.header.map((header) => header?.key).filter((key) => typeof key === "string").sort()
        : []
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower.includes("auth/token") || lower.includes("client_id") || lower.includes("client_secret")) {
        const safeValue = lower.includes("auth/token")
          ? value.slice(0, 500)
          : value.replace(/(:|=)\s*[^,}\s]+/g, "$1[redacted]").slice(0, 500);
        relevantStrings.push({ path: [...path, key].join("."), value: safeValue });
      }
    } else if (value && typeof value === "object") {
      walk(value, [...path, key]);
    }
  }
}
walk(document);

console.log(`REQUEST_COUNT ${requestShapes.length}`);
for (const item of requestShapes.slice(0, 150)) console.log(`REQUEST ${JSON.stringify(item)}`);
console.log(`RELEVANT_STRING_COUNT ${relevantStrings.length}`);
for (const item of relevantStrings.slice(0, 100)) console.log(`RELEVANT_STRING ${JSON.stringify(item)}`);
console.log(`STRUCTURAL_AUTH_OBJECT_COUNT ${structuralAuthObjects.length}`);
for (const item of structuralAuthObjects.slice(0, 100)) console.log(`STRUCTURAL_AUTH ${JSON.stringify(item)}`);
