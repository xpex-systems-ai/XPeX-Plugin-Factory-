export type FactoryOffer = {
  id: "audit" | "launch" | "pro" | "enterprise";
  name: string;
  priceBrl: number;
  priceLabel: string;
  paymentUrl: string;
  stripePaymentLinkId: string;
  description: string;
  includes: string[];
  featured?: boolean;
};

export const FACTORY_OFFERS: readonly FactoryOffer[] = [
  {
    id: "audit",
    name: "Readiness Audit",
    priceBrl: 49,
    priceLabel: "R$ 49",
    paymentUrl: "https://buy.stripe.com/8x214nbyrgrpaYZ2Ah1B60f",
    stripePaymentLinkId: "plink_1UMB86HDcsx7lyooIAgBjj9C",
    description:
      "Comece com uma auditoria objetiva de viabilidade antes de investir na implementação completa do seu plugin ou agente.",
    includes: [
      "Análise de viabilidade da ideia",
      "Mapa inicial de MCP e skills",
      "Principais riscos e bloqueios",
      "Recomendação de arquitetura",
      "Próximo passo técnico recomendado"
    ],
    featured: true
  },
  {
    id: "launch",
    name: "Launch",
    priceBrl: 197,
    priceLabel: "R$ 197",
    paymentUrl: "https://buy.stripe.com/7sYdR931V3ED0klfn31B60c",
    stripePaymentLinkId: "plink_1UM9SBHDcsx7lyooXtIeMNzv",
    description:
      "Transforme uma ideia clara em um pacote de plugin OpenAI/Codex validado pela XPeX Plugin Factory.",
    includes: [
      "Revisão do blueprint",
      "Validação de segurança da Factory",
      "Plugin + MCP config + skill",
      "ZIP determinístico e relatório",
      "Handoff técnico"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    priceBrl: 497,
    priceLabel: "R$ 497",
    paymentUrl: "https://buy.stripe.com/28E00j1XR0sr9UV1wd1B60d",
    stripePaymentLinkId: "plink_1UM9SwHDcsx7lyooeDRHkw0N",
    description:
      "Implementação assistida para empresas que já têm uma API, produto ou fluxo e querem virar capacidade de agente.",
    includes: [
      "Tudo do Launch",
      "Arquitetura MCP customizada",
      "Design de skills e review cases",
      "Checklist de publicação",
      "Ajustes técnicos para integração"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceBrl: 1497,
    priceLabel: "R$ 1.497",
    paymentUrl: "https://buy.stripe.com/4gM7sL0TN4IHc331wd1B60e",
    stripePaymentLinkId: "plink_1UM9T4HDcsx7lyooQdmJbLLN",
    description:
      "Engenharia avançada para transformar um sistema empresarial em uma experiência de agentes com arquitetura de produção.",
    includes: [
      "Tudo do Pro",
      "Arquitetura de autenticação e deploy",
      "Desenho de múltiplos MCPs/skills",
      "Hardening e readiness review",
      "Handoff de implementação empresarial"
    ]
  }
] as const;

export function getFactoryOffer(id: string): FactoryOffer | undefined {
  return FACTORY_OFFERS.find((offer) => offer.id === id);
}

export function getFactoryOfferByPaymentLinkId(
  paymentLinkId: string
): FactoryOffer | undefined {
  return FACTORY_OFFERS.find(
    (offer) => offer.stripePaymentLinkId === paymentLinkId
  );
}
