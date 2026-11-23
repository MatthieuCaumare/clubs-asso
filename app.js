/* Moteur du site public — tout le contenu vient de la base (voir db.js) */
window.startSite = function (C) {
  "use strict";
  const app = document.getElementById("app");
  const P = Object.assign({ type: "equipe", rencontre: "Match", rencontres: "Matchs", effectif: "Effectifs", poste: "Poste", postes: [], points: { v: 3, n: 1, d: 0 }, classement: true }, C.sport || {});
  const individuel = P.type === "individuel";

  /* ------------------------------------------------------------ Outils */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const d = (s) => new Date(s);
  const fmtLong = (s) => d(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fmtHeure = (s) => d(s).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  const now = new Date();
  const equipe = (id) => C.equipes.find((e) => e.id === id);
  const initiales = (nom) => nom.split(/[\s-]+/).filter((w) => w.length > 2 || /^[A-Z]{2,}$/.test(w)).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  const isUs = (nom) => nom === C.nom;
  const plural = (n, s) => `${n} ${s}${n > 1 ? "s" : ""}`;

  function luminance(hex) {
    const n = parseInt(String(hex).replace("#", ""), 16) || 0;
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  const onColor = (hex) => (luminance(hex) > 0.35 ? "#111" : "#fff");

  const root = document.documentElement.style;
  root.setProperty("--c1", C.couleurs.principale);
  root.setProperty("--c2", C.couleurs.secondaire);
  root.setProperty("--on-c1", onColor(C.couleurs.principale));
  root.setProperty("--on-c2", onColor(C.couleurs.secondaire));
  let favicon = document.querySelector("link[rel=icon]");
  if (C.logo) { favicon = favicon || document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" })); favicon.href = C.logo; }

  function crest() {
    if (C.logo) return `<img class="crest crest-img" src="${esc(C.logo)}" alt="Logo ${esc(C.nom)}">`;
    const ini = esc(C.nomCourt || initiales(C.nom));
    const c1 = esc(C.couleurs.principale), c2 = esc(C.couleurs.secondaire);
    return `<svg class="crest" viewBox="0 0 100 116" role="img" aria-label="Blason ${esc(C.nom)}">
      <path d="M50 3 L95 15 V55 C95 85 74 104 50 113 C26 104 5 85 5 55 V15 Z" fill="${c2}"/>
      <path d="M50 10 L88 20 V55 C88 80 70 97 50 105 C30 97 12 80 12 55 V20 Z" fill="${c1}"/>
      <path d="M50 10 L88 20 V55 C88 80 70 97 50 105 Z" fill="${c2}" opacity=".18"/>
      <text x="50" y="62" text-anchor="middle" font-family="Oswald, Arial Narrow, sans-serif" font-weight="700" font-size="${ini.length > 3 ? 22 : 28}" fill="${c2}">${ini}</text>
      <text x="50" y="84" text-anchor="middle" font-family="Oswald, Arial Narrow, sans-serif" font-size="11" fill="${c2}" opacity=".9">${esc(C.fondation || "")}</text>
    </svg>`;
  }
  const opp = (nom) => `<span class="opp" aria-hidden="true">${esc(initiales(nom))}</span>`;
  const fbIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V10.5H8v3h2.4V21z"/></svg>`;
  const igIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`;
  const cameraSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/></svg>`;
  const silhouette = `<svg class="silhouette" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="7" r="4.5"/><path d="M3 23c0-5.5 4-9 9-9s9 3.5 9 9z"/></svg>`;
  const fbButton = (cls = "") => C.contact.facebook ? `<a class="btn-fb ${cls}" href="${esc(C.contact.facebook)}" target="_blank" rel="noopener">${fbIcon}<span>Suivez-nous sur Facebook</span></a>` : "";

  /* ------------------------------------------------------- Composants */
  const pages = [
    ["accueil", "Accueil"], ["convocations", "Convocations"], ["effectifs", P.effectif], ["matchs", P.rencontres],
    ["resultats", "Résultats"], ["evenements", "Évènements"], ["tournoi", "Tournoi"], ["medias", "Photos / Vidéos"],
  ];

  const pageHead = (titre, sousTitre) => `<section class="page-head"><div class="wrap"><h1>${esc(titre)}</h1>${sousTitre ? `<p>${esc(sousTitre)}</p>` : ""}</div></section>`;

  function dateBox(s) {
    const x = d(s);
    return `<div class="datebox"><div class="w">${x.toLocaleDateString("fr-FR", { weekday: "short" })}</div><div class="d">${x.getDate()}</div><div class="m">${x.toLocaleDateString("fr-FR", { month: "short" })}</div></div>`;
  }

  function teamChips(page, current, ids, withAll = true) {
    const list = ids ? C.equipes.filter((e) => ids.includes(e.id)) : C.equipes;
    if (list.length < 2 && !withAll) return "";
    const all = withAll ? `<a class="chip ${!current ? "active" : ""}" href="#/${page}">Toutes</a>` : "";
    return `<div class="chips">${all}${list.map((e) => `<a class="chip ${current === e.id ? "active" : ""}" href="#/${page}?equipe=${e.id}">${esc(e.nom)}</a>`).join("")}</div>`;
  }

  const resultClass = (m) => !m.score ? "" : m.score.pour > m.score.contre ? "win" : m.score.pour < m.score.contre ? "loss" : "draw";

  const RES_LBL = { win: "Victoire", draw: "Nul", loss: "Défaite" };
  const buteursTxt = (m) => (m.buteurs || []).map((b) => `${esc(b.nom)}${b.buts > 1 ? ` <b>×${b.buts}</b>` : ""}`).join(", ");

  // Carte de match « tableau de score » : une ligne par équipe, score aligné à droite
  function matchCard(m) {
    const eq = equipe(m.equipe);
    const joue = !!m.score;
    const rc = resultClass(m);
    const lieu = m.lieu || (m.domicile ? C.stade.nom : "");
    const hasConv = !joue && C.convocations.some((c) => c.match === m.id);
    const dateTxt = d(m.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    const top = `<div class="m-top"><span class="m-date">${esc(dateTxt)} · ${fmtHeure(m.date)}</span>
      ${eq ? `<span class="tag alt">${esc(eq.nom)}</span>` : ""}
      <span class="m-comp">${[m.competition, individuel ? "" : m.domicile ? "Domicile" : "Extérieur"].filter(Boolean).map(esc).join(" · ")}</span></div>`;

    if (individuel) {
      return `<article class="card match2">${top}
        <div class="m-rows"><div class="m-row us"><span class="m-name">${esc(m.adversaire)}</span></div>
        ${m.resultat ? `<div class="m-buteurs">🏅 ${esc(m.resultat)}</div>` : ""}</div>
        <div class="m-foot">${lieu ? `<span>📍 ${esc(lieu)}</span>` : ""}${hasConv ? `<a href="#/convocations?match=${m.id}">Voir la convocation →</a>` : ""}</div></article>`;
    }

    const usRow = { us: true, nom: C.nom, logo: crest(), score: m.score?.pour };
    const themRow = { us: false, nom: m.adversaire, logo: opp(m.adversaire), score: m.score?.contre };
    const rows = m.domicile ? [usRow, themRow] : [themRow, usRow];
    const lead = joue && m.score.pour !== m.score.contre ? (m.score.pour > m.score.contre ? usRow : themRow) : null;
    const row = (r) => `<div class="m-row ${r.us ? "us" : ""} ${lead === r ? "lead" : ""}">${r.logo}<span class="m-name">${esc(r.nom)}</span>${joue ? `<span class="m-score">${r.score}</span>` : ""}</div>`;
    const but = joue && m.buteurs?.length ? `<div class="m-buteurs"><span class="m-lbl">${esc(P.marqueurs || "Buteurs")}</span> ${buteursTxt(m)}</div>` : "";
    return `<article class="card match2 ${rc}">${top}
      <div class="m-rows">${rows.map(row).join("")}${m.resultat ? `<div class="m-note">${esc(m.resultat)}</div>` : ""}${but}</div>
      <div class="m-foot">${lieu ? `<span>📍 ${esc(lieu)}</span>` : ""}
        ${hasConv ? `<a href="#/convocations?match=${m.id}">Voir la convocation →</a>` : ""}
        ${rc ? `<span class="res-badge ${rc}">${RES_LBL[rc]}</span>` : ""}</div></article>`;
  }

  const today = new Date(now.toDateString());
  const estJoue = (m) => m.score || m.resultat || (individuel && d(m.date) < today);
  const aVenir = () => C.matchs.filter((m) => !estJoue(m) && d(m.date) >= today).sort((a, b) => d(a.date) - d(b.date));
  const joues = () => C.matchs.filter(estJoue).sort((a, b) => d(b.date) - d(a.date));

  function eventCard(e) {
    return `<article class="card event ${d(e.date) < now ? "past" : ""}">${dateBox(e.date)}<div>
      ${e.type ? `<span class="tag">${esc(e.type)}</span>` : ""}
      <h3 style="margin-top:8px">${esc(e.titre)}</h3>
      <p class="muted small" style="margin:0 0 6px">${esc(fmtLong(e.date))} · ${fmtHeure(e.date)}${e.lieu ? " · " + esc(e.lieu) : ""}</p>
      <p style="margin:0;white-space:pre-line">${esc(e.description)}</p></div></article>`;
  }

  function mediaTile(m, i) {
    const visual = m.type === "photo" && m.src ? `<img src="${esc(m.src)}" alt="${esc(m.titre)}" loading="lazy">`
      : m.type === "video" && m.youtube ? `<img src="https://i.ytimg.com/vi/${esc(m.youtube)}/hqdefault.jpg" alt="${esc(m.titre)}" loading="lazy">`
      : `<div class="ph" style="background:linear-gradient(${(i * 47) % 360}deg, var(--c1), color-mix(in srgb, var(--c1) 55%, var(--c2)))">${m.type === "photo" ? cameraSvg : ""}</div>`;
    return `<button class="media-item" data-media="${i}">${visual}${m.type === "video" ? `<span class="play"></span>` : ""}
      <span class="cap"><strong>${esc(m.titre)}</strong><span>${esc(m.album)}${m.date ? " · " + d(m.date).toLocaleDateString("fr-FR") : ""}</span></span></button>`;
  }

  const empty = (txt) => `<div class="empty card">${txt}</div>`;

  /* ---------------------------------------- Classement des buteurs */
  // Calculé à partir des buteurs saisis dans les matchs de la saison en cours (depuis le 1er juillet)
  const debutSaison = new Date(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1, 6, 1);
  const LBL_BUT = P.marqueurs || "Buteurs";
  function classementButeurs(eqId) {
    const map = new Map();
    C.matchs.filter((m) => m.equipe === eqId && m.score && d(m.date) >= debutSaison).forEach((m) => {
      (m.buteurs || []).forEach((b) => {
        const nom = String(b.nom || "").trim().replace(/\s+/g, " ");
        if (!nom) return;
        const k = nom.toLowerCase();
        const cur = map.get(k) || { nom, buts: 0, matchs: 0 };
        cur.buts += Math.max(parseInt(b.buts, 10) || 1, 1); cur.matchs += 1;
        map.set(k, cur);
      });
    });
    const rows = [...map.values()].sort((a, b) => b.buts - a.buts || a.matchs - b.matchs || a.nom.localeCompare(b.nom));
    rows.forEach((r, i) => { r.rang = i && r.buts === rows[i - 1].buts ? rows[i - 1].rang : i + 1; });
    return rows;
  }
  function buteursCard(eq, max = 0) {
    const rows = classementButeurs(eq.id);
    if (!rows.length) return "";
    const shown = max ? rows.slice(0, max) : rows;
    const medal = (r) => r.rang === 1 ? "🥇" : r.rang === 2 ? "🥈" : r.rang === 3 ? "🥉" : r.rang;
    return `<div class="card buteurs-card" style="padding:0;overflow:hidden">
      <div class="buteurs-head"><h3 style="margin:0">${esc(LBL_BUT)} · ${esc(eq.nom)}</h3><span class="muted small">Saison ${debutSaison.getFullYear()}–${debutSaison.getFullYear() + 1}</span></div>
      <div class="table-wrap"><table class="buteurs-table"><thead><tr><th>#</th><th>Joueur</th><th>Buts</th><th>Matchs</th></tr></thead><tbody>
      ${shown.map((r) => `<tr class="${r.rang === 1 ? "top" : ""}"><td>${medal(r)}</td><td>${esc(r.nom)}</td><td class="pts">${r.buts}</td><td>${r.matchs}</td></tr>`).join("")}
      </tbody></table></div>
      ${max && rows.length > max ? `<p class="small" style="margin:0;padding:10px 16px"><a href="#/resultats?equipe=${eq.id}">Voir le classement complet →</a></p>` : ""}</div>`;
  }
  function sectionButeurs(eqId) {
    if (individuel) return "";
    const eqs = eqId ? [equipe(eqId)].filter(Boolean) : C.equipes;
    const cards = eqs.map((e) => buteursCard(e, eqId ? 0 : 5)).filter(Boolean);
    const titre = `<div class="section-title"><h2>Classement des ${esc(LBL_BUT.toLowerCase())}</h2></div>`;
    if (!cards.length) {
      return C.matchs.some((m) => m.score) || eqId
        ? `<section class="section" style="padding-top:0"><div class="wrap">${titre}${empty(`Le classement se remplit tout seul dès que le club publie ses scores avec les ${esc(LBL_BUT.toLowerCase())}.`)}</div></section>` : "";
    }
    return `<section class="section" style="padding-top:0"><div class="wrap">${titre}<div class="grid ${eqId ? "" : "grid-2"}">${cards.join("")}</div></div></section>`;
  }

  /* ------------------------------------- Données officielles (widgets) */
  // Seul du code venant de Score'n'co est accepté ; tout le reste est ignoré.
  const okHost = (u) => { try { const x = new URL(u, "https://x.invalid"); return x.protocol === "https:" && (x.hostname === "scorenco.com" || x.hostname.endsWith(".scorenco.com")); } catch { return false; } };
  function buildWidget(code, target) {
    const doc = new DOMParser().parseFromString(String(code || ""), "text/html");
    const ifr = [...doc.querySelectorAll("iframe[src]")].find((f) => okHost(f.getAttribute("src")));
    if (ifr) {
      const f = document.createElement("iframe");
      f.src = ifr.getAttribute("src");
      f.title = "Classement et calendrier officiels";
      f.loading = "lazy";
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      const h = parseInt(ifr.getAttribute("height"), 10);
      f.style.cssText = `width:100%;border:0;min-height:${h > 100 && h < 3000 ? h : 640}px`;
      target.appendChild(f);
      return true;
    }
    const scripts = [...doc.querySelectorAll("script[src]")].filter((s) => okHost(s.getAttribute("src")));
    if (!scripts.length) return false;
    doc.body.querySelectorAll("div, ins, section").forEach((el) => {
      if (el.closest("script")) return;
      const n = document.createElement(el.tagName.toLowerCase());
      for (const a of el.attributes) if (a.name === "id" || a.name === "class" || a.name.startsWith("data-")) n.setAttribute(a.name, a.value);
      target.appendChild(n);
    });
    scripts.forEach((s) => { const n = document.createElement("script"); n.src = s.getAttribute("src"); n.async = true; target.appendChild(n); });
    return true;
  }
  function mountWidgets() {
    app.querySelectorAll("[data-widget]").forEach((box) => {
      const eq = equipe(box.dataset.widget);
      if (!eq || !buildWidget(eq.widget, box)) box.remove();
    });
  }
  // Lien officiel : celui de l'équipe, sinon celui du club, sinon le site de la fédération du sport
  const FED = P.federation || null;
  const fedNom = FED?.nom ? `le site officiel (${FED.nom})` : "le site officiel";
  const lienEquipe = (eq) => eq?.lienOfficiel || C.lienOfficiel || FED?.url || "";
  const extLink = (url, label, cls = "btn ghost-btn") => url ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span></a>` : "";
  function officielEquipe(eq) {
    if (!eq) return "";
    const url = lienEquipe(eq);
    if (!url && !eq.widget) return "";
    return `<div class="card officiel"><div class="officiel-head"><div><h3 style="margin:0">Calendrier & classement officiels · ${esc(eq.nom)}</h3>
      <p class="muted small" style="margin:4px 0 0">${eq.lienOfficiel ? "Page officielle de l'équipe" : C.lienOfficiel ? "Page officielle du club" : "Site de la fédération"}${FED?.nom ? " · " + esc(FED.nom) : ""}</p></div>
      ${extLink(url, "Voir le classement officiel", "btn")}</div>
      ${!eq.widget && eq.lienOfficiel ? `<p class="small" style="margin:0">Le classement et le calendrier de cette équipe sont tenus à jour par la fédération : ils s'ouvrent sur son site officiel.</p>` : ""}
      ${eq.widget ? `<div class="widget-box" data-widget="${eq.id}"></div><p class="muted small" style="margin:8px 0 0">Mis à jour automatiquement à partir des données de la fédération.</p>` : ""}</div>`;
  }
  function officielListe(page) {
    if (!C.equipes.some((e) => lienEquipe(e) || e.widget)) return "";
    return `<div class="card officiel"><div class="officiel-head"><div><h3 style="margin:0">Calendriers & classements officiels</h3>
      <p class="muted small" style="margin:4px 0 0">Les données à jour, directement sur ${esc(fedNom)}.</p></div>
      ${extLink(C.lienOfficiel || FED?.url, "Page du club")}</div>
      <div class="team-links">${C.equipes.map((e) => e.widget
        ? `<a class="team-link" href="#/${page}?equipe=${e.id}"><b>${esc(e.nom)}</b><span>${esc(e.division || "Classement")}</span></a>`
        : lienEquipe(e) ? `<a class="team-link" href="${esc(lienEquipe(e))}" target="_blank" rel="noopener"><b>${esc(e.nom)} <span aria-hidden="true">↗</span></b><span>${esc(e.division || "Calendrier et classement")}</span></a>` : "").join("")}</div></div>`;
  }

  /* ------------------------------------------------------------ Pages */
  const render = {
    accueil() {
      const next = aVenir()[0];
      let nextHtml = "";
      if (next) {
        const eq = equipe(next.equipe);
        const usBlock = `<div>${crest()}<div class="name">${esc(C.nom)}</div></div>`;
        const themBlock = `<div>${opp(next.adversaire)}<div class="name">${esc(next.adversaire)}</div></div>`;
        const hasConv = C.convocations.some((c) => c.match === next.id);
        nextHtml = `<div class="next-match">
          <div class="top"><span>Prochain${P.rencontre === "Compétition" || P.rencontre === "Rencontre" ? "e" : ""} ${esc(P.rencontre.toLowerCase())}${eq ? " · " + esc(eq.nom) : ""}</span><span>${esc(next.competition)}</span></div>
          ${individuel
            ? `<div class="body" style="grid-template-columns:1fr"><div><div class="name">${esc(next.adversaire)}</div><div class="when">${fmtHeure(next.date)}</div><div class="muted small">${esc(fmtLong(next.date))}</div></div></div>`
            : `<div class="body">${next.domicile ? usBlock : themBlock}<div><div class="when">${fmtHeure(next.date)}</div><div class="muted small">${esc(fmtLong(next.date))}</div></div>${next.domicile ? themBlock : usBlock}</div>`}
          <div class="foot"><span class="muted small">📍 ${esc(next.lieu || C.stade.nom)}</span>${hasConv ? `<a class="btn secondary" href="#/convocations?match=${next.id}">Convocation</a>` : `<a class="btn secondary" href="#/matchs">Tout le calendrier</a>`}</div>
        </div>`;
      }
      const events = C.evenements.filter((e) => d(e.date) >= now).slice(0, 2);
      const res = joues().slice(0, 4), up = aVenir().slice(1, 5);
      const T = C.tournoi;
      return `
        <section class="hero"><div class="wrap hero-inner">${crest()}<div>
          <h1>${esc(C.nom)}</h1>${C.devise ? `<p>${esc(C.devise)}</p>` : ""}
          <div class="hero-actions">${C.fondation ? `<span class="since">Depuis ${esc(C.fondation)}</span>` : ""}<span class="since">${esc(C.sport.nom || "")} · ${plural(C.equipes.length, "équipe")}</span>${(C.liens || [])[0] ? `<a class="btn secondary" href="${esc(C.liens[0].url)}" target="_blank" rel="noopener">${esc(C.liens[0].label)} ↗</a>` : ""}${fbButton("on-hero")}</div>
        </div></div></section>
        <div class="wrap">${nextHtml}</div>
        ${!res.length && !up.length && officielListe("resultats") ? `<section class="section"><div class="wrap">${officielListe("resultats")}</div></section>` : ""}
        ${res.length ? `<section class="section"><div class="wrap">
          <div class="section-title"><h2>Derniers résultats</h2><a href="#/resultats">Tous les résultats →</a></div>
          <div class="grid grid-2">${res.map(matchCard).join("")}</div></div></section>` : ""}
        ${up.length ? `<section class="section" style="padding-top:${res.length ? 0 : 32}px"><div class="wrap">
          <div class="section-title"><h2>À venir</h2><a href="#/matchs">Calendrier complet →</a></div>
          <div class="grid grid-2">${up.map(matchCard).join("")}</div></div></section>` : ""}
        ${events.length ? `<section class="section" style="padding-top:0"><div class="wrap">
          <div class="section-title"><h2>Évènements</h2><a href="#/evenements">Voir tout →</a></div>
          <div class="grid grid-2">${events.map(eventCard).join("")}</div></div></section>` : ""}
        ${T ? `<section class="section" style="padding-top:0"><div class="wrap">
          <div class="card" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;border-left:6px solid var(--c2)">
            <div>${T.edition ? `<span class="tag">${esc(T.edition)}</span>` : ""}<h3 style="margin:8px 0 4px">${esc(T.nom)}</h3>
            <p class="muted" style="margin:0">${T.date ? esc(fmtLong(T.date)) : "Date à venir"}${T.categories.length ? " · " + esc(T.categories.join(", ")) : ""}</p></div>
            <a class="btn" href="#/tournoi">Découvrir le tournoi</a></div></div></section>` : ""}
        ${C.contact.facebook ? `<section class="section" style="padding-top:0"><div class="wrap"><div class="fb-band">
          <div><h3 style="margin:0 0 4px">Toute l'actu du club en direct</h3><p style="margin:0;opacity:.9">Photos, résultats du week-end, annonces : rejoignez-nous sur Facebook.</p></div>
          ${fbButton()}</div></div></section>` : ""}`;
    },

    convocations(q) {
      let list = C.convocations.map((c) => ({ ...c, m: C.matchs.find((m) => m.id === c.match) }))
        .filter((c) => c.m && !estJoue(c.m) && d(c.m.date) >= today).sort((a, b) => d(a.m.date) - d(b.m.date));
      const ids = [...new Set(list.map((c) => c.m.equipe))];
      if (q.equipe) list = list.filter((c) => c.m.equipe === q.equipe);
      if (q.match) list = list.filter((c) => c.match === q.match);
      const body = list.length ? list.map((c) => {
        const eq = equipe(c.m.equipe);
        const titre = individuel ? c.m.adversaire : `${C.nomCourt || C.nom} ${c.m.domicile ? "reçoit" : "se déplace à"} ${c.m.adversaire}`;
        return `<article class="card" style="margin-bottom:20px">
          <div class="match-meta">${eq ? `<span class="tag alt">${esc(eq.nom)}</span>` : ""}${c.m.competition ? `<span class="tag ghost">${esc(c.m.competition)}</span>` : ""}${individuel ? "" : `<span class="tag ghost">${c.m.domicile ? "Domicile" : "Extérieur"}</span>`}</div>
          <h2 style="font-size:1.4rem;margin:8px 0 4px">${esc(titre)}</h2>
          <p class="muted" style="margin:0">${esc(fmtLong(c.m.date))} · début ${fmtHeure(c.m.date)} · ${esc(c.m.lieu || C.stade.nom)}</p>
          <div class="convoc">
            <div>
              ${c.rdv ? `<div class="rdv">Rendez-vous<strong>${esc(c.rdv.slice(0, 5).replace(":", "h"))}</strong>${esc(c.lieuRdv)}</div>` : ""}
              ${c.responsable ? `<p class="small" style="margin:0 0 8px"><b>Responsable :</b> ${esc(c.responsable)}</p>` : ""}
              ${c.remarques ? `<div class="notice">${esc(c.remarques)}</div>` : ""}
            </div>
            <div><h3 style="margin-top:12px">Convoqués (${c.joueurs.length})</h3><ol>${c.joueurs.map((j) => `<li>${esc(j)}</li>`).join("")}</ol></div>
          </div>
        </article>`;
      }).join("") : empty("Aucune convocation publiée pour le moment.");
      const chips = ids.length ? `<div class="chips"><a class="chip ${!q.equipe && !q.match ? "active" : ""}" href="#/convocations">Toutes</a>${C.equipes.filter((e) => ids.includes(e.id)).map((e) => `<a class="chip ${q.equipe === e.id ? "active" : ""}" href="#/convocations?equipe=${e.id}">${esc(e.nom)}</a>`).join("")}</div>` : "<div></div>";
      return pageHead("Convocations", "Les convoqués pour les prochaines rencontres") +
        `<section class="section"><div class="wrap">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:flex-start">${chips}
            ${list.length ? `<button class="btn secondary no-print" onclick="window.print()">🖨 Imprimer</button>` : ""}</div>${body}</div></section>`;
    },

    effectifs(q) {
      if (!C.equipes.length) return pageHead(P.effectif) + `<section class="section"><div class="wrap">${empty("Bientôt en ligne.")}</div></section>`;
      const eq = equipe(q.equipe) || C.equipes[0];
      const ordre = P.postes.length ? P.postes : [];
      const groupes = ordre.map((p) => [p, eq.joueurs.filter((j) => j.poste === p)]);
      const autres = eq.joueurs.filter((j) => !ordre.includes(j.poste));
      if (autres.length) groupes.push([ordre.length ? "Autres" : P.effectif, autres]);
      const sortJ = (a, b) => (a.num ?? 999) - (b.num ?? 999) || a.nom.localeCompare(b.nom);
      const saison = now.getMonth() >= 6 ? `${now.getFullYear()}–${now.getFullYear() + 1}` : `${now.getFullYear() - 1}–${now.getFullYear()}`;
      return pageHead(P.effectif, `Saison ${saison}`) +
        `<section class="section"><div class="wrap">
          ${teamChips("effectifs", eq.id, null, false)}
          <div class="card" style="display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;align-items:center">
            <div><h2 style="margin:0">${esc(eq.nom)}</h2><p class="muted" style="margin:0">${[eq.categorie, eq.division, plural(eq.joueurs.length, individuel ? "licencié" : "joueur")].filter(Boolean).map(esc).join(" · ")}</p></div>
            ${extLink(lienEquipe(eq), "Calendrier & classement officiels")}
            <div style="display:flex;gap:20px;flex-wrap:wrap">${eq.staff.length ? "" : `<span class="muted small">Encadrement à compléter</span>`}${eq.staff.map((s) => `<div><div class="small muted">${esc(s.role)}</div><strong>${esc(s.nom)}</strong></div>`).join("")}</div>
          </div>
          ${groupes.filter(([, js]) => js.length).map(([p, js]) => `<h3 class="poste-title">${esc(p)}</h3><div class="grid grid-4">${js.sort(sortJ).map((j) => `
            <div class="player"><div class="photo">${j.photo ? `<img src="${esc(j.photo)}" alt="${esc(j.nom)}" loading="lazy">` : silhouette}${j.num != null ? `<span class="num">${j.num}</span>` : ""}</div>
            <div class="info"><strong>${esc(j.nom)}</strong><span class="muted small">${esc(j.poste)}</span></div></div>`).join("")}</div>`).join("")}
          ${eq.joueurs.length ? "" : `<div class="empty card" style="margin-top:20px">L'effectif de cette équipe sera bientôt publié.</div>`}
          ${individuel ? "" : (() => { const c = buteursCard(eq, 5); return c ? `<h3 class="poste-title">Meilleurs ${esc(LBL_BUT.toLowerCase())}</h3>${c}` : ""; })()}
        </div></section>`;
    },

    matchs(q) {
      const list = aVenir().filter((m) => !q.equipe || m.equipe === q.equipe);
      const off = C.equipes.some((e) => lienEquipe(e));
      return pageHead(P.rencontres, off ? "Le calendrier officiel de chaque équipe, et les rendez-vous publiés par le club" : "Le calendrier des prochaines dates") +
        `<section class="section"><div class="wrap">${C.equipes.length > 1 ? teamChips("matchs", q.equipe) : ""}
        ${q.equipe ? officielEquipe(equipe(q.equipe)) : officielListe("matchs")}
        ${list.length ? `<div class="section-title"><h2>${off ? "Publiés par le club" : "À venir"}</h2></div><div class="grid grid-2">${list.map(matchCard).join("")}</div>`
          : empty(off ? "Le club n'a pas encore publié de rencontre ici : consultez le calendrier officiel ci-dessus." : "Rien de programmé pour le moment.")}</div></section>`;
    },

    resultats(q) {
      const list = joues().filter((m) => !q.equipe || m.equipe === q.equipe);
      const pts = P.points || { v: 3, n: 1, d: 0 };
      // Le tableau saisi à la main n'est affiché que si l'équipe n'a pas de source officielle (lien ou widget)
      const tableIds = P.classement ? Object.keys(C.classements).filter((id) => equipe(id) && !equipe(id).widget && !equipe(id).lienOfficiel) : [];
      const tables = (q.equipe ? tableIds.filter((id) => id === q.equipe) : tableIds).map((id) => {
        const rows = C.classements[id].map((r) => ({ ...r, pts: r.g * pts.v + r.n * pts.n + r.p * pts.d + (r.bonus || 0), diff: r.bp - r.bc }))
          .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.bp - a.bp);
        return `<div class="card" style="padding:0;overflow:hidden;margin-bottom:20px">
          <div style="padding:14px 16px"><h3 style="margin:0">Classement ${esc(equipe(id).nom)}</h3><span class="muted small">${esc(equipe(id).division)}</span></div>
          <div class="table-wrap"><table><thead><tr><th>#</th><th>Équipe</th><th>Pts</th><th>J</th><th>G</th><th>N</th><th>P</th><th>+</th><th>−</th><th>Diff</th></tr></thead><tbody>
          ${rows.map((r, i) => `<tr class="${isUs(r.equipe) ? "us" : ""}"><td>${i + 1}</td><td>${esc(r.equipe)}</td><td class="pts">${r.pts}</td><td>${r.j}</td><td>${r.g}</td><td>${r.n}</td><td>${r.p}</td><td>${r.bp}</td><td>${r.bc}</td><td>${r.diff > 0 ? "+" : ""}${r.diff}</td></tr>`).join("")}
          </tbody></table></div></div>`;
      }).join("");
      const b = list.reduce((a, m) => (m.score && a[resultClass(m)]++, a), { win: 0, draw: 0, loss: 0 });
      const off = C.equipes.some((e) => lienEquipe(e));
      const sous = off ? "Résultats et classements officiels de chaque équipe, et les scores avec buteurs publiés par le club"
        : individuel ? `${list.length} résultat(s)` : `${plural(b.win, "victoire")} · ${plural(b.draw, "nul")} · ${plural(b.loss, "défaite")}`;
      return pageHead("Résultats", sous) +
        `<section class="section"><div class="wrap">${C.equipes.length > 1 ? teamChips("resultats", q.equipe) : ""}
          ${q.equipe ? officielEquipe(equipe(q.equipe)) : officielListe("resultats")}
          ${list.length ? `<div class="section-title"><h2>${off ? "Publiés par le club" : "Derniers résultats"}</h2></div><div class="grid grid-2">${list.map(matchCard).join("")}</div>`
            : empty(off ? "Le club n'a pas encore publié de score ici : consultez les résultats officiels ci-dessus." : "Aucun résultat pour le moment.")}
        </div></section>
        ${sectionButeurs(q.equipe)}
        ${tables ? `<section class="section" style="padding-top:0"><div class="wrap"><div class="section-title"><h2>Classements</h2></div>${tables}</div></section>` : ""}`;
    },

    evenements() {
      const up = C.evenements.filter((e) => d(e.date) >= now).sort((a, b) => d(a.date) - d(b.date));
      const past = C.evenements.filter((e) => d(e.date) < now).sort((a, b) => d(b.date) - d(a.date));
      return pageHead("Évènements", "La vie du club : venez nombreux !") +
        `<section class="section"><div class="wrap"><div class="section-title"><h2>À venir</h2></div>
          ${up.length ? `<div class="grid grid-2">${up.map(eventCard).join("")}</div>` : empty("Pas d'évènement prévu pour le moment.")}
        </div></section>
        ${past.length ? `<section class="section" style="padding-top:0"><div class="wrap"><div class="section-title"><h2>Passés</h2></div><div class="grid grid-2">${past.map(eventCard).join("")}</div></div></section>` : ""}`;
    },

    tournoi() {
      const T = C.tournoi;
      if (!T) return pageHead("Tournoi") + `<section class="section"><div class="wrap">${empty("Les informations du prochain tournoi arrivent bientôt.")}</div></section>`;
      const contact = T.inscription.contact;
      return `<section class="tournoi-hero"><div class="wrap">
          ${T.edition ? `<span class="tag alt">${esc(T.edition)}</span>` : ""}
          <h1 style="margin-top:10px">${esc(T.nom)}</h1>
          ${T.description ? `<p style="max-width:640px;margin:8px 0 0">${esc(T.description)}</p>` : ""}
          <div class="facts">
            <div class="fact">Date<b>${T.date ? esc(fmtLong(T.date)) : "À venir"}</b></div>
            ${T.lieu ? `<div class="fact">Lieu<b>${esc(T.lieu)}</b></div>` : ""}
            ${T.categories.length ? `<div class="fact">Catégories<b>${esc(T.categories.join(" · "))}</b></div>` : ""}
          </div>
        </div></section>
        <section class="section"><div class="wrap grid grid-2" style="align-items:start">
          ${T.planning.length ? `<div class="card"><h2 style="font-size:1.3rem">Programme</h2><ul class="timeline">${T.planning.map((p) => `<li><b>${esc(String(p.heure).replace(":", "h"))}</b><span>${esc(p.quoi)}</span></li>`).join("")}</ul></div>` : ""}
          <div class="grid">
            <div class="card" style="border-top:6px solid var(--c2)"><h2 style="font-size:1.3rem">Inscriptions</h2>
              ${T.inscription.prix ? `<p style="margin:0 0 4px"><b>Tarif :</b> ${esc(T.inscription.prix)}</p>` : ""}
              ${T.inscription.dateLimite ? `<p style="margin:0 0 14px"><b>Date limite :</b> ${esc(fmtLong(T.inscription.dateLimite))}</p>` : ""}
              ${contact ? `<a class="btn" href="mailto:${esc(contact)}?subject=${encodeURIComponent("Inscription " + T.nom)}">Inscrire une équipe</a>` : C.contact.facebook ? `<a class="btn" href="${esc(C.contact.facebook)}" target="_blank" rel="noopener">Nous contacter sur Facebook</a>` : ""}</div>
            ${T.reglement.length ? `<div class="card"><h2 style="font-size:1.3rem">Règlement</h2><ul style="margin:0;padding-left:1.2em">${T.reglement.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>` : ""}
          </div>
        </div></section>
        ${T.poules.length ? `<section class="section" style="padding-top:0"><div class="wrap">
          <div class="section-title"><h2>Poules</h2></div>
          <div class="grid grid-4">${T.poules.map((p) => `<div class="card poule"><h3>${esc(p.nom)}</h3><ul>${(p.equipes || []).map((e) => `<li class="${isUs(e) ? "us" : ""}">${isUs(e) ? crest().replace('class="crest', 'style="width:22px;height:22px" class="crest') : opp(e).replace('class="opp"', 'class="opp" style="width:22px;height:22px;font-size:.55rem"')}${esc(e)}</li>`).join("")}</ul></div>`).join("")}</div>
        </div></section>` : ""}`;
    },

    medias(q) {
      const type = q.type || "";
      const items = C.medias.map((m, i) => [m, i]).filter(([m]) => !type || m.type === type);
      const chip = (t, l) => `<a class="chip ${type === t ? "active" : ""}" href="#/medias${t ? "?type=" + t : ""}">${l}</a>`;
      return pageHead("Photos & Vidéos", "Les meilleurs moments du club") +
        `<section class="section"><div class="wrap">
          <div class="chips">${chip("", "Tout")}${chip("photo", "Photos")}${chip("video", "Vidéos")}</div>
          ${items.length ? `<div class="grid grid-3">${items.map(([m, i]) => mediaTile(m, i)).join("")}</div>` : empty("Aucun média pour le moment.")}
          ${C.contact.facebook ? `<p style="text-align:center;margin-top:24px">${fbButton()}</p>` : ""}
        </div></section>`;
    },
  };

  /* ---------------------------------------------------------- Lightbox */
  const lb = document.getElementById("lightbox"), lbc = document.getElementById("lightbox-content");
  function openMedia(i) {
    const m = C.medias[i];
    let html;
    if (m.type === "video" && m.youtube) html = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(m.youtube)}?autoplay=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="${esc(m.titre)}"></iframe>`;
    else if (m.type === "photo" && m.src) html = `<img src="${esc(m.src)}" alt="${esc(m.titre)}">`;
    else html = `<div class="ph-big" style="background:linear-gradient(135deg,var(--c1),color-mix(in srgb,var(--c1) 55%,var(--c2)))"><div><b>${m.type === "video" ? "Vidéo" : "Photo"} bientôt disponible</b></div></div>`;
    lbc.innerHTML = `${html}<p style="margin:12px 0 0"><b>${esc(m.titre)}</b> <span style="opacity:.7">· ${esc(m.album)}</span></p>`;
    lb.hidden = false;
  }
  const closeMedia = () => { lb.hidden = true; lbc.innerHTML = ""; };
  document.getElementById("lightbox-close").onclick = closeMedia;
  lb.addEventListener("click", (e) => { if (e.target === lb) closeMedia(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closeMedia(); });
  app.addEventListener("click", (e) => { const t = e.target.closest("[data-media]"); if (t) openMedia(+t.dataset.media); });

  /* -------------------------------------------------- En-tête & routeur */
  document.getElementById("brand").innerHTML = `${crest()}<span>${esc(C.nom)}</span>`;
  const social = document.getElementById("social");
  social.innerHTML = (C.contact.facebook ? `<a class="social-btn" href="${esc(C.contact.facebook)}" target="_blank" rel="noopener" aria-label="Page Facebook du club" title="Facebook">${fbIcon}</a>` : "")
    + (C.contact.instagram ? `<a class="social-btn" href="${esc(C.contact.instagram)}" target="_blank" rel="noopener" aria-label="Instagram du club" title="Instagram">${igIcon}</a>` : "");
  const nav = document.getElementById("nav");
  const extNav = C.liens || [];
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  nav.innerHTML = pages.map(([id, l]) => `<a href="#/${id}" data-page="${id}">${esc(l)}</a>`).join("")
    + extNav.map((x) => `<a class="nav-ext" href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.label)} (s'ouvre sur ${esc(host(x.url))})">${esc(x.label)} <span aria-hidden="true">↗</span></a>`).join("");
  const burger = document.getElementById("burger");
  burger.onclick = () => { const o = nav.classList.toggle("open"); burger.setAttribute("aria-expanded", o); };

  document.getElementById("footer").innerHTML = `<div class="wrap"><div class="footer-grid">
    <div><h3>${esc(C.nom)}</h3>${C.devise ? `<p>${esc(C.devise)}</p>` : ""}${C.fondation ? `<p>Fondé en ${esc(C.fondation)}</p>` : ""}</div>
    ${C.stade.nom || C.stade.adresse ? `<div><h3>Installations</h3><p>${esc(C.stade.nom)}</p><p>${esc(C.stade.adresse)}</p></div>` : ""}
    ${extNav.length ? `<div><h3>Liens du club</h3>${extNav.map((x) => `<p><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)} ↗</a></p>`).join("")}</div>` : ""}
    <div><h3>Contact</h3>${C.contact.email ? `<p><a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a></p>` : ""}${C.contact.telephone ? `<p>${esc(C.contact.telephone)}</p>` : ""}
      ${C.contact.facebook ? `<p><a href="${esc(C.contact.facebook)}" target="_blank" rel="noopener">Facebook</a></p>` : ""}${C.contact.instagram ? `<p><a href="${esc(C.contact.instagram)}" target="_blank" rel="noopener">Instagram</a></p>` : ""}</div>
    </div><div class="copy">© ${now.getFullYear()} ${esc(C.nom)} · <a href="admin.html?club=${esc(C.slug)}">Espace modérateurs</a></div></div>`;

  function route() {
    const [path, qs] = (location.hash.replace(/^#\/?/, "") || "accueil").split("?");
    const page = render[path] ? path : "accueil";
    const q = Object.fromEntries(new URLSearchParams(qs || ""));
    app.innerHTML = (C.exemple ? `<div class="demo-banner">Site en préparation : certains contenus affichés sont des exemples.</div>` : "") + render[page](q);
    mountWidgets();
    nav.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
    nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false");
    document.title = `${pages.find((p) => p[0] === page)[1]} · ${C.nom}`;
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
};
