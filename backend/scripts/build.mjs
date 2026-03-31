import * as esbuild from "esbuild";
import { readdirSync, cpSync, mkdirSync } from "fs";
import { join } from "path";

const handlers = readdirSync("src");

// esbuild でバンドル
await Promise.all(
  handlers.map((fn) =>
    esbuild.build({
      entryPoints: [`src/${fn}/index.ts`],
      bundle:      true,
      platform:    "node",
      target:      "node20",
      outfile:     `dist/${fn}/index.js`,
      external:    ["pg-native"],
      sourcemap:   false,
      minify:      true,
      // shared/ をパスエイリアス解決
      alias:       { "../../shared": join(process.cwd(), "shared") },
    })
  )
);

// migrate-handler には migrations/ を同梱
const migrationsOut = "dist/migrate-handler/migrations";
mkdirSync(migrationsOut, { recursive: true });
cpSync("migrations", migrationsOut, { recursive: true });
console.log("✅ Build complete. migrations/ copied to dist/migrate-handler/.");
