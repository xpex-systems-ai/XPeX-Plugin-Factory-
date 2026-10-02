import { pluginBlueprintSchema, type PluginBlueprint } from "../domain/blueprint.js";
import type { FactoryReport } from "../domain/report.js";
import { runSecurityPolicy } from "../security/policy.js";
import { renderPluginFiles, type GeneratedFile } from "./render.js";

export type GenerationResult = {
  blueprint: PluginBlueprint;
  files: GeneratedFile[];
  report: FactoryReport;
};

export function generatePlugin(raw: unknown): GenerationResult {
  const blueprint = pluginBlueprintSchema.parse(raw);
  const findings = runSecurityPolicy(blueprint);
  const files = renderPluginFiles(blueprint);

  const report: FactoryReport = {
    valid: !findings.some((finding) => finding.severity === "error"),
    findings,
    generatedFiles: files.map((file) => file.path).sort()
  };

  return { blueprint, files, report };
}

export function assertGenerationReady(result: GenerationResult): void {
  if (!result.report.valid) {
    const errors = result.report.findings
      .filter((finding) => finding.severity === "error")
      .map((finding) => `${finding.code}: ${finding.message}`)
      .join("; ");
    throw new Error(`Factory policy blocked package generation: ${errors}`);
  }
}
