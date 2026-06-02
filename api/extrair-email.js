// ============================================
// API SERVERLESS - EXTRAIR EMAIL DE SITE
// Versao v8
// Caminho correto: /api/extrair-email.js
// ============================================

const API_VERSION = 'v8-email-site-2026-06-01';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.query.version === '1') return res.status(200).json({ ok: true, version: API_VERSION });

  try {
    const url = String(req.query.url || '').trim();
    if (!url) return res.status(400).json({ found: false, error: 'URL obrigatoria', version: API_VERSION });
    const baseUrl = normalizarUrl(url);
    if (!baseUrl) return res.status(400).json({ found: false, error: 'URL invalida', version: API_VERSION });
    const urlsParaTentar = montarUrls(baseUrl); const emailsEncontrados = [];
    for (const tentativa of urlsParaTentar) { const html = await baixarHtml(tentativa); if (!html) continue; const emails = extrairEmails(html); emailsEncontrados.push(...emails); if (emailsEncontrados.length > 0) break; }
    const filtrados = filtrarEmails(emailsEncontrados);
    if (filtrados.length === 0) return res.status(404).json({ found: false, message: 'Email nao encontrado no site', url: baseUrl, version: API_VERSION });
    return res.status(200).json({ found: true, email: escolherMelhorEmail(filtrados), todosEmails: Array.from(new Set(filtrados)).slice(0, 10), fonte: 'Site do lead', url: baseUrl, version: API_VERSION });
  } catch (error) {
    return res.status(500).json({ found: false, error: 'Erro ao extrair email', message: error.message, version: API_VERSION });
  }
}
function normalizarUrl(url) { try { let u = url; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return new URL(u).origin; } catch { return null; } }
function montarUrls(baseUrl) { return ['/', '/contato', '/contato/', '/fale-conosco', '/fale-conosco/', '/sobre', '/atendimento'].map(c => baseUrl + c); }
async function baixarHtml(url) { const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000); try { const response = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 LeadGeneratorBot/1.0', 'Accept': 'text/html,application/xhtml+xml' }, signal: controller.signal }); clearTimeout(timeout); if (!response.ok) return null; const contentType = response.headers.get('content-type') || ''; if (!contentType.includes('text/html')) return null; return await response.text(); } catch { clearTimeout(timeout); return null; } }
function extrairEmails(html) { return html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []; }
function filtrarEmails(emails) { const blacklist = ['example@','teste@','test@','noreply@','no-reply@','wordpress@','wix@','sentry','cloudflare','schema.org','dominio.com','john@doe','privacy@','abuse@']; return Array.from(new Set(emails)).map(e => e.trim().toLowerCase()).filter(email => email.includes('@') && !blacklist.some(b => email.includes(b))); }
function escolherMelhorEmail(emails) { const prioridades = ['comercial','vendas','contato','atendimento','sac','info','administrativo','adm']; return emails.find(email => prioridades.some(p => email.includes(p))) || emails[0]; }
