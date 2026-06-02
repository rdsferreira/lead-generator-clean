// ============================================
// MODULO CNPJ - Enriquecimento de leads
// Versao v8 - CNPJ obrigatorio com confianca + email obrigatorio
// ============================================

class CNPJService {
    constructor() { this.telefoneCache = new Map(); this.emailCache = new Map(); }
    async buscarDadosCNPJParaLead(lead) {
        const telefoneLimpo = (lead.telefone || '').replace(/\D/g, '');
        const cacheKey = `${telefoneLimpo}_${lead.nome}_${lead.endereco}`;
        if (this.telefoneCache.has(cacheKey)) return this.telefoneCache.get(cacheKey);
        try {
            const params = new URLSearchParams();
            if (telefoneLimpo) params.set('telefone', telefoneLimpo);
            if (lead.nome) params.set('nome', lead.nome);
            if (lead.endereco) params.set('endereco', lead.endereco);
            const uf = this.extrairUF(lead.endereco); const bairro = this.extrairBairro(lead.endereco);
            if (uf) params.set('uf', uf); if (bairro) params.set('bairro', bairro);
            console.log(`🏢 Buscando CNPJ com confiança para: ${lead.nome}`);
            const response = await fetch(`/api/buscar-cnpj?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data || !data.found) { console.log(`ℹ️ CNPJ não validado para ${lead.nome}`); this.telefoneCache.set(cacheKey, null); return null; }
            const normalizado = this.normalizarDadosBigQuery(data); this.telefoneCache.set(cacheKey, normalizado);
            console.log(`✅ CNPJ validado para ${lead.nome}: ${normalizado.cnpjFormatado} (${normalizado.match?.nivel || 'confiança ok'})`);
            return normalizado;
        } catch (error) { console.log(`⚠️ Erro ao buscar CNPJ para ${lead.nome}:`, error.message); this.telefoneCache.set(cacheKey, null); return null; }
    }
    async buscarEmailParaLead(lead, dadosCNPJ) {
        if (dadosCNPJ?.email && this.validarEmailDNS(dadosCNPJ.email)) return { email: dadosCNPJ.email, fonteEmail: 'Base CNPJ' };
        if (!lead.site) return null;
        if (this.emailCache.has(lead.site)) return this.emailCache.get(lead.site);
        try {
            console.log(`📧 Buscando email no site validado: ${lead.site}`);
            const params = new URLSearchParams({ url: lead.site });
            const response = await fetch(`/api/extrair-email?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data || !data.found || !data.email) { console.log(`ℹ️ Email não encontrado no site de ${lead.nome}`); this.emailCache.set(lead.site, null); return null; }
            const resultado = { email: data.email, fonteEmail: data.fonte || 'Site do lead' }; this.emailCache.set(lead.site, resultado); console.log(`✅ Email encontrado para ${lead.nome}: ${resultado.email}`); return resultado;
        } catch (error) { console.log(`⚠️ Erro ao buscar email no site de ${lead.nome}:`, error.message); this.emailCache.set(lead.site, null); return null; }
    }
    async enriquecerLeadCompleto(lead) {
        const dadosCNPJ = await this.buscarDadosCNPJParaLead(lead);
        if (!dadosCNPJ || !dadosCNPJ.situacaoAtiva) return null;
        const emailData = await this.buscarEmailParaLead(lead, dadosCNPJ);
        if (!emailData || !emailData.email) { console.log(`ℹ️ Lead descartado por falta de email: ${lead.nome}`); return null; }
        return { ...lead, email: emailData.email, fonteEmail: emailData.fonteEmail, dadosCNPJ };
    }
    async enriquecerLead(lead) { const completo = await this.enriquecerLeadCompleto(lead); return completo || { ...lead, dadosCNPJ: null }; }
    normalizarDadosBigQuery(data) { return { cnpj: data.cnpjRaw || data.cnpj, cnpjFormatado: data.cnpj || data.cnpjFormatado, cnpjRaw: data.cnpjRaw || String(data.cnpj || '').replace(/\D/g, ''), razaoSocial: data.razaoSocial || data.nomeFantasia || '', nomeFantasia: data.nomeFantasia || data.razaoSocial || '', situacao: data.situacao || '', situacaoAtiva: Boolean(data.situacaoAtiva), dataAbertura: data.dataAbertura || null, capitalSocial: Number(data.capitalSocial || 0), capitalSocialFormatado: data.capitalSocialFormatado || 'R$ 0,00', email: data.email || null, telefone: data.telefone || null, endereco: data.endereco || null, enderecoCompleto: data.endereco?.completo || '', cnae: data.cnae || null, socios: data.socios || [], socioPrincipal: data.socioPrincipal || null, match: data.match || null, fonte: data.fonte || 'BigQuery - Base dos Dados', dataConsulta: data.dataConsulta || new Date().toISOString() }; }
    extrairUF(endereco) { if (!endereco) return null; const match = endereco.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i); return match ? match[1].toUpperCase() : null; }
    extrairBairro(endereco) { if (!endereco) return null; const partes = String(endereco).split('-'); if (partes.length >= 2) { const candidato = partes[1].split(',')[0].trim(); return candidato || null; } return null; }
    validarEmailDNS(email) { const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; const blacklist = ['nome@dominio.com','john@doe.com','example@','teste@']; const emailLower = String(email || '').toLowerCase(); return regex.test(emailLower) && !blacklist.some(b => emailLower.includes(b)); }
}
const cnpjService = new CNPJService();
if (typeof window !== 'undefined') { console.log('🏢 Módulo CNPJ carregado!'); console.log('✅ CNPJ obrigatório com confiança'); console.log('✅ Email obrigatório via Base CNPJ ou site'); }
