import { FACTORY_OFFERS } from "./offers.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderPricingPage(): string {
  const cards = FACTORY_OFFERS.map((offer) => {
    const items = offer.includes
      .map((item) => "<li>" + escapeHtml(item) + "</li>")
      .join("");
    const featured = offer.featured ? " featured" : "";
    const label = offer.featured ? '<div class="pill">MAIS ESCOLHIDO</div>' : "";

    return '<article class="card' + featured + '">' +
      label +
      '<div class="tier">' + escapeHtml(offer.name) + '</div>' +
      '<div class="price">' + escapeHtml(offer.priceLabel) + '</div>' +
      '<p>' + escapeHtml(offer.description) + '</p>' +
      '<ul>' + items + '</ul>' +
      '<a class="cta" href="' + escapeHtml(offer.paymentUrl) + '" rel="noopener noreferrer">' +
      'Contratar ' + escapeHtml(offer.name) + '</a>' +
      '</article>';
  }).join("");

  return [
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>XPeX Plugin Factory — Contrate sua integração de agentes</title>',
    '<meta name="description" content="Transforme seu produto, API ou processo em uma experiência para agentes com plugin, MCP e skills.">',
    '<style>',
    ':root{font-family:Inter,system-ui,sans-serif;background:#07101f;color:#fff}*{box-sizing:border-box}',
    'body{margin:0;background:radial-gradient(circle at 50% -10%,#142442 0,#07101f 46%)}',
    'main{max-width:1180px;margin:0 auto;padding:72px 24px 90px}.brand{color:#FF7A00;font-weight:800;letter-spacing:.08em;font-size:13px}',
    'h1{font-size:clamp(42px,7vw,76px);line-height:1;max-width:950px;margin:22px 0}.lead{max-width:780px;color:#b9c7dc;font-size:20px;line-height:1.55}',
    '.truth{margin-top:24px;padding:14px 18px;border:1px solid #21415c;border-radius:14px;color:#94aac4;background:#0b1729}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:48px}',
    '.card{position:relative;background:#0e192c;border:1px solid #263a57;border-radius:22px;padding:28px;display:flex;flex-direction:column;min-height:570px}',
    '.card.featured{border-color:#FF7A00;box-shadow:0 0 0 1px #FF7A00,0 22px 70px rgba(255,122,0,.12)}',
    '.pill{position:absolute;right:20px;top:18px;color:#07101f;background:#FF7A00;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900}',
    '.tier{font-weight:900;font-size:16px;text-transform:uppercase;letter-spacing:.08em}.price{font-size:48px;font-weight:900;margin:22px 0 10px}',
    '.card p{color:#aebdd1;line-height:1.55;min-height:110px}ul{padding-left:20px;color:#d7e1ef;line-height:1.7;flex:1}li::marker{color:#00D4FF}',
    '.cta{display:block;text-decoration:none;text-align:center;background:#FF7A00;color:#07101f;padding:15px 18px;border-radius:12px;font-weight:900}',
    '.section{margin-top:68px;padding-top:34px;border-top:1px solid #1d304a}.section h2{font-size:30px}',
    '.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.step{border:1px solid #20344f;background:#0b1729;border-radius:16px;padding:18px}.step b{color:#00D4FF}',
    'footer{margin-top:64px;color:#72859e;font-size:13px}@media(max-width:900px){.grid,.steps{grid-template-columns:1fr}.card{min-height:auto}.card p{min-height:auto}}',
    '</style></head><body><main>',
    '<div class="brand">XPEX SYSTEMS AI // PLUGIN FACTORY</div>',
    '<h1>Transforme seu sistema em software para agentes.</h1>',
    '<p class="lead">Comece por R$49 com uma auditoria de viabilidade ou avance direto para implementação. Nós estruturamos blueprint, segurança, MCP e skills sem colocar credenciais dentro do plugin.</p>',
    '<div class="truth">Pagamento seguro via Stripe LIVE. A entrega só é considerada contratada depois que a liquidação é confirmada pelo provedor de pagamento.</div>',
    '<section class="grid">', cards, '</section>',
    '<section class="section"><h2>Como funciona</h2><div class="steps">',
    '<div class="step"><b>01</b><br/>Escolha o pacote e informe seu projeto no checkout.</div>',
    '<div class="step"><b>02</b><br/>A Stripe processa o pagamento e confirma a liquidação.</div>',
    '<div class="step"><b>03</b><br/>A XPeX monta e audita o blueprint, MCP e skills.</div>',
    '<div class="step"><b>04</b><br/>Você recebe o pacote técnico e o handoff da implementação.</div>',
    '</div></section>',
    '<section class="section"><h2>Importante</h2><p class="lead" style="font-size:16px">O serviço cobre engenharia e preparação técnica. Aprovação, publicação pública ou disponibilidade em plataformas de terceiros não é garantida e depende das regras e revisões de cada plataforma.</p></section>',
    '<footer>© 2026 XPeX Systems AI · <a style="color:#00D4FF" href="/privacy">Privacidade</a> · <a style="color:#00D4FF" href="/terms">Termos</a> · <a style="color:#00D4FF" href="/support">Suporte</a></footer>',
    '</main></body></html>'
  ].join("");
}
