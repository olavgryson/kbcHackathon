// Node module hooks so `npm run eval` can import the app's TypeScript modules
// directly (Node >= 22.15 type stripping), without any extra dependency.
// - "server-only" resolves to an empty module (Next aliases it the same way)
// - "@/x" resolves to "<root>/x" (tsconfig paths)
// - extensionless relative imports try ".ts" then "/index.ts"
// - ".json" files load as ES modules exporting the parsed data
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = pathToFileURL(fileURLToPath(new URL("..", import.meta.url)));

function withTsExtension(url) {
  const path = fileURLToPath(url);
  if (existsSync(path) && !path.endsWith("/")) {
    if (/\.[a-z]+$/.test(path)) return url;
  }
  if (existsSync(`${path}.ts`)) return pathToFileURL(`${path}.ts`).href;
  if (existsSync(`${path}/index.ts`)) return pathToFileURL(`${path}/index.ts`).href;
  return url;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return { url: withTsExtension(new URL(specifier.slice(2), `${root.href}/`).href), shortCircuit: true, format: undefined };
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && !context.parentURL.includes("/node_modules/")) {
      return { url: withTsExtension(new URL(specifier, context.parentURL).href), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".json")) {
      // Only project files: the URL comes from our own imports, never from user input.
      if (!url.startsWith(root.href) || url.includes("/node_modules/")) return nextLoad(url, context);
      const data = readFileSync(fileURLToPath(url), "utf8");
      return { format: "module", source: `export default ${data};`, shortCircuit: true };
    }
    if (url.startsWith("file:") && url.endsWith(".ts")) {
      return nextLoad(url, { ...context, format: "module-typescript" });
    }
    return nextLoad(url, context);
  },
});
