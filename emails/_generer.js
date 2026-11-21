const fs = require("fs");
const v = (k, def) => `{{ if .Data.${k} }}{{ .Data.${k} }}{{ else }}${def}{{ end }}`;
const C1 = v("club_couleur", "#20569a"), C2 = v("club_couleur2", "#f48218"), NOM = v("club_nom", "votre club");
const layout = ({ preheader, titre, intro, bouton, apres, note }) => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${titre}</title></head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;color:#1a1d1a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.08);">
  <tr><td style="background:${C1};padding:28px 24px 22px;text-align:center;border-bottom:6px solid ${C2};">
    {{ if .Data.club_logo }}<img src="{{ .Data.club_logo }}" width="84" height="84" alt="" style="display:block;margin:0 auto 12px;width:84px;height:84px;border-radius:50%;background:#ffffff;border:3px solid #ffffff;object-fit:contain;">{{ end }}
    <div style="font-size:22px;font-weight:bold;letter-spacing:.5px;text-transform:uppercase;color:#ffffff;">${NOM}</div>
    <div style="font-size:13px;color:#ffffff;opacity:.85;margin-top:4px;">Espace modérateurs</div>
  </td></tr>
  <tr><td style="padding:32px 32px 8px;">
    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:${C1};">${titre}</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">${intro}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 24px;"><tr>
      <td style="border-radius:10px;background:${C1};border-bottom:4px solid ${C2};"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${bouton}</a></td>
    </tr></table>
    ${apres ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;">${apres}</p>` : ""}
    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5e655e;">Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :</p>
    <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:${C1};">{{ .ConfirmationURL }}</a></p>
  </td></tr>
  <tr><td style="padding:16px 32px 28px;border-top:1px solid #e2e5e0;">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#7a817a;">${note}</p>
  </td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#9aa09a;text-align:center;">Message automatique envoyé à {{ .Email }} — merci de ne pas y répondre.</p>
</td></tr></table>
</body></html>
`;
const mails = {
  "1-confirmation-inscription.html": {
    sujet: "Confirmez votre adresse e-mail",
    preheader: "Plus qu'une étape pour accéder à l'espace modérateurs.",
    titre: "Bienvenue dans l'équipe ! 👋",
    intro: `Votre compte pour l'espace modérateurs de <b>${NOM}</b> est presque prêt. Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail.`,
    bouton: "Confirmer mon adresse e-mail",
    apres: "Vous pourrez ensuite publier les matchs, résultats, convocations, évènements et photos du club.",
    note: "Ce lien est valable 24 heures. Si vous n'avez pas demandé à créer de compte, ignorez simplement ce message : aucun compte ne sera activé.",
  },
  "2-mot-de-passe-oublie.html": {
    sujet: "Réinitialisation de votre mot de passe",
    preheader: "Choisissez un nouveau mot de passe pour l'espace modérateurs.",
    titre: "Mot de passe oublié ?",
    intro: `Vous avez demandé à changer le mot de passe de votre compte modérateur de <b>${NOM}</b>. Cliquez ci-dessous pour en choisir un nouveau.`,
    bouton: "Choisir un nouveau mot de passe",
    apres: "",
    note: "Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste inchangé.",
  },
  "3-changement-email.html": {
    sujet: "Confirmez votre nouvelle adresse e-mail",
    preheader: "Validez le changement d'adresse de votre compte modérateur.",
    titre: "Nouvelle adresse e-mail",
    intro: `Vous avez demandé à utiliser l'adresse <b>{{ .NewEmail }}</b> pour votre compte modérateur de <b>${NOM}</b>. Confirmez ce changement ci-dessous.`,
    bouton: "Confirmer le changement",
    apres: "",
    note: "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message et prévenez l'administrateur de votre club.",
  },
  "4-lien-de-connexion.html": {
    sujet: "Votre lien de connexion",
    preheader: "Connectez-vous à l'espace modérateurs en un clic.",
    titre: "Connexion à l'espace modérateurs",
    intro: `Cliquez sur le bouton ci-dessous pour vous connecter à l'espace modérateurs de <b>${NOM}</b>.`,
    bouton: "Me connecter",
    apres: "",
    note: "Ce lien ne peut servir qu'une fois et expire rapidement. Si vous n'avez rien demandé, ignorez ce message.",
  },
};
let sujets = "# Sujets des e-mails (à coller dans Supabase)\n\n";
for (const [f, m] of Object.entries(mails)) { fs.writeFileSync("emails/" + f, layout(m)); sujets += `- ${f} : ${m.sujet}\n`; }
// sujets : voir INSTALLATION.md
// aperçu avec des valeurs remplies
const demo = (s) => s.replace(/\{\{ if \.Data\.club_logo \}\}([\s\S]*?)\{\{ end \}\}/g, "$1").replace(/\{\{ if \.Data\.(\w+) \}\}([\s\S]*?)\{\{ else \}\}[\s\S]*?\{\{ end \}\}/g, (_, k, a) => a)
  .replace(/\{\{ if \.Data\.club_logo \}\}([\s\S]*?)\{\{ end \}\}/g, "$1")
  .replace(/\{\{ \.Data\.club_nom \}\}/g, "US Nibas-Fressenneville").replace(/\{\{ \.Data\.club_couleur \}\}/g, "#20569a").replace(/\{\{ \.Data\.club_couleur2 \}\}/g, "#f48218")
  .replace(/\{\{ \.Data\.club_logo \}\}/g, "https://media.scorenco.com/fit-in/512x512/media/image/club-logo-1756529507.124214.png")
  .replace(/\{\{ \.ConfirmationURL \}\}/g, "https://exemple.supabase.co/auth/v1/verify?token=abc123").replace(/\{\{ \.Email \}\}/g, "prenom.nom@exemple.fr").replace(/\{\{ \.NewEmail \}\}/g, "nouvelle@exemple.fr");
fs.writeFileSync("emails/_apercu-confirmation.html", demo(fs.readFileSync("emails/1-confirmation-inscription.html", "utf8")));
console.log(fs.readdirSync("emails"));
