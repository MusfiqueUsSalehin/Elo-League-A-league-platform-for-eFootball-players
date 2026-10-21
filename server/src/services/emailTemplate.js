const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Makes text safe to place inside HTML, so a name like <script> shows up as text. */
export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);

// A subject with a line break could be used to add extra mail headers.
const oneLine = (value) =>
  String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

const isAppPath = (link) =>
  typeof link === 'string' && link.startsWith('/') && !link.startsWith('//');

const FOOTER = (appName) =>
  `You can choose which emails you get under Notifications in ${appName}.`;

/** Builds the subject, HTML and plain text of a notification email. Every value is escaped. */
export function renderEmail({ appName, clientUrl, title, body = '', link = '' }) {
  const url = isAppPath(link) ? `${clientUrl}${link}` : '';
  const paragraph = escapeHtml(body).replace(/\r?\n/g, '<br />');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#16201b">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
      <p style="margin:0 0 16px;font-size:13px;color:#5d6e64">${escapeHtml(appName)}</p>
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(title)}</h1>
      ${paragraph ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${paragraph}</p>` : ''}
      ${url ? `<p style="margin:0 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#ffd24a;color:#0b1410;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px">Open in ${escapeHtml(appName)}</a></p>` : ''}
      <p style="margin:0;font-size:12px;color:#8a998f">${escapeHtml(FOOTER(appName))}</p>
    </div>
  </body>
</html>`;

  const text = [title, body, url, FOOTER(appName)].filter(Boolean).join('\n\n');

  return { subject: oneLine(title).slice(0, 200), html, text };
}
