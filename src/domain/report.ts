export type FindingSeverity = "info" | "warning" | "error";

export type FactoryFinding = {
  code: string;
  severity: FindingSeverity;
  message: string;
  path?: string;
};

export type FactoryReport = {
  valid: boolean;
  findings: FactoryFinding[];
  generatedFiles: string[];
};
