import JSZip from "jszip";
import type { GenerationResult } from "./generate.js";

export async function packagePlugin(result: GenerationResult): Promise<Buffer> {
  const zip = new JSZip();

  for (const file of [...result.files].sort((a, b) => a.path.localeCompare(b.path))) {
    zip.file(file.path, file.content, {
      date: new Date("2026-01-01T00:00:00.000Z")
    });
  }

  zip.file(
    "FACTORY-REPORT.json",
    JSON.stringify(result.report, null, 2) + "\n",
    { date: new Date("2026-01-01T00:00:00.000Z") }
  );

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX"
  });
}
