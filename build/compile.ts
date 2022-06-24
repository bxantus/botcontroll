import * as path from "https://deno.land/std@0.141.0/path/mod.ts"
import * as esbuild from "https://deno.land/x/esbuild@v0.14.39/mod.js";
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader@0.5.0/mod.ts";

const srcFile = Deno.args[0]
const out = Deno.args[1]
const buildMode:"debug"|"release" = "debug"

Deno.mkdirSync(out, {recursive:true})

const filesToCopy = ["index.html"]
for (const f of filesToCopy){
    console.log(`copy src/${f} -> ${out}/${f}`)
    Deno.copyFileSync(`src/${f}`, `${out}/${f}` )
}

console.log(`Compiling src/${srcFile}`)
const outName = "bundle.js"

try {
  await esbuild.build({
    plugins: [
      denoPlugin({ 
        // importMapURL: path.toFileUrl(path.resolve("src/import_map.json")) 
      })
    ],
    entryPoints: ["src/"+srcFile],
    outfile: path.join(out, outName),
    bundle: true,
    format: "esm",
    sourcemap: "linked",
  });
} catch (err) {
  console.error("Build failed")
} finally {
  esbuild.stop();
}