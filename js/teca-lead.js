// Formulário de cadastro (médico ou estudante) que abre nos botões de inscrição e envia o lead ao CRM.
(() => {
  // Endpoint serverless (api/lead.js) que grava o lead no CRM. A chave do Supabase fica só no servidor.
  const CRM_ENDPOINT = "/api/lead";

  const html = `
  <div class="tl-overlay" hidden>
    <div class="tl-modal" role="dialog" aria-modal="true" aria-labelledby="tl-title">
      <button class="tl-close" type="button" aria-label="Fechar">×</button>
      <img class="tl-logo" src="images/teca/teca-logo-branca.webp" alt="TECA SBC">
      <div class="tl-step tl-form-step">
        <h2 id="tl-title"><span>Preencha os dados abaixo</span><br>para garantir a sua vaga</h2>
        <form class="tl-form" novalidate>
          <input name="empresa" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
          <input class="tl-input" name="nome" type="text" placeholder="Nome completo" autocomplete="name" required>
          <input class="tl-input" name="email" type="email" placeholder="E-mail" autocomplete="email" required>
          <input class="tl-input" name="whatsapp" type="tel" placeholder="(DDD) WhatsApp" autocomplete="tel" inputmode="numeric" maxlength="19" required>
          <p class="tl-note"><strong>ATENÇÃO:</strong> estudantes podem se inscrever somente a partir do 9º período.</p>
          <p class="tl-error" role="alert" hidden></p>
          <button class="tl-submit" type="submit">QUERO ME INSCREVER</button>
        </form>
      </div>
      <div class="tl-step tl-done-step" hidden>
        <div class="tl-check" aria-hidden="true">✓</div>
        <h2>Cadastro recebido!</h2>
        <p>Obrigado, <strong class="tl-done-name"></strong>. Nossa equipe vai entrar em contato com você pelo WhatsApp em breve para concluir a sua inscrição no TECA.</p>
        <button class="tl-submit tl-done-close" type="button">FECHAR</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);

  const overlay = document.querySelector(".tl-overlay");
  const form = overlay.querySelector(".tl-form");
  const err = overlay.querySelector(".tl-error");
  const submit = overlay.querySelector(".tl-form .tl-submit");
  let lastFocus = null;

  const open = (e) => { e.preventDefault(); lastFocus = document.activeElement; overlay.querySelector(".tl-form-step").hidden = false; overlay.querySelector(".tl-done-step").hidden = true; err.hidden = true; overlay.hidden = false; document.documentElement.classList.add("tl-lock"); setTimeout(() => form.nome.focus(), 50); };
  const close = () => { overlay.hidden = true; document.documentElement.classList.remove("tl-lock"); if (lastFocus) lastFocus.focus(); };

  // Todos os botões de inscrição/checkout abrem o formulário
  const isCta = (a) => {
    const href = a.getAttribute("href") || "";
    return href === "#ingresso" || /ensino\.medsafebrasil\.com\.br\/matricula/.test(href);
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a && isCta(a)) open(e);
  }, true);
  overlay.querySelector(".tl-close").addEventListener("click", close);
  overlay.querySelector(".tl-done-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });

  // Máscaras simples
  form.whatsapp.addEventListener("input", () => {
    let d = form.whatsapp.value.replace(/\D/g, "");
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);  // digitou com DDI +55
    d = d.slice(0, 11);
    form.whatsapp.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });
  const fail = (msg, field) => { err.textContent = msg; err.hidden = false; if (field) field.focus(); return false; };
  const validate = () => {
    if (form.nome.value.trim().split(/\s+/).length < 2) return fail("Informe seu nome completo.", form.nome);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.value.trim())) return fail("Informe um e-mail válido.", form.email);
    const tel = form.whatsapp.value.replace(/\D/g, "");
    if (tel.length < 10 || tel.length > 11) return fail("Informe o WhatsApp com DDD.", form.whatsapp);
    err.hidden = true; return true;
  };

  const utm = () => {
    const q = new URLSearchParams(location.search), o = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].forEach(k => { if (q.get(k)) o[k] = q.get(k); });
    return o;
  };

  const send = async (lead) => {
    const r = await fetch(CRM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
    if (!r.ok) throw new Error("HTTP " + r.status);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const lead = {
      nome: form.nome.value.trim(),
      email: form.email.value.trim().toLowerCase(),
      whatsapp: "+55" + form.whatsapp.value.replace(/\D/g, ""),
      curso: "TECA SBC — 7 e 8 de Novembro",
      origem: "landing-teca",
      pagina: location.href,
      enviado_em: new Date().toISOString(),
      empresa: form.empresa.value,
      ...utm(),
    };
    submit.disabled = true; submit.textContent = "ENVIANDO...";
    try {
      await send(lead);
      overlay.querySelector(".tl-done-name").textContent = lead.nome.split(" ")[0];
      overlay.querySelector(".tl-form-step").hidden = true;
      overlay.querySelector(".tl-done-step").hidden = false;
      form.reset();
      if (window.fbq) window.fbq("track", "Lead");
      if (window.dataLayer) window.dataLayer.push({ event: "lead_teca", perfil: "cadastro" });
    } catch (x) {
      console.error("Falha ao enviar lead:", x);
      fail("Não foi possível concluir agora. Tente novamente ou fale com a equipe pelo WhatsApp.");
    } finally {
      submit.disabled = false; submit.textContent = "QUERO ME INSCREVER";
    }
  });
})();
