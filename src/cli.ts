#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { generatePlugin, assertGenerationReady } from "./factory/generate.js";
import { packagePlugin } from "./factory/package.js";

function usage(): never {
  console.error(
    "Usage: xpex-plugin-factory generate <blueprint.json> [--out <directory>] [--zip]"
  );
  process.exit(2);
}

const [, , command, blueprintPath, ...rest] = process.argv;
if (command !== "generate" || !blueprintPath) usage();

let outDir = "./generated";
let zipOnly = false;

for (let index = 0; index < rest.length; index += 1) {
  const arg = rest[index];
  if (arg === "--out") {
    const value = rest[index + 1];
    if (!value) usage();
    outDir = value;
    index += 1;
  } else if (arg === "--zip") {
    zipOnly = true;
  } else {
    usage();
  }
}

const raw = JSON.parse(await readFile(resolve(blueprintPath), "utf8")) as unknown;
const result = generatePlugin(raw);
assertGenerationReady(result);

const destination = resolve(outDir);
await mkdir(destination, { recursive: true });

if (!zipOnly) {
  for (const file of result.files) {
    const target = join(destination, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }

  await writeFile(
    join(destination, "FACTORY-REPORT.json"),
    JSON.stringify(result.report, null, 2) + "\n",
    "utf8"
  );
}

const archive = await packagePlugin(result);
const zipPath = join(
  destination,
  result.blueprint.name + "-" + result.blueprint.version + ".zip"
);
await writeFile(zipPath, archive);

console.log(
  JSON.stringify(
    {
      ok: true,
      plugin: result.blueprint.name,
      version: result.blueprint.version,
      zip: zipPath,
      files: result.report.generatedFiles,
      findings: result.report.findings
    },
    null,
    2
  )
);
