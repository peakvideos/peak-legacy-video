/**
 * Brand-styled CSS used to wrap email bodies. Lives in a non-server-only
 * module so both the server-side renderer and the client-side preview pane
 * can reach for it. Keep this in sync with the email design.
 */

export const EMAIL_BASE_CSS = `
  body, .wrap { font-family: 'Cardo', Georgia, serif; color: #1a1a1a; line-height: 1.7; }
  body { margin: 0; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
  .wrap p, .wrap li, .wrap span, .wrap strong, .wrap em { color: #1a1a1a; }
  .wrap h1, .wrap h2, .wrap h3 { font-family: 'Alata', sans-serif; color: #233415; }
  .wrap a { color: #233415; }
  .wrap blockquote { border-left: 3px solid #93A888; padding-left: 12px; color: #597B7E; margin: 12px 0; }
  .wrap ul, .wrap ol { padding-left: 20px; }
  .wrap p { margin: 0.6em 0; }
`.replace(/\s+/g, " ");
