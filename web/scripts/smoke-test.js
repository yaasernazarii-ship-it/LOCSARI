const https = require("https");

const baseUrl = process.env.SMOKE_BASE_URL || "https://locationsari.ir";
const paths = [
  { path: "/", expectedStatus: 200, expectedContentType: "text/html" },
  { path: "/amlak", expectedStatus: 200, expectedContentType: "text/html" },
  { path: "/api/property-assistant", expectedStatus: 200, expectedContentType: "application/json", validate: (body) => typeof body.name === "string" },
  { path: "/api/push/public-key", expectedStatus: 200, expectedContentType: "application/json", validate: (body) => typeof body.enabled === "boolean" },
  { path: "/sw.js", expectedStatus: 200, expectedContentType: "javascript" },
];

function request({ path, expectedStatus, expectedContentType, validate }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    https.get(url, { timeout: 20_000 }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => {
        const contentType = response.headers["content-type"] || "";
        if (response.statusCode !== expectedStatus || !contentType.includes(expectedContentType)) {
          reject(new Error(`${path}: پاسخ نامعتبر (${response.statusCode}, ${contentType})`));
          return;
        }
        if (validate) {
          try {
            if (!validate(JSON.parse(text))) throw new Error("ساختار پاسخ نامعتبر است");
          } catch (error) {
            reject(new Error(`${path}: ${error instanceof Error ? error.message : "پاسخ نامعتبر"}`));
            return;
          }
        }
        console.log(`OK ${path}`);
        resolve();
      });
    }).on("timeout", function onTimeout() { this.destroy(new Error("مهلت درخواست تمام شد")); }).on("error", reject);
  });
}

Promise.all(paths.map(request)).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
