// esbuild で各 Lambda を dist/{fn}/index.js にバンドル
import * as esbuild from "esbuild";
import { readdirSync } from "fs";

const handlers = readdirSync("src");

await Promise.all(
  handlers.map((fn) =>
    esbuild.build({
      entryPoints: [`src/${fn}/index.ts`],
      bundle:      true,
      platform:    "node",
      target:      "node20",
      outfile:     `dist/${fn}/index.js`,
      external:    ["pg-native"],  // pg のネイティブバインディングは除外
      sourcemap:   false,
      minify:      true,
    })
  )
);
console.log("Build complete.");
