import { z } from "zod";

const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "URL must use HTTPS");

const slug = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase kebab-case");

export const mcpServerSchema = z.object({
  name: slug,
  url: httpsUrl,
  transport: z.literal("streamable-http").default("streamable-http"),
  auth: z.enum(["none", "oauth2.1", "machine-key"]).default("none")
}).strict();

export const skillSchema = z.object({
  name: slug,
  description: z.string().min(20).max(500),
  instructions: z.string().min(50).max(20_000)
}).strict();

export const reviewCaseSchema = z.object({
  description: z.string().min(3).max(200),
  prompt: z.string().min(3).max(1_000),
  expectedBehavior: z.string().min(10).max(2_000),
  toolsTriggered: z.array(z.string().min(1)).default([])
}).strict();

export const pluginBlueprintSchema = z.object({
  name: slug,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  displayName: z.string().min(3).max(80),
  shortDescription: z.string().min(10).max(120),
  longDescription: z.string().min(30).max(1_500),
  developerName: z.string().min(2).max(120),
  developerEmail: z.string().email().optional(),
  category: z.enum([
    "Developer Tools",
    "Productivity",
    "Business",
    "Education",
    "Data & Analytics",
    "Other"
  ]),
  homepage: httpsUrl,
  repository: httpsUrl.optional(),
  supportUrl: httpsUrl,
  privacyPolicyUrl: httpsUrl,
  termsOfServiceUrl: httpsUrl,
  keywords: z.array(slug).min(1).max(20),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  brandColorDark: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  defaultPrompts: z.array(z.string().min(3).max(500)).min(1).max(8),
  capabilities: z.array(z.string().min(3).max(150)).min(1).max(20),
  mcpServers: z.array(mcpServerSchema).min(1).max(10),
  skills: z.array(skillSchema).min(1).max(20),
  review: z.object({
    positive: z.array(reviewCaseSchema).min(1).max(20),
    negative: z.array(reviewCaseSchema.omit({ expectedBehavior: true }).extend({
      expectedBehavior: z.string().min(10).max(2_000).optional()
    })).min(1).max(20),
    commerce: z.boolean().default(false),
    commerceDescription: z.string().min(10).max(800).optional()
  }).strict(),
  publication: z.object({
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(50),
    releaseNotes: z.string().min(10).max(2_000)
  }).strict(),
  security: z.object({
    dataClassification: z.enum(["public", "account", "sensitive"]).default("public"),
    writeActions: z.boolean().default(false),
    requiresHumanApproval: z.boolean().default(false),
    forbiddenSecretClasses: z.array(z.string()).default([
      "api_key",
      "password",
      "private_key",
      "seed_phrase",
      "session_cookie"
    ])
  }).strict()
}).strict().superRefine((value, ctx) => {
  if (value.security.writeActions && !value.security.requiresHumanApproval) {
    ctx.addIssue({
      code: "custom",
      path: ["security", "requiresHumanApproval"],
      message: "Write-capable plugins must require human approval by default."
    });
  }

  if (value.review.commerce && !value.review.commerceDescription) {
    ctx.addIssue({
      code: "custom",
      path: ["review", "commerceDescription"],
      message: "Commerce plugins require a commerce description."
    });
  }

  const serverNames = new Set<string>();
  for (const server of value.mcpServers) {
    if (serverNames.has(server.name)) {
      ctx.addIssue({
        code: "custom",
        path: ["mcpServers"],
        message: `Duplicate MCP server name: ${server.name}`
      });
    }
    serverNames.add(server.name);
  }
});

export type PluginBlueprint = z.infer<typeof pluginBlueprintSchema>;
