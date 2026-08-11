type MailLayoutInput = {
  title: string
  preheader: string
  children: string
}

type MailHeaderInput = {
  eyebrow: string
}

type MailHeadingInput = {
  headline: string
  body: string
}

type MailButtonInput = {
  label: string
  href: string
}

type MailInfoBoxInput = {
  items: Array<{label: string; value: string}>
}

type MailSecurityNoticeInput = {
  text: string
}

type MailFooterInput = {
  supportEmail: string
  securityEmail: string
  privacyUrl: string
  accountUrl: string
}

export function MailLayout(input: MailLayoutInput): string {
  const title = escapeHtml(input.title)
  const preheader = escapeHtml(input.preheader)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${title}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        body { background:#111111 !important; color:#f5f5f5 !important; }
        .modula-shell { background:#111111 !important; }
        .modula-panel { background:#181818 !important; border-color:#333333 !important; }
        .modula-muted { color:#b8b8b8 !important; }
        .modula-link { color:#f5f5f5 !important; }
        .modula-button { background:#f5f5f5 !important; color:#111111 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f4f2ef;color:#171717;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}&#8204;&#160;&#8204;&#160;&#8204;&#160;&#8204;&#160;&#8204;&#160;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="modula-shell" style="width:100%;background:#f4f2ef;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="modula-panel" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #dedad2;border-radius:10px;">
            <tr>
              <td style="padding:28px 24px 24px;">
                ${input.children}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function MailHeader(input: MailHeaderInput): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 24px;">
  <tr>
    <td style="font-size:18px;line-height:1;font-weight:700;letter-spacing:0;color:#171717;">Modula</td>
    <td align="right" class="modula-muted" style="font-size:12px;line-height:1.4;color:#6d6a64;">${escapeHtml(input.eyebrow)}</td>
  </tr>
</table>`
}

export function MailHeading(input: MailHeadingInput): string {
  return `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:0;color:#171717;">${escapeHtml(input.headline)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#2b2a27;">${escapeHtml(input.body)}</p>`
}

export function MailButton(input: MailButtonInput): string {
  const href = escapeAttribute(input.href)
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
  <tr>
    <td>
      <a class="modula-button" href="${href}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:1.2;border-radius:8px;padding:13px 18px;">${escapeHtml(input.label)}</a>
    </td>
  </tr>
</table>`
}

export function MailFallbackLink(input: MailButtonInput): string {
  return `<p class="modula-muted" style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#6d6a64;">If the button does not work, <a class="modula-link" href="${escapeAttribute(input.href)}" style="color:#171717;text-decoration:underline;">open the secure Modula link in your browser</a>.</p>`
}

export function MailInfoBox(input: MailInfoBoxInput): string {
  if (!input.items.length) return ''
  const rows = input.items
    .map(
      item => `<tr>
  <td class="modula-muted" style="padding:8px 0;font-size:12px;line-height:1.4;color:#6d6a64;text-transform:uppercase;">${escapeHtml(item.label)}</td>
  <td align="right" style="padding:8px 0;font-size:14px;line-height:1.4;color:#2b2a27;">${escapeHtml(item.value)}</td>
</tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 20px;border-top:1px solid #e6e1d8;border-bottom:1px solid #e6e1d8;">
${rows}
</table>`
}

export function MailSecurityNotice(input: MailSecurityNoticeInput): string {
  return `<p class="modula-muted" style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#6d6a64;">${escapeHtml(input.text)}</p>`
}

export function MailFooter(input: MailFooterInput): string {
  const support = escapeHtml(input.supportEmail)
  const security = escapeHtml(input.securityEmail)
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-top:1px solid #e6e1d8;padding-top:18px;">
  <tr>
    <td class="modula-muted" style="font-size:12px;line-height:1.6;color:#77736c;">
      Modula<br>
      Support: <a class="modula-link" href="mailto:${support}" style="color:#171717;text-decoration:underline;">${support}</a><br>
      Security: <a class="modula-link" href="mailto:${security}" style="color:#171717;text-decoration:underline;">${security}</a><br>
      <a class="modula-link" href="${escapeAttribute(input.privacyUrl)}" style="color:#171717;text-decoration:underline;">Privacy</a> &middot;
      <a class="modula-link" href="${escapeAttribute(input.accountUrl)}" style="color:#171717;text-decoration:underline;">Account</a>
    </td>
  </tr>
</table>`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}
