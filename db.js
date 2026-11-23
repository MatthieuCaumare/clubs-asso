/* Charge un club depuis la base et le met au format attendu par app.js */
(async function () {
  const { SUPABASE_URL, SUPABASE_KEY, CLUB_PAR_DEFAUT } = window.CONFIG;
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const slug = new URLSearchParams(location.search).get("club") || CLUB_PAR_DEFAUT;
  const app = document.getElementById("app");

  try {
    const { data: club, error } = await sb.from("clubs").select("*, sports(*)").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!club) { app.innerHTML = `<div class="wrap empty">Club introuvable.</div>`; return; }

    const q = (t, order = "id") => sb.from(t).select("*").eq("club_id", club.id).order(order);
    const [eq, lic, ren, conv, cla, evt, tour, med] = await Promise.all([
      q("equipes", "ordre"), q("licencies", "ordre"), q("rencontres", "date"), q("convocations"),
      q("classements"), q("evenements", "date"), q("tournois", "date"), q("medias", "date"),
    ]);
    for (const r of [eq, lic, ren, conv, cla, evt, tour, med]) if (r.error) throw r.error;

    const T = tour.data.find((t) => !t.date || new Date(t.date) >= new Date(Date.now() - 864e5)) || tour.data[tour.data.length - 1];
    const classements = {};
    cla.data.forEach((r) => (classements[r.equipe_id] ||= []).push({ equipe: r.equipe_nom, j: r.j, g: r.g, n: r.n, p: r.p, bp: r.bp, bc: r.bc, bonus: r.bonus }));

    window.startSite({
      id: club.id, slug: club.slug,
      nom: club.nom, nomCourt: club.nom_court, devise: club.devise || "", fondation: club.fondation, ville: club.ville,
      exemple: club.mode_exemple,
      lienOfficiel: club.lien_officiel || "",
      // Liens externes choisis par le club (licences, boutique, billetterie…), uniquement en https
      liens: (Array.isArray(club.liens) ? club.liens : []).filter((l) => l && l.label && /^https:\/\//i.test(l.url || "")).slice(0, 6),
      sport: { id: club.sport_id, nom: club.sports.nom, ...club.sports.profil },
      couleurs: { principale: club.couleur1, secondaire: club.couleur2 },
      logo: club.logo_url,
      stade: { nom: club.stade_nom || "", adresse: club.stade_adresse || "" },
      contact: { email: club.contact_email, telephone: club.telephone, facebook: club.facebook, instagram: club.instagram },
      equipes: eq.data.map((e) => ({
        id: e.id, nom: e.nom, categorie: e.categorie || "", division: e.division || "",
        lienOfficiel: e.lien_officiel || "", widget: e.widget_code || "",
        staff: lic.data.filter((l) => l.equipe_id === e.id && l.type === "staff").map((l) => ({ nom: l.nom, role: l.fonction || "Encadrant" })),
        joueurs: lic.data.filter((l) => l.equipe_id === e.id && l.type === "joueur")
          .map((l) => ({ num: l.numero, nom: l.nom, poste: l.poste || "", photo: l.autorisation_photo ? l.photo_url : "" })),
      })),
      matchs: ren.data.map((m) => ({
        id: m.id, equipe: m.equipe_id, date: m.date, adversaire: m.adversaire, domicile: m.domicile,
        competition: m.competition || "", lieu: m.lieu,
        score: m.score_pour != null && m.score_contre != null ? { pour: m.score_pour, contre: m.score_contre } : null,
        resultat: m.resultat_texte || "",
        buteurs: Array.isArray(m.buteurs) ? m.buteurs.filter((b) => b && b.nom) : [],
        passeurs: Array.isArray(m.passeurs) ? m.passeurs.filter((b) => b && b.nom) : [],
      })),
      convocations: conv.data.map((c) => ({ match: c.rencontre_id, rdv: c.rdv || "", lieuRdv: c.lieu_rdv || "", responsable: c.responsable || "", joueurs: c.joueurs || [], remarques: c.remarques })),
      classements,
      evenements: evt.data.map((e) => ({ date: e.date, titre: e.titre, type: e.type || "", lieu: e.lieu || "", description: e.description || "" })),
      tournoi: T ? {
        nom: T.nom, edition: T.edition || "", date: T.date, lieu: T.lieu || "", categories: T.categories || [],
        description: T.description || "",
        inscription: { dateLimite: T.inscription_date_limite, prix: T.inscription_prix || "", contact: T.inscription_contact || club.contact_email || "" },
        poules: T.poules || [], planning: T.planning || [], reglement: T.reglement || [],
      } : null,
      medias: med.data.slice().reverse().map((m) => ({ type: m.type, titre: m.titre, album: m.album || "", date: m.date, src: m.url || "", youtube: m.youtube || "" })),
    });
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="wrap empty">Impossible de charger le site pour le moment. Réessayez dans quelques instants.</div>`;
  }
})();
