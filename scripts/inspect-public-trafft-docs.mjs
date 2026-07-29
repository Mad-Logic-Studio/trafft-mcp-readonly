const targets = [
  "https://documenter.getpostman.com/view/1487056/2sAY4x9MRe",
  "https://www.postman.com/trafft/trafft-public-workspace/collection/1487056-0b04d1c0-ea17-4408-bddf-f9b353a63d80",
  "https://trafft.com/docs/custom-features/api/"
];

const terms = [
  "/auth/token",
  "client_id",
  "client_secret",
  "clientId",
  "clientSecret",
  "grant_type",
  "email",
  "password",
  "base_url",
  "accessToken"
];

for (const target of targets) {
  const response = await fetch(target, {
    redirect: "follow",
    headers: {
      "user-agent": "Mad-Logic-Studio-public-docs-verifier/1.0",
      accept: "text/html,application/json;q=0.9,*/*;q=0.8"
    }
  });
  const text = await response.text();
  console.log(`TARGET ${target}`);
  console.log(`STATUS ${response.status}`);
  console.log(`FINAL ${response.url}`);
  console.log(`TYPE ${response.headers.get("content-type") ?? "unknown"}`);
  console.log(`BYTES ${Buffer.byteLength(text, "utf8")}`);

  for (const term of terms) {
    const lower = text.toLowerCase();
    const needle = term.toLowerCase();
    let index = lower.indexOf(needle);
    let count = 0;
    while (index >= 0) {
      count += 1;
      if (count <= 3) {
        const start = Math.max(0, index - 180);
        const end = Math.min(text.length, index + term.length + 260);
        const snippet = text
          .slice(start, end)
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "[script]")
          .replace(/\s+/g, " ")
          .slice(0, 520);
        console.log(`MATCH ${term} #${count}: ${snippet}`);
      }
      index = lower.indexOf(needle, index + needle.length);
    }
    console.log(`COUNT ${term}: ${count}`);
  }

  const urls = [...new Set(text.match(/https?:\\?\/\\?\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g) ?? [])]
    .map((value) => value.replaceAll("\\/", "/"))
    .filter((value) => /postman|trafft|collection|documenter|_api/i.test(value))
    .slice(0, 40);
  for (const url of urls) console.log(`DISCOVERED_URL ${url}`);
  console.log("END_TARGET");
}
