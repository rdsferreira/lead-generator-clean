// ============================================
// BLOCO 2 - GOOGLE MAPS / PLACES API
// Versao v8 - retorna apenas leads com CNPJ + email
// ============================================

class GoogleMapsService {
    constructor() { this.baseUrl = 'https://places.googleapis.com/v1/places:searchText'; }
    async buscarLeads(cidade, tipoNegocio, quantidade, bairro = null, raio = 5000) {
        console.log(`🔍 Buscando ${quantidade} leads verificados de ${tipoNegocio} em ${bairro ? bairro + ', ' : ''}${cidade}`);
        if (!CONFIG.GOOGLE_API_KEY || CONFIG.GOOGLE_API_KEY === 'COLE_SUA_CHAVE_AQUI') throw new Error('Chave da API não configurada! Abra o arquivo config.js e adicione sua chave.');
        const quantidadeDesejada = Math.min(Number(quantidade || 5), 50);
        const maxCandidatos = Math.min(Math.max(quantidadeDesejada * 5, 20), 50);
        const candidatos = await this.buscarCandidatosGoogle(cidade, tipoNegocio, bairro, maxCandidatos);
        console.log(`📦 Candidatos encontrados no Google: ${candidatos.length}`);
        console.log('🏢 Validando CNPJ e email obrigatório...');
        const leadsCompletos = [];
        for (const lead of candidatos) {
            if (leadsCompletos.length >= quantidadeDesejada) break;
            if (!lead.telefone) { console.log(`⏭️ Sem telefone, descartado: ${lead.nome}`); continue; }
            const enriquecido = await cnpjService.enriquecerLeadCompleto(lead);
            if (!enriquecido) continue;
            const scoreData = scoreCalculator.calcularScoreCompleto(enriquecido);
            leadsCompletos.push({ ...enriquecido, scoreData });
            console.log(`✅ Lead completo adicionado (${leadsCompletos.length}/${quantidadeDesejada}): ${lead.nome}`);
        }
        leadsCompletos.sort((a, b) => b.scoreData.score - a.scoreData.score);
        console.log(`✨ Leads completos retornados: ${leadsCompletos.length}/${quantidadeDesejada}`);
        return leadsCompletos;
    }
    async buscarCandidatosGoogle(cidade, tipoNegocio, bairro, maxCandidatos) {
        const queries = this.montarQueries(cidade, tipoNegocio, bairro); const mapa = new Map();
        for (const query of queries) { if (mapa.size >= maxCandidatos) break; const restantes = Math.min(20, maxCandidatos - mapa.size); const lugares = await this.executarBuscaGoogle(query, restantes); for (const place of lugares) { const lead = this.converterParaLead(place); if (lead.id && !mapa.has(lead.id)) mapa.set(lead.id, lead); } }
        return Array.from(mapa.values()).slice(0, maxCandidatos);
    }
    montarQueries(cidade, tipoNegocio, bairro) { const queries = []; if (bairro) { queries.push(`${tipoNegocio} em ${bairro}, ${cidade}`); queries.push(`${tipoNegocio} próximo a ${bairro}, ${cidade}`); } queries.push(`${tipoNegocio} em ${cidade}`); queries.push(`${tipoNegocio} ${cidade}`); return [...new Set(queries)]; }
    async executarBuscaGoogle(query, quantidade) {
        const requestBody = { textQuery: query, maxResultCount: Math.min(quantidade, 20), languageCode: 'pt-BR', regionCode: 'BR' };
        const response = await fetch(this.baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': CONFIG.GOOGLE_API_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.businessStatus,places.regularOpeningHours,places.priceLevel,places.primaryType,places.location' }, body: JSON.stringify(requestBody), cache: 'no-store' });
        if (!response.ok) { const errorData = await response.json().catch(() => ({})); console.error('❌ Erro da API:', errorData); throw new Error(`Erro ao buscar no Google: ${errorData.error?.message || response.statusText}`); }
        const data = await response.json(); return data.places || [];
    }
    converterParaLead(place) { const nome = place.displayName?.text || 'Nome não disponível'; const endereco = place.formattedAddress || 'Endereço não disponível'; let telefone = place.nationalPhoneNumber || place.internationalPhoneNumber || null; if (telefone) telefone = telefone.replace('+55 ', '').trim(); return { id: place.id, nome, endereco, telefone, site: place.websiteUri || null, email: null, avaliacao: place.rating || 0, numeroAvaliacoes: place.userRatingCount || 0, linkMaps: place.googleMapsUri || null, estaAberto: (place.businessStatus || 'UNKNOWN') === 'OPERATIONAL', status: place.businessStatus || 'UNKNOWN', horarioFuncionamento: place.regularOpeningHours?.weekdayDescriptions || null, tipo: place.primaryType || 'establishment', fonte: 'Google Places API', dataColeta: new Date().toISOString() }; }
    async buscarComFiltros(filtros) { const { cidade, bairro, raio, tipoNegocio, quantidade, avaliacaoMinima } = filtros; console.log('═══════════════════════════════════════'); console.log('🔧 REGRAS DA BUSCA:'); console.log('🏢 CNPJ obrigatório: Sim'); console.log('📧 Email obrigatório: Sim'); console.log('📞 Telefone obrigatório: Sim'); console.log('⭐ Avaliação mínima:', avaliacaoMinima); console.log('═══════════════════════════════════════'); let leads = await this.buscarLeads(cidade, tipoNegocio, quantidade, bairro, raio); console.log(`📊 Total com CNPJ + email antes dos filtros finais: ${leads.length}`); if (avaliacaoMinima > 0) { const antes = leads.length; leads = leads.filter(lead => lead.avaliacao >= avaliacaoMinima); console.log(`🔍 Filtro avaliação ≥${avaliacaoMinima}: ${antes} → ${leads.length} leads`); } const antesAbertos = leads.length; leads = leads.filter(lead => lead.estaAberto); console.log(`✅ Apenas operacionais: ${antesAbertos} → ${leads.length} leads`); console.log(`✨ RESULTADO FINAL: ${leads.length} leads com CNPJ + email`); return leads; }
}
const googleMapsService = new GoogleMapsService();
if (typeof window !== 'undefined') { console.log('📦 Módulo Google Maps carregado!'); console.log('🔑 Chave configurada:', CONFIG.GOOGLE_API_KEY !== 'COLE_SUA_CHAVE_AQUI' ? '✅ Sim' : '❌ Não'); console.log('✅ Regra ativa: retornar somente leads com CNPJ + email'); }
