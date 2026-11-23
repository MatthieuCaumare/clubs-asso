/* Espace modérateurs : connexion, gestion des contenus d'un club, gestion des modérateurs */
(function () {
  "use strict";
  const { SUPABASE_URL, SUPABASE_KEY } = window.CONFIG;
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $main = document.getElementById("admin");
  const $user = document.getElementById("user-box");
  const dlg = document.getElementById("dlg"), dlgForm = document.getElementById("dlg-form");

  const S = { session: null, profil: null, clubs: [], sports: [], club: null, equipes: [], tab: "rencontres", filtre: {}, recovery: false };

  /* ------------------------------------------------------------ Outils */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDT = (v) => v ? new Date(v).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const fmtD = (v) => v ? new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
  function toast(msg, error) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.className = "toast" + (error ? " error" : ""); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), error ? 6000 : 2800);
  }
  const ERR = {
    "Invalid login credentials": "E-mail ou mot de passe incorrect.",
    "Email not confirmed": "Votre e-mail n'est pas encore confirmé : cliquez sur le lien reçu par e-mail.",
    "User already registered": "Un compte existe déjà avec cet e-mail : connectez-vous.",
    "Password should be at least 6 characters.": "Le mot de passe doit faire au moins 8 caractères.",
  };
  const msgErr = (e) => ERR[e?.message] || (/rate limit/i.test(e?.message || "") ? "Trop de tentatives, réessayez dans quelques minutes." : /row-level security|permission/i.test(e?.message || "") ? "Vous n'avez pas les droits pour cette action." : e?.message || "Une erreur est survenue.");
  const ytId = (s) => { if (!s) return ""; const m = String(s).match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(s.trim()) ? s.trim() : ""; };
  const isClubAdmin = () => S.profil?.platform_admin || S.profil?.clubs.some((c) => c.club_id === S.club?.id && c.role === "admin");
  const P = () => Object.assign({ type: "equipe", rencontre: "Match", rencontres: "Matchs", effectif: "Effectifs", poste: "Poste", postes: [], classement: true }, S.club?.sports?.profil || {});

  function luminance(hex) {
    const n = parseInt(String(hex).replace("#", ""), 16) || 0;
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  function theme(c1, c2) {
    const r = document.documentElement.style;
    r.setProperty("--c1", c1); r.setProperty("--c2", c2);
    r.setProperty("--on-c1", luminance(c1) > 0.35 ? "#111" : "#fff"); r.setProperty("--on-c2", luminance(c2) > 0.35 ? "#111" : "#fff");
  }

  /* Réduit les photos avant envoi (économise l'espace de stockage) */
  async function prepareImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    const img = await createImageBitmap(file).catch(() => null);
    if (!img) return file;
    const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
    if (k === 1 && file.size < 600_000) return file;
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((r) => c.toBlob(r, type, 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name, { type }) : file;
  }
  async function upload(file) {
    const f = await prepareImage(file);
    if (f.size > 5 * 1024 * 1024) throw new Error("Image trop lourde (5 Mo maximum).");
    const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace("svg+xml", "svg");
    const path = `${S.club.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("medias").upload(path, f, { contentType: f.type, cacheControl: "31536000" });
    if (error) throw error;
    return sb.storage.from("medias").getPublicUrl(path).data.publicUrl;
  }

  /* --------------------------------------------- Champs de formulaire */
  const pad = (n) => String(n).padStart(2, "0");
  function toInput(f, v) {
    if (v == null) return f.type === "bool" ? false : "";
    switch (f.type) {
      case "datetime": { const d = new Date(v); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
      case "time": return String(v).slice(0, 5);
      case "list": return (v || []).join(", ");
      case "lines": case "joueurs": return (v || []).join("\n");
      case "planning": return (v || []).map((p) => `${p.heure} ${p.quoi}`).join("\n");
      case "poules": return (v || []).map((p) => `${p.nom} : ${(p.equipes || []).join(", ")}`).join("\n");
      default: return v;
    }
  }
  function fromInput(f, el) {
    const s = el.type === "checkbox" ? el.checked : el.value.trim();
    switch (f.type) {
      case "bool": return !!s;
      case "number": return s === "" ? null : Number(s);
      case "datetime": return s ? new Date(s).toISOString() : null;
      case "date": case "time": case "select": case "equipe": case "rencontre": return s || null;
      case "list": return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
      case "lines": case "joueurs": return s ? s.split("\n").map((x) => x.trim()).filter(Boolean) : [];
      case "planning": return s ? s.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(\d{1,2}[:h]\d{2})\s*[-–:]?\s*(.*)$/); return m ? { heure: m[1].replace("h", ":").padStart(5, "0"), quoi: m[2] } : { heure: "", quoi: l }; }) : [];
      case "poules": return s ? s.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [nom, eqs = ""] = l.split(/\s*:\s*(.*)/s); return { nom, equipes: eqs.split(",").map((x) => x.trim()).filter(Boolean) }; }) : [];
      case "youtube": return ytId(s) || null;
      default: return s === "" ? null : s;
    }
  }
  function options(f) {
    if (f.type === "equipe") return [["", f.req ? "— choisir —" : "— aucune —"], ...S.equipes.map((e) => [e.id, e.nom])];
    if (f.type === "rencontre") return [["", "— choisir —"], ...(f._rencontres || []).map((r) => [r.id, `${fmtDT(r.date)} · ${r.adversaire}${eqName(r.equipe_id) ? " (" + eqName(r.equipe_id) + ")" : ""}`])];
    return typeof f.opts === "function" ? f.opts() : f.opts;
  }
  const eqName = (id) => S.equipes.find((e) => e.id === id)?.nom || "";

  function fieldHtml(f, row) {
    const v = toInput(f, row[f.k]);
    const id = "f_" + f.k, req = f.req ? "required" : "";
    const hint = f.hint ? `<span class="hint">${f.hint}</span>` : "";
    const wrap = (inner, cls = "") => `<div class="field ${cls}" data-k="${f.k}">${inner}</div>`;
    const lab = `<label for="${id}">${esc(f.label)}${f.req ? " *" : ""}</label>`;
    switch (f.type) {
      case "bool": return wrap(`<input type="checkbox" id="${id}" name="${f.k}" ${v ? "checked" : ""}><label for="${id}">${esc(f.label)}</label>${hint}`, "check");
      case "textarea": case "lines": case "planning": case "poules":
        return wrap(`${lab}<textarea id="${id}" name="${f.k}" ${req} placeholder="${esc(f.ph || "")}">${esc(v)}</textarea>${hint}`);
      case "joueurs":
        return wrap(`${lab}<textarea id="${id}" name="${f.k}" style="min-height:160px" placeholder="Un nom par ligne">${esc(v)}</textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ghost small" data-fill="${id}">Remplir avec l'effectif de l'équipe</button></div>${hint}`);
      case "liens": {
        const lienRow = (l = {}) => `<div class="but-row lien-row"><input class="lien-label" maxlength="30" placeholder="Nom de l'onglet (ex. Licences)" value="${esc(l.label || "")}" aria-label="Nom">
          <input class="lien-url" type="url" placeholder="https://…" value="${esc(l.url || "")}" aria-label="Adresse">
          <button type="button" class="but-del" aria-label="Retirer">✕</button></div>`;
        window.__lienRow = lienRow;
        return wrap(`${lab}<div class="but-list" id="${id}">${(Array.isArray(row[f.k]) ? row[f.k] : []).map(lienRow).join("")}</div>
          <button type="button" class="btn ghost small" data-addlien="${id}">+ Ajouter un lien</button>${hint}`);
      }
      case "coachs": {
        const coachRow = (c = {}) => `<div class="but-row coach-row"><input class="coach-nom" maxlength="60" placeholder="Prénom et nom" value="${esc(c.nom || "")}" aria-label="Nom">
          <input class="coach-role" list="dl-roles" maxlength="40" placeholder="Rôle" value="${esc(c.role || "Entraîneur")}" aria-label="Rôle">
          <button type="button" class="but-del" aria-label="Retirer">✕</button></div>`;
        window.__coachRow = coachRow;
        const liste = Array.isArray(row[f.k]) && row[f.k].length ? row[f.k] : [{}];
        return wrap(`${lab}<div class="but-list" id="${id}">${liste.map(coachRow).join("")}</div>
          <button type="button" class="btn ghost small" data-addcoach="${id}">+ Ajouter un membre de l'encadrement</button>
          <datalist id="dl-roles">${["Entraîneur", "Entraîneur adjoint", "Éducateur", "Éducatrice", "Entraîneur des gardiens", "Préparateur physique", "Dirigeant", "Délégué"].map((r) => `<option value="${r}">`).join("")}</datalist>${hint}`);
      }
      case "compo": {
        const c = row[f.k] && typeof row[f.k] === "object" ? row[f.k] : {};
        const forms = P().formations || [];
        (window.__compoInit ||= {})[id] = Array.isArray(c.titulaires) ? c.titulaires : [];
        return wrap(`${lab}<div class="compo-edit" id="${id}">
          ${forms.length ? `<div class="field" style="margin-bottom:8px"><label for="${id}_sys" class="small">Système de jeu</label>
            <select id="${id}_sys" class="compo-sys">${["", ...forms].map((s) => `<option value="${s}" ${s === (c.systeme || "") ? "selected" : ""}>${s || "Liste simple (sans terrain)"}</option>`).join("")}</select></div>` : ""}
          <div class="compo-lines"></div>
          <label class="small" for="${id}_remp" style="font-weight:600">Remplaçants (un par ligne)</label>
          <textarea id="${id}_remp" class="compo-remp" rows="3" style="min-height:70px">${esc((c.remplacants || []).join("\n"))}</textarea>
          <button type="button" class="btn ghost small" data-compo-convoc="${id}" style="margin-top:6px">Proposer les convoqués comme remplaçants</button>
        </div>${hint}`);
      }
      case "buteurs": {
        const rows = (Array.isArray(row[f.k]) ? row[f.k] : []).map((b) => butRow(b, f.cle, f.max)).join("");
        return wrap(`${lab}<div class="but-list" id="${id}">${rows}</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="btn ghost small" data-addbut="${id}">+ Ajouter un ${esc(f.unit || "buteur")}</button><span class="hint" id="${id}_total"></span></div>
          ${f.k === "buteurs" ? `<datalist id="dl-joueurs"></datalist>` : ""}${hint}`);
      }
      case "select": case "equipe": case "rencontre":
        return wrap(`${lab}<select id="${id}" name="${f.k}" ${req}>${options(f).map(([o, l]) => `<option value="${esc(o)}" ${String(o) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>${hint}`);
      case "image":
        return wrap(`${lab}<input type="file" id="${id}" name="${f.k}" accept="image/*">
          <input type="hidden" name="${f.k}__cur" value="${esc(v)}">
          ${v ? `<div style="display:flex;gap:10px;align-items:end"><img class="img-prev" src="${esc(v)}" alt=""><label class="small"><input type="checkbox" name="${f.k}__del"> Retirer l'image</label></div>` : ""}${hint}`);
      case "youtube":
        return wrap(`${lab}<input id="${id}" name="${f.k}" value="${v ? "https://www.youtube.com/watch?v=" + esc(v) : ""}" placeholder="https://www.youtube.com/watch?v=…">${hint}`);
      default: {
        const t = { number: "number", date: "date", datetime: "datetime-local", time: "time", email: "email", url: "url", color: "color" }[f.type] || "text";
        return wrap(`${lab}<input type="${t}" id="${id}" name="${f.k}" value="${esc(v)}" ${req} ${f.type === "number" ? 'inputmode="numeric"' : ""} placeholder="${esc(f.ph || "")}">${hint}`);
      }
    }
  }

  function butRow(b = {}, cle = "buts", max = 15) {
    max = max || 15;
    const n = Math.min(Math.max(parseInt(b[cle], 10) || 1, 1), max);
    return `<div class="but-row"><input class="but-nom" list="dl-joueurs" placeholder="Nom du joueur" value="${esc(b.nom || "")}" aria-label="Nom">
      <select class="but-n" aria-label="Nombre" ${max === 1 ? "hidden" : ""}>${Array.from({ length: max }, (_, i) => i + 1).map((k) => `<option value="${k}" ${k === n ? "selected" : ""}>×${k}</option>`).join("")}</select>
      <button type="button" class="but-del" aria-label="Retirer">✕</button></div>`;
  }
  function readButeurs(box, cle = "buts") {
    const map = new Map();
    box.querySelectorAll(".but-row").forEach((r) => {
      const nom = r.querySelector(".but-nom").value.trim().replace(/\s+/g, " ");
      if (!nom) return;
      const key = nom.toLowerCase();
      const prev = map.get(key);
      map.set(key, { nom: prev?.nom || nom, [cle]: (prev?.[cle] || 0) + (parseInt(r.querySelector(".but-n").value, 10) || 1) });
    });
    return [...map.values()];
  }
  function bindButeurs(fields) {
    const liste = fields.filter((x) => x.type === "buteurs");
    if (!liste.length) return;
    liste.forEach((f) => {
      const box = document.getElementById("f_" + f.k);
      const total = document.getElementById("f_" + f.k + "_total");
      if (!box) return;
      const refresh = () => {
        const n = readButeurs(box, f.cle).reduce((s, b) => s + b[f.cle], 0);
        const sp = f.vsScore ? parseInt(dlgForm.elements.score_pour?.value, 10) : NaN;
        total.textContent = n ? `${n} ${f.mot}${Number.isFinite(sp) ? ` sur ${sp} but(s) marqué(s)` : ""}` : "";
        total.style.color = Number.isFinite(sp) && n > sp ? "#b42318" : "";
      };
      dlgForm.querySelector(`[data-addbut="f_${f.k}"]`).onclick = () => { box.insertAdjacentHTML("beforeend", butRow({}, f.cle, f.max)); box.lastElementChild.querySelector("input").focus(); refresh(); };
      box.addEventListener("click", (e) => { if (e.target.closest(".but-del")) { e.target.closest(".but-row").remove(); refresh(); } });
      box.addEventListener("input", refresh); box.addEventListener("change", refresh);
      dlgForm.elements.score_pour?.addEventListener("input", refresh);
      refresh();
    });
    // Suggestions : joueurs de l'équipe choisie
    const fill = async () => {
      const eid = dlgForm.elements.equipe_id?.value;
      const dl = document.getElementById("dl-joueurs");
      if (!eid) { dl.innerHTML = ""; return; }
      const { data } = await sb.from("licencies").select("nom").eq("equipe_id", eid).eq("type", "joueur").order("nom");
      dl.innerHTML = (data || []).map((j) => `<option value="${esc(j.nom)}">`).join("");
    };
    dlgForm.elements.equipe_id?.addEventListener("change", fill);
    fill();
  }

  /* Composition : un poste par case selon le système (ex. 4-3-3 → 1 gardien, 4, 3, 3) */
  const lignesSysteme = (sys) => sys ? [1, ...sys.split("-").map((n) => parseInt(n, 10) || 0)] : [];
  function nomLigne(i, nb) {
    if (i === 0) return "Gardien";
    if (nb === 2) return "Joueurs";
    if (i === 1) return "Défense";
    if (i === nb - 1) return "Attaque";
    return nb > 4 ? `Milieu ${i - 1}` : "Milieu";
  }
  function readCompo(box) {
    const sys = box.querySelector(".compo-sys")?.value || "";
    const titulaires = sys ? [...box.querySelectorAll(".compo-slot")].map((i) => i.value.trim())
      : (box.querySelector(".compo-tit")?.value || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const remplacants = (box.querySelector(".compo-remp")?.value || "").split("\n").map((s) => s.trim()).filter(Boolean);
    if (!titulaires.some(Boolean) && !remplacants.length) return {};
    return { systeme: sys, titulaires, remplacants };
  }
  function bindCompo(fields) {
    fields.filter((x) => x.type === "compo").forEach((f) => {
      const id = "f_" + f.k, box = document.getElementById(id);
      if (!box) return;
      const zone = box.querySelector(".compo-lines"), sel = box.querySelector(".compo-sys");
      const dessiner = (noms) => {
        const sys = sel?.value || "";
        if (!sys) {
          zone.innerHTML = `<label class="small" style="font-weight:600">Titulaires (un par ligne)</label><textarea class="compo-tit" rows="5" style="min-height:110px">${esc(noms.filter(Boolean).join("\n"))}</textarea>`;
          return;
        }
        const lignes = lignesSysteme(sys); let k = 0;
        zone.innerHTML = lignes.map((n, i) => `<div class="compo-ligne"><span class="compo-lbl">${nomLigne(i, lignes.length)}</span>
          <div class="compo-cases">${Array.from({ length: n }, () => `<input class="compo-slot" list="dl-joueurs" placeholder="Joueur" value="${esc(noms[k++] || "")}">`).join("")}</div></div>`).join("");
      };
      dessiner(window.__compoInit?.[id] || []);
      sel?.addEventListener("change", () => { const c = readCompo(box); dessiner(c.titulaires || []); });
      box.querySelector("[data-compo-convoc]").onclick = async () => {
        const rid = dlgForm.dataset.rowId;
        if (!rid) return toast("Enregistrez d'abord le match, puis rouvrez-le pour reprendre sa convocation.", true);
        const { data } = await sb.from("convocations").select("joueurs").eq("rencontre_id", rid).maybeSingle();
        if (!data?.joueurs?.length) return toast("Aucune convocation pour ce match.", true);
        const tit = new Set(readCompo(box).titulaires?.map((n) => n.toLowerCase()) || []);
        box.querySelector(".compo-remp").value = data.joueurs.filter((n) => !tit.has(n.trim().toLowerCase())).join("\n");
        toast("Convoqués non titulaires ajoutés en remplaçants.");
      };
    });
  }

  function applyShowIf(fields) {
    fields.filter((f) => f.showIf).forEach((f) => {
      const ctrl = dlgForm.elements[f.showIf.k];
      const el = dlgForm.querySelector(`.field[data-k="${f.k}"]`);
      if (ctrl && el) el.hidden = !f.showIf.in.includes(ctrl.value);
    });
  }

  /* Ouvre le formulaire d'ajout / modification */
  function openForm({ titre, fields, row = {}, onSave }) {
    const visibles = fields.filter((f) => !f.hide?.());
    dlgForm.innerHTML = `<h2>${esc(titre)}</h2>${visibles.map((f) => fieldHtml(f, row)).join("")}
      <p class="err" id="dlg-err" hidden></p>
      <div class="dlg-actions"><button type="button" class="btn ghost" value="cancel" id="dlg-cancel">Annuler</button><button class="btn" id="dlg-save" type="submit">Enregistrer</button></div>`;
    applyShowIf(visibles);
    dlgForm.onchange = () => applyShowIf(visibles);
    bindButeurs(visibles);
    dlgForm.dataset.rowId = row.id || "";
    dlgForm.querySelectorAll("[data-addcoach]").forEach((b) => {
      const box = document.getElementById(b.dataset.addcoach);
      b.onclick = () => { if (box.children.length >= 8) return toast("8 personnes maximum.", true); box.insertAdjacentHTML("beforeend", window.__coachRow()); box.lastElementChild.querySelector("input").focus(); };
      box.addEventListener("click", (e) => { if (e.target.closest(".but-del")) e.target.closest(".coach-row").remove(); });
    });
    bindCompo(visibles);
    dlgForm.querySelectorAll("[data-addlien]").forEach((b) => {
      const box = document.getElementById(b.dataset.addlien);
      b.onclick = () => { if (box.children.length >= 6) return toast("6 liens maximum.", true); box.insertAdjacentHTML("beforeend", window.__lienRow()); box.lastElementChild.querySelector("input").focus(); };
      box.addEventListener("click", (e) => { if (e.target.closest(".but-del")) e.target.closest(".lien-row").remove(); });
    });
    dlgForm.querySelector("#dlg-cancel").onclick = () => dlg.close();
    dlgForm.querySelectorAll("[data-fill]").forEach((b) => (b.onclick = async () => {
      const rid = dlgForm.elements.rencontre_id?.value;
      const r = visibles.find((f) => f.type === "rencontre")?._rencontres?.find((x) => x.id === rid);
      if (!r?.equipe_id) return toast("Choisissez d'abord une rencontre liée à une équipe.", true);
      const { data, error } = await sb.from("licencies").select("nom,numero").eq("equipe_id", r.equipe_id).eq("type", "joueur").order("numero");
      if (error) return toast(msgErr(error), true);
      if (!data.length) return toast("L'effectif de cette équipe est vide.", true);
      // On écarte les joueurs blessés ou suspendus à la date du match
      const jour = String(r.date).slice(0, 10);
      const { data: indispo } = await sb.from("indisponibilites").select("nom,type,date_debut,date_fin").eq("club_id", S.club.id).lte("date_debut", jour);
      const absents = new Map((indispo || []).filter((x) => !x.date_fin || x.date_fin >= jour).map((x) => [x.nom.trim().toLowerCase(), x.type]));
      const dispo = data.filter((j) => !absents.has(j.nom.trim().toLowerCase()));
      document.getElementById(b.dataset.fill).value = dispo.map((j) => j.nom).join("\n");
      const ecartes = data.filter((j) => absents.has(j.nom.trim().toLowerCase()));
      if (ecartes.length) toast(`Non convoqués car indisponibles : ${ecartes.map((j) => `${j.nom} (${absents.get(j.nom.trim().toLowerCase()) === "blessure" ? "blessé" : "suspendu"})`).join(", ")}`);
    }));
    dlgForm.onsubmit = async (ev) => {
      ev.preventDefault();
      const err = dlgForm.querySelector("#dlg-err"); err.hidden = true;
      const btn = dlgForm.querySelector("#dlg-save"); btn.disabled = true; btn.textContent = "Enregistrement…";
      try {
        const out = {};
        for (const f of visibles) {
          const wrapEl = dlgForm.querySelector(`.field[data-k="${f.k}"]`);
          if (wrapEl?.hidden) { out[f.k] = f.type === "bool" ? false : null; continue; }
          if (f.type === "liens") {
            const rows = [...document.querySelectorAll(`#f_${f.k} .lien-row`)].map((r) => ({ label: r.querySelector(".lien-label").value.trim(), url: r.querySelector(".lien-url").value.trim() }))
              .filter((l) => l.label || l.url);
            for (const l of rows) {
              if (!l.label) throw new Error("Chaque lien doit avoir un nom (ex. « Licences »).");
              if (!/^https:\/\/[^\s]+\.[^\s]+/i.test(l.url)) throw new Error(`L'adresse du lien « ${l.label} » doit commencer par https:// (copiez-la depuis la barre d'adresse du site).`);
            }
            if (rows.length > 6) throw new Error("6 liens maximum.");
            out[f.k] = rows;
            continue;
          }
          if (f.type === "coachs") {
            out[f.k] = [...document.querySelectorAll(`#f_${f.k} .coach-row`)].map((r) => ({ nom: r.querySelector(".coach-nom").value.trim().replace(/\s+/g, " "), role: r.querySelector(".coach-role").value.trim() || "Entraîneur" }))
              .filter((c) => c.nom).slice(0, 8);
            continue;
          }
          if (f.type === "compo") {
            out[f.k] = readCompo(document.getElementById("f_" + f.k));
            const tous = [...(out[f.k].titulaires || []), ...(out[f.k].remplacants || [])].filter(Boolean).map((n) => n.toLowerCase());
            const doublon = tous.find((n, i) => tous.indexOf(n) !== i);
            if (doublon) throw new Error(`Composition : « ${doublon} » apparaît deux fois.`);
            continue;
          }
          if (f.type === "buteurs") {
            out[f.k] = readButeurs(document.getElementById("f_" + f.k), f.cle);
            const sp = out.score_pour ?? fromInput({ type: "number" }, dlgForm.elements.score_pour);
            const n = out[f.k].reduce((s, b) => s + b[f.cle], 0);
            if (f.max) out[f.k].forEach((b) => { if (b[f.cle] > f.max) throw new Error(`${f.label} : ${b.nom} ne peut pas en avoir plus de ${f.max} dans un même match.`); });
            if (f.vsScore && sp != null && n > sp) throw new Error(`${f.label} : ${n} ${f.mot} alors que le score est de ${sp}. Corrigez la liste ou le score.`);
            continue;
          }
          if (f.type === "image") {
            const file = dlgForm.elements[f.k].files[0];
            out[f.k] = file ? await upload(file) : dlgForm.elements[f.k + "__del"]?.checked ? null : (dlgForm.elements[f.k + "__cur"].value || null);
            continue;
          }
          out[f.k] = fromInput(f, dlgForm.elements[f.k]);
          if (f.req && (out[f.k] == null || out[f.k] === "")) throw new Error(`Le champ « ${f.label} » est obligatoire.`);
          if (f.type === "youtube" && dlgForm.elements[f.k].value.trim() && !out[f.k]) throw new Error("Lien YouTube non reconnu.");
          if (f.validate) { const ok = f.validate(out[f.k]); if (ok !== true) throw new Error(ok); }
        }
        await onSave(out);
        dlg.close();
      } catch (e) {
        err.textContent = msgErr(e); err.hidden = false;
      } finally { btn.disabled = false; btn.textContent = "Enregistrer"; }
    };
    dlg.showModal();
  }

  /* -------------------------------------------------- Définition des onglets */
  const equipeFilter = { type: "equipe", k: "equipe_id" };
  const RES = {
    rencontres: {
      titre: () => P().rencontres, table: "rencontres", order: ["date", false], filtre: true,
      fields: () => {
        const ind = P().type === "individuel";
        return [
          { k: "equipe_id", label: ind ? "Groupe (facultatif)" : "Équipe", type: "equipe", req: !ind },
          { k: "date", label: "Date et heure", type: "datetime", req: true },
          { k: "adversaire", label: ind ? "Nom de la compétition" : "Adversaire", type: "text", req: true },
          { k: "domicile", label: "À domicile", type: "bool", hide: () => ind },
          { k: "competition", label: ind ? "Niveau (départemental, régional…)" : "Compétition", type: "text", ph: ind ? "Championnat départemental" : "Championnat, Coupe…" },
          { k: "lieu", label: "Lieu", type: "text", hint: "Laisser vide pour les matchs à domicile au stade habituel." },
          { k: "compo", label: "📋 Composition d'équipe", type: "compo", hide: () => ind || !P().compo,
            hint: "Facultatif. Peut être publiée avant le match. Les noms de l'effectif sont proposés pendant la saisie." },
          { k: "score_pour", label: `Notre score (${P().marque || "points"})`, type: "number", hide: () => ind, hint: "À remplir après la rencontre." },
          { k: "score_contre", label: "Score adverse", type: "number", hide: () => ind },
          { k: "buteurs", label: P().marqueurs || "Buteurs", type: "buteurs", cle: "buts", mot: "but(s) attribué(s)", vsScore: true, unit: (P().marqueurs || "Buteurs").toLowerCase().replace(/s$/, ""), hide: () => ind,
            hint: "Choisissez le joueur (les noms de l'effectif sont proposés) et le nombre de buts : ×1, ×2, ×3…" },
          { k: "passeurs", label: P().passeurs || "Passeurs décisifs", type: "buteurs", cle: "passes", mot: "passe(s) décisive(s)", vsScore: true, unit: "passeur", hide: () => ind || !P().passeurs,
            hint: "Le joueur qui a fait la dernière passe avant un but, et combien de fois : ×1, ×2… (facultatif)" },
          { k: "cartons_jaunes", label: "🟨 Cartons jaunes", type: "buteurs", cle: "n", max: 2, mot: "carton(s) jaune(s)", unit: "carton jaune", hide: () => ind || !P().cartons,
            hint: "Joueur averti ; ×2 si deux jaunes dans le match (facultatif)." },
          { k: "cartons_rouges", label: "🟥 Cartons rouges", type: "buteurs", cle: "n", max: 1, mot: "carton(s) rouge(s)", unit: "carton rouge", hide: () => ind || !P().cartons,
            hint: "Joueur exclu. Pensez à l'ajouter dans l'onglet « Infirmerie / suspendus » quand la suspension est connue." },
          { k: "resultat_texte", label: ind ? "Résultats (médailles, classements…)" : "Précision (facultatif)", type: ind ? "textarea" : "text", ph: ind ? "2 médailles d'or, 1 de bronze" : "Victoire aux tirs au but" },
        ];
      },
      line: (r) => [`${r.adversaire}${r.score_pour != null ? ` — ${r.score_pour} : ${r.score_contre}` : ""}`, [fmtDT(r.date), eqName(r.equipe_id), r.competition, P().type === "individuel" ? "" : r.domicile ? "Domicile" : "Extérieur"].filter(Boolean).join(" · ")],
    },
    convocations: {
      titre: () => "Convocations", table: "convocations", order: ["id", true],
      prepare: async (fields) => {
        const since = new Date(Date.now() - 7 * 864e5).toISOString();
        const { data } = await sb.from("rencontres").select("id,date,adversaire,equipe_id").eq("club_id", S.club.id).gte("date", since).order("date");
        fields.find((f) => f.type === "rencontre")._rencontres = data || [];
        S._rencs = data || [];
      },
      fields: () => [
        { k: "rencontre_id", label: P().rencontre, type: "rencontre", req: true, hint: "Créez d'abord la rencontre dans l'onglet " + P().rencontres + "." },
        { k: "rdv", label: "Heure de rendez-vous", type: "time" },
        { k: "lieu_rdv", label: "Lieu de rendez-vous", type: "text", ph: "Vestiaires, parking du stade…" },
        { k: "responsable", label: "Responsable", type: "text" },
        { k: "joueurs", label: "Convoqués", type: "joueurs" },
        { k: "remarques", label: "Consignes", type: "textarea", ph: "Tenue, covoiturage, horaires…" },
      ],
      line: (r) => { const m = (S._rencs || []).find((x) => x.id === r.rencontre_id); return [m ? `${m.adversaire}${eqName(m.equipe_id) ? " · " + eqName(m.equipe_id) : ""}` : "Rencontre passée", `${m ? fmtDT(m.date) + " · " : ""}${(r.joueurs || []).length} convoqué(s)${r.rdv ? " · RDV " + r.rdv.slice(0, 5) : ""}`]; },
    },
    licencies: {
      titre: () => P().effectif, table: "licencies", order: ["numero", true], filtre: true,
      fields: () => [
        { k: "equipe_id", label: "Équipe / groupe", type: "equipe", req: true },
        { k: "type", label: "Type", type: "select", opts: [["joueur", P().type === "individuel" ? "Licencié" : "Joueur / joueuse"], ["staff", "Encadrement"]] },
        { k: "nom", label: "Prénom et nom", type: "text", req: true },
        { k: "numero", label: "Numéro", type: "number", showIf: { k: "type", in: ["joueur"] }, hide: () => P().type !== "equipe" },
        P().postes.length
          ? { k: "poste", label: P().poste, type: "select", opts: () => [["", "—"], ...P().postes.map((p) => [p, p])], showIf: { k: "type", in: ["joueur"] } }
          : { k: "poste", label: P().poste, type: "text", showIf: { k: "type", in: ["joueur"] } },
        { k: "fonction", label: "Fonction", type: "text", ph: "Entraîneur, éducateur, dirigeant…", showIf: { k: "type", in: ["staff"] } },
        { k: "photo_url", label: "Photo", type: "image" },
        { k: "autorisation_photo", label: "Autorisation de publier la photo", type: "bool", hint: "Obligatoire pour afficher la photo. Pour un mineur : accord écrit des parents." },
      ],
      line: (r) => [`${r.numero != null ? r.numero + ". " : ""}${r.nom}`, [eqName(r.equipe_id), r.type === "staff" ? r.fonction || "Encadrement" : r.poste].filter(Boolean).join(" · ")],
      thumb: (r) => r.autorisation_photo && r.photo_url,
    },
    indisponibilites: {
      titre: () => "Infirmerie / suspendus", table: "indisponibilites", order: ["date_debut", false], filtre: true,
      help: () => "Joueurs indisponibles. Ils s'affichent sur la page Effectifs de leur équipe tant que la date de fin n'est pas passée, et sont écartés quand on remplit une convocation avec l'effectif. Données de santé : n'indiquez jamais de détail médical, et ayez l'accord du joueur (ou des parents pour un mineur).",
      fields: () => [
        { k: "equipe_id", label: "Équipe", type: "equipe", req: true },
        { k: "nom", label: "Joueur", type: "text", req: true, hint: "Écrivez le nom exactement comme dans l'effectif." },
        { k: "type", label: "Motif", type: "select", opts: [["blessure", "🩹 Blessé (infirmerie)"], ["suspension", "⛔ Suspendu"]] },
        { k: "matchs", label: "Nombre de matchs de suspension", type: "number", showIf: { k: "type", in: ["suspension"] } },
        { k: "precision", label: "Précision (facultatif, visible sur le site)", type: "text", ph: "Ex. « 3 matchs fermes » ou « reprise progressive »",
          hint: "Ne mettez pas de diagnostic ni de détail médical." },
        { k: "date_debut", label: "Depuis le", type: "date", req: true },
        { k: "date_fin", label: "Retour prévu / fin de suspension", type: "date", hint: "Laisser vide si inconnu. Après cette date, le joueur disparaît de la liste tout seul." },
      ],
      line: (r) => [`${r.type === "blessure" ? "🩹" : "⛔"} ${r.nom}`, [eqName(r.equipe_id), r.type === "blessure" ? "Blessé" : `Suspendu${r.matchs ? ` (${r.matchs} match${r.matchs > 1 ? "s" : ""})` : ""}`, r.date_fin ? `jusqu'au ${fmtD(r.date_fin)}` : "retour non fixé", r.date_fin && r.date_fin < new Date().toISOString().slice(0, 10) ? "terminé" : ""].filter(Boolean).join(" · ")],
    },
    equipes: {
      titre: () => "Équipes", table: "equipes", order: ["ordre", true],
      fields: () => [
        { k: "nom", label: "Nom", type: "text", req: true, ph: "Seniors 1, U13, Loisirs…" },
        { k: "coachs", label: "🧢 Coach(s) et encadrement", type: "coachs", hint: "Le ou les coachs de l'équipe, avec leur rôle. Ils s'affichent sur le site avec l'équipe." },
        { k: "categorie", label: "Catégorie", type: "text" },
        { k: "division", label: "Niveau / division", type: "text" },
        { k: "ordre", label: "Ordre d'affichage", type: "number", hint: "1 = en premier." },
        { k: "lien_officiel", label: "Page officielle de l'équipe", type: "url", ph: "https://epreuves.fff.fr/competition/club/…", hint: "Copiez l'adresse de la page de l'équipe sur le site de la fédération. Si vide, le bouton mène à la page du club, sinon au site de la fédération." },
        { k: "widget_code", label: "Facultatif : widget Score'n'co (affiche le classement directement sur le site)", type: "textarea", ph: "<iframe src=\"https://…scorenco.com/…\"></iframe>",
          hint: "Collez ici le code d'intégration d'un widget « Équipe » créé sur admin.scorenco.com. Seul un code venant de Score'n'co est accepté.",
          validate: (v) => !v || /https:\/\/([a-z0-9-]+\.)*scorenco\.com\//i.test(v) || "Ce code ne vient pas de Score'n'co : copiez le code d'intégration depuis admin.scorenco.com." },
      ],
      line: (r) => [r.nom, [(r.coachs || []).length ? "🧢 " + r.coachs.map((c) => c.nom).join(", ") : "Coach à renseigner", r.division, r.widget_code ? "✔ classement automatique" : r.lien_officiel ? "✔ lien officiel" : ""].filter(Boolean).join(" · ")],
    },
    classements: {
      titre: () => "Classements", table: "classements", order: ["id", true], filtre: true, hide: () => !P().classement,
      help: () => `Ce tableau n'est affiché que pour les équipes SANS page officielle (onglet Équipes) : sinon, le site renvoie vers le vrai classement de la fédération. Une ligne par équipe du championnat. Les points (${P().points?.v ?? 3} par victoire, ${P().points?.n ?? 1} par nul, ${P().points?.d ?? 0} par défaite) et l'ordre sont calculés automatiquement.`,
      fields: () => [
        { k: "equipe_id", label: "Notre équipe concernée", type: "equipe", req: true },
        { k: "equipe_nom", label: "Nom de l'équipe au classement", type: "text", req: true, hint: `Écrivez « ${S.club.nom} » pour notre club (ligne surlignée).` },
        { k: "j", label: "Joués", type: "number" }, { k: "g", label: "Gagnés", type: "number" }, { k: "n", label: "Nuls", type: "number" }, { k: "p", label: "Perdus", type: "number" },
        { k: "bp", label: `${P().marque || "Points"} pour`, type: "number" }, { k: "bc", label: `${P().marque || "Points"} contre`, type: "number" },
        { k: "bonus", label: "Points bonus / pénalités", type: "number", hint: "Ex. bonus offensif au rugby, ou -1 pour une pénalité." },
      ],
      line: (r) => [r.equipe_nom, `${eqName(r.equipe_id)} · J ${r.j} · G ${r.g} · N ${r.n} · P ${r.p}`],
    },
    evenements: {
      titre: () => "Évènements", table: "evenements", order: ["date", false],
      fields: () => [
        { k: "titre", label: "Titre", type: "text", req: true, ph: "Loto, repas, assemblée générale…" },
        { k: "date", label: "Date et heure", type: "datetime", req: true },
        { k: "type", label: "Type", type: "text", ph: "Loto, Soirée, Vie du club…" },
        { k: "lieu", label: "Lieu", type: "text" },
        { k: "description", label: "Description", type: "textarea" },
      ],
      line: (r) => [r.titre, [fmtDT(r.date), r.lieu].filter(Boolean).join(" · ")],
    },
    tournois: {
      titre: () => "Tournoi", table: "tournois", order: ["date", false],
      help: () => "Le site affiche le prochain tournoi à venir (ou le dernier passé).",
      fields: () => [
        { k: "nom", label: "Nom du tournoi", type: "text", req: true },
        { k: "edition", label: "Édition", type: "text", ph: "12e édition" },
        { k: "date", label: "Date", type: "date" },
        { k: "lieu", label: "Lieu", type: "text" },
        { k: "categories", label: "Catégories", type: "list", ph: "U9, U11, U13", hint: "Séparées par des virgules." },
        { k: "description", label: "Présentation", type: "textarea" },
        { k: "inscription_prix", label: "Tarif d'inscription", type: "text", ph: "30 € par équipe" },
        { k: "inscription_date_limite", label: "Date limite d'inscription", type: "date" },
        { k: "inscription_contact", label: "E-mail pour les inscriptions", type: "email" },
        { k: "planning", label: "Programme", type: "planning", ph: "08:30 Accueil des équipes\n09:30 Matchs de poules", hint: "Une ligne par horaire : heure puis description." },
        { k: "poules", label: "Poules", type: "poules", ph: "Poule A : Équipe 1, Équipe 2, Équipe 3", hint: "Une ligne par poule : nom, deux-points, équipes séparées par des virgules." },
        { k: "reglement", label: "Règlement", type: "lines", hint: "Un article par ligne." },
      ],
      line: (r) => [r.nom, [fmtD(r.date), r.lieu].filter(Boolean).join(" · ")],
    },
    medias: {
      titre: () => "Photos / Vidéos", table: "medias", order: ["date", false],
      help: () => "Photos : 5 Mo maximum, elles sont réduites automatiquement. Vidéos : publiez-les sur YouTube puis collez le lien ici.",
      fields: () => [
        { k: "type", label: "Type", type: "select", opts: [["photo", "Photo"], ["video", "Vidéo YouTube"]] },
        { k: "titre", label: "Titre", type: "text", req: true },
        { k: "album", label: "Album", type: "text", ph: "Seniors 1, Tournoi, Vie du club…" },
        { k: "date", label: "Date", type: "date" },
        { k: "url", label: "Photo", type: "image", showIf: { k: "type", in: ["photo"] } },
        { k: "youtube", label: "Lien de la vidéo YouTube", type: "youtube", showIf: { k: "type", in: ["video"] } },
      ],
      line: (r) => [r.titre, [r.type === "video" ? "Vidéo" : "Photo", r.album, fmtD(r.date)].filter(Boolean).join(" · ")],
      thumb: (r) => r.type === "photo" ? r.url : r.youtube ? `https://i.ytimg.com/vi/${r.youtube}/default.jpg` : "",
    },
  };
  const TABS = [["rencontres"], ["convocations"], ["licencies"], ["indisponibilites"], ["equipes"], ["classements"], ["evenements"], ["tournois"], ["medias"], ["club", "Infos du club"], ["moderateurs", "Modérateurs"]];

  /* ---------------------------------------------------------- Écrans d'accès */
  function authView(mode = "login", note = "") {
    $user.innerHTML = "";
    const titles = { login: "Connexion", signup: "Créer mon compte", forgot: "Mot de passe oublié", recovery: "Nouveau mot de passe" };
    $main.innerHTML = `<div class="card auth-card"><h1>${titles[mode]}</h1>
      ${mode === "signup" ? `<p class="muted small">Un administrateur du club doit d'abord vous avoir ajouté comme modérateur avec cette adresse e-mail.</p>` : ""}
      ${note ? `<p class="ok">${note}</p>` : ""}<p class="err" id="a-err" hidden></p>
      <form id="a-form">
        ${mode !== "recovery" ? `<div class="field"><label for="a-email">E-mail</label><input id="a-email" type="email" autocomplete="email" required></div>` : ""}
        ${mode !== "forgot" ? `<div class="field"><label for="a-pass">${mode === "login" ? "Mot de passe" : "Nouveau mot de passe (8 caractères minimum)"}</label><input id="a-pass" type="password" minlength="${mode === "login" ? 1 : 8}" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required></div>` : ""}
        <button class="btn" type="submit" style="width:100%;justify-content:center">${{ login: "Se connecter", signup: "Créer mon compte", forgot: "Recevoir un lien", recovery: "Enregistrer" }[mode]}</button>
      </form>
      <p class="small" style="margin-top:16px;display:flex;gap:14px;flex-wrap:wrap">
        ${mode !== "login" ? `<button class="linkbtn" data-m="login">J'ai déjà un compte</button>` : `<button class="linkbtn" data-m="signup">Créer mon compte</button><button class="linkbtn" data-m="forgot">Mot de passe oublié ?</button>`}
      </p><p class="small"><a href="index.html${location.search}">← Retour au site</a></p></div>`;
    $main.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => authView(b.dataset.m)));
    $main.querySelector("#a-form").onsubmit = async (e) => {
      e.preventDefault();
      const email = $main.querySelector("#a-email")?.value.trim(), password = $main.querySelector("#a-pass")?.value;
      const errEl = $main.querySelector("#a-err"); errEl.hidden = true;
      const redirect = location.origin + location.pathname + location.search;
      let r;
      if (mode === "login") r = await sb.auth.signInWithPassword({ email, password });
      else if (mode === "signup") {
        if (password.length < 8) { errEl.textContent = "Le mot de passe doit faire au moins 8 caractères."; errEl.hidden = false; return; }
        r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect, data: S.brand || {} } });
        if (!r.error) return r.data.session ? null : authView("login", "Compte créé ! Cliquez sur le lien reçu par e-mail pour l'activer, puis connectez-vous.");
      } else if (mode === "forgot") {
        r = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (!r.error) return authView("login", "Si un compte existe, un e-mail vient de vous être envoyé.");
      } else if (mode === "recovery") {
        r = await sb.auth.updateUser({ password });
        if (!r.error) { S.recovery = false; toast("Mot de passe modifié."); return boot(); }
      }
      if (r?.error) { errEl.textContent = msgErr(r.error); errEl.hidden = false; }
    };
  }

  /* --------------------------------------------------------- Démarrage */
  async function boot() {
    if (S.recovery) return authView("recovery");
    const { data: { session } } = await sb.auth.getSession();
    S.session = session;
    if (!session) {
      const slug = new URLSearchParams(location.search).get("club") || window.CONFIG.CLUB_PAR_DEFAUT;
      const { data: c } = await sb.from("clubs").select("nom,couleur1,couleur2,logo_url").eq("slug", slug).maybeSingle();
      if (c) { theme(c.couleur1, c.couleur2); S.brand = { club_nom: c.nom, club_slug: slug, club_couleur: c.couleur1, club_couleur2: c.couleur2, club_logo: c.logo_url || "" }; document.getElementById("brand").innerHTML = `${c.logo_url ? `<img class="crest crest-img" src="${esc(c.logo_url)}" alt="">` : ""}<span>${esc(c.nom)} · Modérateurs</span>`; }
      return authView("login");
    }
    $user.innerHTML = `<span>${esc(session.user.email)}</span><button id="logout">Déconnexion</button>`;
    document.getElementById("logout").onclick = async () => { await sb.auth.signOut(); location.reload(); };
    await sb.rpc("claim_invites");
    const [{ data: profil, error }, { data: sports }] = await Promise.all([sb.rpc("mon_profil"), sb.from("sports").select("id,nom,profil").order("nom")]);
    if (error) { $main.innerHTML = `<p class="err">${esc(msgErr(error))}</p>`; return; }
    S.profil = profil; S.sports = sports || [];
    let q = sb.from("clubs").select("*, sports(*)").order("nom");
    if (!profil.platform_admin) q = q.in("id", profil.clubs.map((c) => c.club_id).concat(["00000000-0000-0000-0000-000000000000"]));
    const { data: clubs } = await q;
    S.clubs = clubs || [];
    if (!S.clubs.length && !profil.platform_admin) {
      $main.innerHTML = `<div class="card auth-card"><h1>Bienvenue !</h1><p>Votre compte est bien créé, mais il n'est rattaché à aucun club pour l'instant.</p>
        <p class="muted">Demandez à l'administrateur de votre club de vous ajouter comme modérateur avec l'adresse <b>${esc(session.user.email)}</b>, puis rechargez cette page.</p></div>`;
      return;
    }
    const wanted = new URLSearchParams(location.search).get("club");
    await selectClub((S.clubs.find((c) => c.slug === wanted) || S.clubs[0])?.id);
  }

  async function selectClub(id) {
    S.club = S.clubs.find((c) => c.id === id) || null;
    if (!S.club) return renderShell();
    theme(S.club.couleur1, S.club.couleur2);
    document.title = `Modération · ${S.club.nom}`;
    await loadEquipes();
    renderShell();
  }
  async function loadEquipes() {
    const { data } = await sb.from("equipes").select("id,nom").eq("club_id", S.club.id).order("ordre");
    S.equipes = data || [];
  }

  function renderShell() {
    const c = S.club;
    const switcher = S.clubs.length > 1 ? `<select id="club-switch" class="btn ghost small" style="padding:8px">${S.clubs.map((x) => `<option value="${x.id}" ${x.id === c?.id ? "selected" : ""}>${esc(x.nom)}</option>`).join("")}</select>` : "";
    const newClub = S.profil.platform_admin ? `<button class="btn secondary small" id="new-club">+ Nouveau club</button>` : "";
    if (!c) { $main.innerHTML = `<div class="club-bar"><h1>Aucun club</h1>${newClub}</div>`; bindTop(); return; }
    const tabs = TABS.filter(([k]) => !(RES[k]?.hide?.()) && (k !== "moderateurs" || isClubAdmin()));
    if (!tabs.some(([k]) => k === S.tab)) S.tab = tabs[0][0];
    $main.innerHTML = `<div class="club-bar"><div class="who">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : ""}<div><h1>${esc(c.nom)}</h1>
      <span class="muted small">${esc(c.sports?.nom || "")} · ${isClubAdmin() ? "Administrateur" : "Modérateur"} · <a href="index.html?club=${esc(c.slug)}" target="_blank">Voir le site ↗</a></span></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${switcher}${newClub}</div></div>
      <nav class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? "active" : ""}">${esc(l || RES[k].titre())}</button>`).join("")}</nav>
      <section id="panel"></section>`;
    $main.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; renderShell(); }));
    bindTop();
    renderPanel();
  }
  function bindTop() {
    const sw = document.getElementById("club-switch");
    if (sw) sw.onchange = () => selectClub(sw.value);
    const nc = document.getElementById("new-club");
    if (nc) nc.onclick = newClubForm;
  }

  async function renderPanel() {
    const panel = document.getElementById("panel");
    if (S.tab === "club") return clubPanel(panel);
    if (S.tab === "moderateurs") return modsPanel(panel);
    const R = RES[S.tab];
    const fields = R.fields();
    if (R.prepare) await R.prepare(fields);
    let q = sb.from(R.table).select("*").eq("club_id", S.club.id).order(R.order[0], { ascending: R.order[1], nullsFirst: false });
    const f = S.filtre[S.tab];
    if (R.filtre && f) q = q.eq("equipe_id", f);
    const { data, error } = await q;
    if (error) { panel.innerHTML = `<p class="err">${esc(msgErr(error))}</p>`; return; }
    const filt = R.filtre && S.equipes.length > 1 ? `<select id="flt"><option value="">Toutes les équipes</option>${S.equipes.map((e) => `<option value="${e.id}" ${f === e.id ? "selected" : ""}>${esc(e.nom)}</option>`).join("")}</select>` : "<span></span>";
    panel.innerHTML = `${R.help ? `<div class="help">${esc(R.help())}</div>` : ""}
      <div class="toolbar">${filt}<button class="btn" id="add">+ Ajouter</button></div>
      <div class="list">${data.length ? data.map((r) => { const [a, b] = R.line(r); const th = R.thumb?.(r);
        return `<div class="item">${th ? `<img class="thumb" src="${esc(th)}" alt="">` : ""}<div class="main" style="flex:1"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>
        <div class="acts"><button class="btn ghost small" data-edit="${r.id}">Modifier</button><button class="btn ghost small" data-del="${r.id}" aria-label="Supprimer">🗑</button></div></div>`; }).join("")
        : `<div class="empty card">Rien pour l'instant. Cliquez sur « + Ajouter ».</div>`}</div>`;
    const flt = panel.querySelector("#flt");
    if (flt) flt.onchange = () => { S.filtre[S.tab] = flt.value; renderPanel(); };
    const save = (id) => async (vals) => {
      const res = id ? await sb.from(R.table).update(vals).eq("id", id) : await sb.from(R.table).insert({ ...vals, club_id: S.club.id });
      if (res.error) throw res.error;
      toast("Enregistré ✔");
      if (R.table === "equipes") await loadEquipes();
      renderPanel();
    };
    panel.querySelector("#add").onclick = () => openForm({ titre: "Ajouter · " + R.titre(), fields, row: defaults(), onSave: save(null) });
    panel.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openForm({ titre: "Modifier", fields, row: data.find((r) => r.id === b.dataset.edit), onSave: save(b.dataset.edit) })));
    panel.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Supprimer définitivement cet élément ?")) return;
      const { error } = await sb.from(R.table).delete().eq("id", b.dataset.del);
      if (error) return toast(msgErr(error), true);
      toast("Supprimé"); if (R.table === "equipes") await loadEquipes(); renderPanel();
    }));
  }
  function defaults() {
    const eq = S.filtre[S.tab] || (S.equipes.length === 1 ? S.equipes[0].id : "");
    const today = new Date().toISOString().slice(0, 10);
    return { date_debut: today, equipe_id: eq, domicile: true, type: S.tab === "medias" ? "photo" : S.tab === "indisponibilites" ? "blessure" : "joueur", equipe_nom: S.tab === "classements" ? S.club.nom : "", date: S.tab === "medias" ? new Date().toISOString().slice(0, 10) : null, ordre: 0, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, bonus: 0 };
  }

  /* --------------------------------------------------- Infos du club */
  function clubFields() {
    const pa = S.profil.platform_admin;
    return [
      { k: "nom", label: "Nom du club", type: "text", req: true },
      { k: "nom_court", label: "Nom court / sigle", type: "text" },
      { k: "sport_id", label: "Sport", type: "select", opts: () => S.sports.map((s) => [s.id, s.nom]), hide: () => !pa },
      { k: "devise", label: "Devise / slogan", type: "text" },
      { k: "fondation", label: "Année de création", type: "text" },
      { k: "ville", label: "Ville", type: "text" },
      { k: "couleur1", label: "Couleur principale", type: "color" },
      { k: "couleur2", label: "Couleur secondaire", type: "color" },
      { k: "logo_url", label: "Logo", type: "image", hint: "PNG à fond transparent de préférence." },
      { k: "stade_nom", label: "Stade / salle / boulodrome", type: "text" },
      { k: "stade_adresse", label: "Adresse", type: "text" },
      { k: "contact_email", label: "E-mail de contact", type: "email" },
      { k: "telephone", label: "Téléphone", type: "text" },
      { k: "facebook", label: "Page Facebook (lien)", type: "url", hint: "Affiche le bouton « Suivez-nous sur Facebook »." },
      { k: "instagram", label: "Instagram (lien)", type: "url" },
      { k: "liens", label: "Onglets vers d'autres sites (licences, boutique, billetterie…)", type: "liens", hide: () => !isClubAdmin(),
        hint: "Chaque lien devient un onglet du menu (6 maximum). Le premier est aussi mis en avant sur l'accueil. Exemples : « Licences » vers HelloAsso, « Boutique » vers votre boutique en ligne." },
      { k: "lien_officiel", label: "Page officielle du club (fédération)", type: "url", hint: "Ex. la page du club sur epreuves.fff.fr." },
      { k: "mode_exemple", label: "Afficher le bandeau « Site en préparation »", type: "bool" },
    ];
  }
  function clubPanel(panel) {
    const c = S.club, F = clubFields();
    panel.innerHTML = `<div class="card"><div class="toolbar"><div><b>Adresse du site :</b> <code>index.html?club=${esc(c.slug)}</code></div>
      <button class="btn" id="edit-club">Modifier les infos du club</button></div>
      <div class="list">${F.filter((f) => !f.hide?.() && f.type !== "bool").map((f) => `<div class="item"><div class="main"><span>${esc(f.label)}</span><strong>${f.type === "color" ? `<span style="display:inline-block;width:18px;height:18px;border-radius:4px;vertical-align:middle;background:${esc(c[f.k])}"></span> ` : ""}${f.type === "liens" ? (Array.isArray(c[f.k]) && c[f.k].length ? c[f.k].map((l) => `${esc(l.label)} → ${esc(l.url)}`).join("<br>") : "—") : f.type === "image" ? (c[f.k] ? `<img src="${esc(c[f.k])}" alt="" style="height:40px">` : "—") : f.k === "sport_id" ? esc(c.sports?.nom) : esc(c[f.k] || "—")}</strong></div></div>`).join("")}</div></div>`;
    panel.querySelector("#edit-club").onclick = () => openForm({
      titre: "Infos du club", fields: F, row: c, onSave: async (vals) => {
        const { data, error } = await sb.from("clubs").update(vals).eq("id", c.id).select("*, sports(*)").single();
        if (error) throw error;
        S.clubs[S.clubs.findIndex((x) => x.id === c.id)] = data; S.club = data;
        theme(data.couleur1, data.couleur2); toast("Enregistré ✔"); renderShell();
      },
    });
  }

  function newClubForm() {
    openForm({
      titre: "Nouveau club",
      fields: [
        { k: "nom", label: "Nom du club", type: "text", req: true },
        { k: "slug", label: "Identifiant dans l'adresse", type: "text", req: true, ph: "as-judo-feuquieres", hint: "Minuscules, chiffres et tirets uniquement." },
        { k: "sport_id", label: "Sport", type: "select", opts: () => S.sports.map((s) => [s.id, s.nom]) },
        { k: "couleur1", label: "Couleur principale", type: "color" },
        { k: "couleur2", label: "Couleur secondaire", type: "color" },
        { k: "admin_email", label: "E-mail de l'administrateur du club (facultatif)", type: "email", hint: "Cette personne pourra ensuite ajouter ses propres modérateurs." },
      ],
      row: { couleur1: "#1d4ed8", couleur2: "#f59e0b", sport_id: "football" },
      onSave: async ({ admin_email, ...vals }) => {
        vals.slug = String(vals.slug).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const { data, error } = await sb.from("clubs").insert(vals).select("*, sports(*)").single();
        if (error) throw /duplicate/.test(error.message) ? new Error("Cet identifiant est déjà utilisé.") : error;
        if (admin_email) await sb.from("club_invites").insert({ club_id: data.id, email: admin_email.toLowerCase(), role: "admin" });
        S.clubs.push(data); S.clubs.sort((a, b) => a.nom.localeCompare(b.nom));
        toast("Club créé ✔"); S.tab = "club"; await selectClub(data.id);
      },
    });
  }

  /* ---------------------------------------------------- Modérateurs */
  async function modsPanel(panel) {
    const [{ data: membres, error }, { data: invites }] = await Promise.all([
      sb.rpc("club_members_list", { cid: S.club.id }),
      sb.from("club_invites").select("*").eq("club_id", S.club.id).order("created_at"),
    ]);
    if (error) { panel.innerHTML = `<p class="err">${esc(msgErr(error))}</p>`; return; }
    const me = S.session.user.id;
    const roleLbl = (r) => (r === "admin" ? "Administrateur" : "Modérateur");
    panel.innerHTML = `<div class="help"><b>Modérateur</b> : peut ajouter et modifier tous les contenus du club.<br><b>Administrateur</b> : peut en plus gérer les modérateurs.<br>
      Pour ajouter quelqu'un : saisissez son e-mail ci-dessous, puis envoyez-lui l'adresse de cette page pour qu'il crée son compte avec ce même e-mail.</div>
      <div class="card" style="margin-bottom:16px"><form id="inv" class="row2" style="align-items:end">
        <div class="field"><label for="inv-email">E-mail</label><input id="inv-email" type="email" required placeholder="prenom.nom@exemple.fr"></div>
        <div class="field"><label for="inv-role">Rôle</label><select id="inv-role"><option value="moderateur">Modérateur</option><option value="admin">Administrateur</option></select></div>
        <div><button class="btn" type="submit">Ajouter</button></div></form></div>
      <h3>Membres (${membres.length})</h3>
      <div class="list">${membres.map((m) => `<div class="item"><div class="main"><strong>${esc(m.email)}${m.user_id === me ? " (vous)" : ""}</strong><span>depuis le ${fmtD(m.created_at)}</span></div>
        <div class="acts"><select data-role="${m.user_id}" ${m.user_id === me ? "disabled" : ""}><option value="moderateur" ${m.role === "moderateur" ? "selected" : ""}>Modérateur</option><option value="admin" ${m.role === "admin" ? "selected" : ""}>Administrateur</option></select>
        ${m.user_id === me ? "" : `<button class="btn ghost small" data-rm="${m.user_id}">Retirer</button>`}</div></div>`).join("") || `<div class="empty card">Aucun membre.</div>`}</div>
      ${invites?.length ? `<h3 style="margin-top:20px">En attente de création de compte (${invites.length})</h3><div class="list">${invites.map((i) => `<div class="item"><div class="main"><strong>${esc(i.email)}</strong><span>${roleLbl(i.role)} · ajouté le ${fmtD(i.created_at)}</span></div>
        <div class="acts"><button class="btn ghost small" data-rminv="${esc(i.email)}">Annuler</button></div></div>`).join("")}</div>` : ""}
      <div class="card" style="margin-top:20px"><b>Adresse à envoyer aux nouveaux modérateurs :</b><br><code style="overflow-wrap:anywhere">${esc(location.origin + location.pathname + "?club=" + S.club.slug)}</code></div>`;
    panel.querySelector("#inv").onsubmit = async (e) => {
      e.preventDefault();
      const email = panel.querySelector("#inv-email").value.trim().toLowerCase(), role = panel.querySelector("#inv-role").value;
      if (membres.some((m) => m.email?.toLowerCase() === email)) return toast("Cette personne est déjà membre.", true);
      const { error } = await sb.from("club_invites").upsert({ club_id: S.club.id, email, role });
      if (error) return toast(msgErr(error), true);
      toast("Ajouté : la personne doit maintenant créer son compte avec cet e-mail."); renderPanel();
    };
    panel.querySelectorAll("[data-role]").forEach((s) => (s.onchange = async () => {
      const { error } = await sb.from("club_members").update({ role: s.value }).eq("club_id", S.club.id).eq("user_id", s.dataset.role);
      if (error) return toast(msgErr(error), true); toast("Rôle modifié ✔");
    }));
    panel.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Retirer ce membre ? Il ne pourra plus modifier le site du club.")) return;
      const { error } = await sb.from("club_members").delete().eq("club_id", S.club.id).eq("user_id", b.dataset.rm);
      if (error) return toast(msgErr(error), true); toast("Retiré"); renderPanel();
    }));
    panel.querySelectorAll("[data-rminv]").forEach((b) => (b.onclick = async () => {
      const { error } = await sb.from("club_invites").delete().eq("club_id", S.club.id).eq("email", b.dataset.rminv);
      if (error) return toast(msgErr(error), true); renderPanel();
    }));
  }

  sb.auth.onAuthStateChange((ev) => {
    if (ev === "PASSWORD_RECOVERY") { S.recovery = true; authView("recovery"); }
    else if (ev === "SIGNED_IN" && !S.session && !S.recovery && !S.booting) boot();
  });
  const _boot = boot;
  boot = async function () { if (S.booting) return; S.booting = true; try { await _boot(); } finally { S.booting = false; } };
  boot();
})();
