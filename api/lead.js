// Recebe o cadastro da landing e grava o lead no CRM (tabelas leads + lead_eventos do Supabase).
// Roda no servidor (Vercel Function): a service role nunca vai para o navegador.
const { randomUUID } = require("crypto");
// Nome da variável sem diferenciar maiúsculas (o painel da Vercel às vezes grava em minúsculas)
const env = (nome) => process.env[Object.keys(process.env).find(k => k.toUpperCase() === nome)] || "";
const SUPABASE_URL = (env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL")).trim().replace(/\/$/, "");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY").trim();
const ORIGEM = "landing-teca";

const db = async (path, opts = {}) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal", ...opts.headers },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.status === 204 || r.headers.get("content-length") === "0" ? null : r.json().catch(() => null);
};

const txt = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Só dígitos com DDI 55 (12 ou 13 dígitos), formato que a tela de leads espera
const telefone = (v) => {
  let d = String(v || "").replace(/\D/g, "");
  if (!(d.startsWith("55") && (d.length === 12 || d.length === 13))) d = "55" + d;
  return d.length === 12 || d.length === 13 ? d : null;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Supabase não configurado"); return res.status(500).json({ ok: false }); }

  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (txt(b.empresa)) return res.status(200).json({ ok: true });  // honeypot: robô preencheu o campo oculto

  const nome = txt(b.nome, 120);
  const email = txt(b.email, 160).toLowerCase();
  const tel = telefone(b.whatsapp);
  const medico = b.perfil !== "aluno";
  if (nome.split(/\s+/).length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !tel) {
    return res.status(400).json({ ok: false, erro: "dados inválidos" });
  }

  const curso = txt(b.curso, 120) || "TECA SBC";
  const utm = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map(k => txt(b[k], 100) && `${k.slice(4)}=${txt(b[k], 100)}`).filter(Boolean).join(", ");
  const observacao = [
    `[Landing TECA] ${medico ? `Médico(a), CRM ${txt(b.crm, 10)}/${txt(b.crm_uf, 2)}` : `Estudante, ${txt(b.periodo, 20)}`}`,
    `E-mail: ${email}`,
    utm && `Campanha: ${utm}`,
  ].filter(Boolean).join(" | ");
  const nota = `Cadastro pela landing TECA${utm ? ` (${utm})` : ""}`;
  const agora = new Date().toISOString();

  try {
    // Mesmo telefone já no CRM (WhatsApp ou envio anterior): atualiza sem mexer no status do funil
    const [existente] = await db(`leads?telefone=eq.${tel}&select=contato,nome,curso,status,observacao&order=atualizado_em.desc&limit=1`, { headers: { Prefer: "" } });
    if (existente) {
      await db(`leads?contato=eq.${encodeURIComponent(existente.contato)}`, {
        method: "PATCH",
        body: JSON.stringify({
          nome: existente.nome || nome,
          curso: existente.curso || curso,
          observacao: [existente.observacao, observacao].filter(Boolean).join("\n").slice(-4000),
          atualizado_em: agora,
        }),
      });
      await db("lead_eventos", { method: "POST", body: JSON.stringify({ contato: existente.contato, status_anterior: existente.status, status_novo: existente.status, nota: `${nota} (reenvio)`, criado_em: agora }) });
    } else {
      const contato = `site:${randomUUID()}`;
      await db("leads", {
        method: "POST",
        body: JSON.stringify({ contato, telefone: tel, nome, curso, observacao, status: "novo", status_venda: "sem_status", origem: ORIGEM, criado_em: agora, atualizado_em: agora }),
      });
      await db("lead_eventos", { method: "POST", body: JSON.stringify({ contato, status_anterior: null, status_novo: "novo", nota, criado_em: agora }) });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Falha ao gravar lead:", e);
    return res.status(500).json({ ok: false });
  }
};
