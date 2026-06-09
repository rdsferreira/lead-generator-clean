// ============================================
// BLOCO 2 - GOOGLE MAPS / PLACES API
// Versao v9 - busca ampliada + sem repeticao por navegador
// Retorna apenas leads com CNPJ validado + empresa ativa + email
// ============================================

class GoogleMapsService {
    constructor() {
        this.baseUrl = 'https://places.googleapis.com/v1/places:searchText';
        this.historicoKey = 'leadGenerator_leadsEntregues_v1';
        this.maxHistorico = 5000;
    }

    // ============================================
    // BUSCA PRINCIPAL
    // ============================================
    async buscarLeads(cidade, tipoNegocio, quantidade, bairro = null, raio = 5000) {
        console.log(`🔍 Buscando ${quantidade} leads verificados de ${tipoNegocio} em ${bairro ? bairro + ', ' : ''}${cidade}`);

        if (!CONFIG.GOOGLE_API_KEY || CONFIG.GOOGLE_API_KEY === 'COLE_SUA_CHAVE_AQUI') {
            throw new Error('Chave da API não configurada! Abra o arquivo config.js e adicione sua chave.');
        }

        const quantidadeDesejada = Math.min(Number(quantidade || 5), 50);

        // Para conseguir leads completos, precisamos buscar muito mais candidatos.
        // Ex.: 50 solicitados -> ate 500 candidatos, conforme disponibilidade do Google.
        const maxCandidatos = Math.min(Math.max(quantidadeDesejada * 10, 120), 500);

        console.log('═══════════════════════════════════════');
        console.log('📌 MODO BUSCA AMPLIADA ATIVO');
        console.log(`🎯 Leads completos desejados: ${quantidadeDesejada}`);
        console.log(`📦 Candidatos maximos a analisar: ${maxCandidatos}`);
        console.log('🔁 Leads ja entregues neste navegador serao ignorados.');
        console.log('═══════════════════════════════════════');

        const candidatos = await this.buscarCandidatosGoogle(cidade, tipoNegocio, bairro, maxCandidatos);
        console.log(`📦 Candidatos novos encontrados no Google: ${candidatos.length}`);

        if (candidatos.length === 0) {
            console.log('⚠️ Nenhum candidato novo encontrado. Tente outro bairro, cidade ou segmento, ou limpe o historico se estiver apenas testando.');
            return [];
        }

        console.log('🏢 Validando CNPJ, situacao ativa e email obrigatorio...');

        const leadsCompletos = [];
        const historico = this.carregarHistorico();

        for (let i = 0; i < candidatos.length; i++) {
            const lead = candidatos[i];

            if (leadsCompletos.length >= quantidadeDesejada) break;

            if (!lead.telefone) {
                console.log(`⏭️ Sem telefone, descartado: ${lead.nome}`);
                continue;
            }

            if (this.jaFoiEntregue(lead, null, historico)) {
                console.log(`🔁 Ja entregue antes, ignorado: ${lead.nome}`);
                continue;
            }

            console.log(`🔎 Analisando candidato ${i + 1}/${candidatos.length}: ${lead.nome}`);

            const enriquecido = await cnpjService.enriquecerLeadCompleto(lead);
            if (!enriquecido) continue;

            // Evita repetir a mesma empresa mesmo se o Google devolver outro Place ID.
            if (this.jaFoiEntregue(enriquecido, enriquecido.dadosCNPJ, historico)) {
                console.log(`🔁 CNPJ ja entregue antes, ignorado: ${enriquecido.nome}`);
                continue;
            }

            const scoreData = scoreCalculator.calcularScoreCompleto(enriquecido);
            leadsCompletos.push({ ...enriquecido, scoreData });
            console.log(`✅ Lead completo adicionado (${leadsCompletos.length}/${quantidadeDesejada}): ${lead.nome}`);
        }

        leadsCompletos.sort((a, b) => b.scoreData.score - a.scoreData.score);
        console.log(`✨ Leads completos encontrados antes dos filtros finais: ${leadsCompletos.length}/${quantidadeDesejada}`);

        return leadsCompletos;
    }

    // ============================================
    // BUSCA CANDIDATOS NO GOOGLE EM RODADAS
    // ============================================
    async buscarCandidatosGoogle(cidade, tipoNegocio, bairro, maxCandidatos) {
        const queries = this.montarQueries(cidade, tipoNegocio, bairro);
        const historico = this.carregarHistorico();
        const mapa = new Map();

        console.log(`🧭 Rodadas de busca planejadas: ${queries.length}`);

        for (const query of queries) {
            if (mapa.size >= maxCandidatos) break;

            const restantes = Math.min(20, maxCandidatos - mapa.size);
            console.log(`🌎 Google Places: "${query}" | buscando ate ${restantes}`);

            const lugares = await this.executarBuscaGoogle(query, restantes);

            for (const place of lugares) {
                const lead = this.converterParaLead(place);
                if (!lead.id) continue;

                // Nao adiciona candidatos ja entregues anteriormente para este navegador.
                if (this.jaFoiEntregue(lead, null, historico)) continue;

                if (!mapa.has(lead.id)) {
                    mapa.set(lead.id, lead);
                }
            }
        }

        return Array.from(mapa.values()).slice(0, maxCandidatos);
    }

    // ============================================
    // GERA VARIACOES DE BUSCA PARA EVITAR SEMPRE OS MESMOS RESULTADOS
    // ============================================
    montarQueries(cidade, tipoNegocio, bairro) {
        const base = String(tipoNegocio || '').trim();
        const termos = this.gerarTermosRelacionados(base);
        const queries = [];

        const locais = [];
        if (bairro) {
            locais.push(`${bairro}, ${cidade}`);
            locais.push(`proximo a ${bairro}, ${cidade}`);
            locais.push(`${bairro}`);
        }
        locais.push(cidade);

        for (const termo of termos) {
            for (const local of locais) {
                queries.push(`${termo} em ${local}`);
                queries.push(`${termo} ${local}`);
            }
        }

        // Algumas variacoes ajudam o Google a retornar conjuntos diferentes.
        if (bairro) {
            queries.push(`${base} telefone ${bairro} ${cidade}`);
            queries.push(`${base} contato ${bairro} ${cidade}`);
            queries.push(`${base} site ${bairro} ${cidade}`);
        }
        queries.push(`${base} telefone ${cidade}`);
        queries.push(`${base} contato ${cidade}`);
        queries.push(`${base} site ${cidade}`);

        // Remove duplicados preservando ordem.
        return [...new Set(queries.map(q => q.replace(/\s+/g, ' ').trim()).filter(Boolean))];
    }

    gerarTermosRelacionados(tipoNegocio) {
        const termo = String(tipoNegocio || '').toLowerCase().trim();
        const termos = [tipoNegocio];

        const grupos = [
            {
                chaves: ['restaurante', 'restaurantes', 'bar', 'bares', 'lanchonete', 'food', 'delivery'],
                termos: ['restaurante', 'bar', 'lanchonete', 'pizzaria', 'hamburgueria', 'cafeteria', 'padaria', 'comida japonesa', 'comida italiana', 'delivery']
            },
            {
                chaves: ['clinica', 'clínica', 'medico', 'médico', 'saude', 'saúde'],
                termos: ['clinica', 'clinica medica', 'consultorio medico', 'laboratorio', 'clinica de estetica', 'clinica odontologica']
            },
            {
                chaves: ['odontologia', 'odontologica', 'odontológica', 'dentista'],
                termos: ['clinica odontologica', 'dentista', 'consultorio odontologico', 'odontologia']
            },
            {
                chaves: ['academia', 'fitness', 'pilates'],
                termos: ['academia', 'studio fitness', 'pilates', 'crossfit', 'personal trainer']
            },
            {
                chaves: ['pet', 'veterinaria', 'veterinária'],
                termos: ['pet shop', 'clinica veterinaria', 'veterinaria', 'banho e tosa']
            },
            {
                chaves: ['escola', 'educacao', 'educação', 'curso'],
                termos: ['escola', 'curso', 'escola particular', 'escola de idiomas', 'creche']
            },
            {
                chaves: ['salao', 'salão', 'beleza', 'barbearia'],
                termos: ['salao de beleza', 'barbearia', 'clinica de estetica', 'esmalteria']
            }
        ];

        for (const grupo of grupos) {
            if (grupo.chaves.some(chave => termo.includes(chave))) {
                termos.push(...grupo.termos);
            }
        }

        return [...new Set(termos.map(t => String(t).trim()).filter(Boolean))];
    }

    async executarBuscaGoogle(query, quantidade) {
        const requestBody = {
            textQuery: query,
            maxResultCount: Math.min(quantidade, 20),
            languageCode: 'pt-BR',
            regionCode: 'BR'
        };

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': CONFIG.GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.businessStatus,places.regularOpeningHours,places.priceLevel,places.primaryType,places.location'
            },
            body: JSON.stringify(requestBody),
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Erro da API:', errorData);
            throw new Error(`Erro ao buscar no Google: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.places || [];
    }

    converterParaLead(place) {
        const nome = place.displayName?.text || 'Nome não disponível';
        const endereco = place.formattedAddress || 'Endereço não disponível';
        let telefone = place.nationalPhoneNumber || place.internationalPhoneNumber || null;
        if (telefone) telefone = telefone.replace('+55 ', '').trim();

        return {
            id: place.id,
            nome,
            endereco,
            telefone,
            site: place.websiteUri || null,
            email: null,
            avaliacao: place.rating || 0,
            numeroAvaliacoes: place.userRatingCount || 0,
            linkMaps: place.googleMapsUri || null,
            estaAberto: (place.businessStatus || 'UNKNOWN') === 'OPERATIONAL',
            status: place.businessStatus || 'UNKNOWN',
            horarioFuncionamento: place.regularOpeningHours?.weekdayDescriptions || null,
            tipo: place.primaryType || 'establishment',
            fonte: 'Google Places API',
            dataColeta: new Date().toISOString()
        };
    }

    // ============================================
    // BUSCA COM FILTROS FINAIS
    // ============================================
    async buscarComFiltros(filtros) {
        const { cidade, bairro, raio, tipoNegocio, quantidade, avaliacaoMinima } = filtros;

        console.log('═══════════════════════════════════════');
        console.log('🔧 REGRAS DA BUSCA:');
        console.log('🏢 CNPJ obrigatório: Sim');
        console.log('📧 Email obrigatório: Sim');
        console.log('📞 Telefone obrigatório: Sim');
        console.log('🔁 Repetir leads ja entregues neste navegador: Nao');
        console.log('⭐ Avaliação mínima:', avaliacaoMinima);
        console.log('═══════════════════════════════════════');

        let leads = await this.buscarLeads(cidade, tipoNegocio, quantidade, bairro, raio);
        console.log(`📊 Total com CNPJ + email antes dos filtros finais: ${leads.length}`);

        if (avaliacaoMinima > 0) {
            const antes = leads.length;
            leads = leads.filter(lead => lead.avaliacao >= avaliacaoMinima);
            console.log(`🔍 Filtro avaliação ≥${avaliacaoMinima}: ${antes} → ${leads.length} leads`);
        }

        const antesAbertos = leads.length;
        leads = leads.filter(lead => lead.estaAberto);
        console.log(`✅ Apenas operacionais: ${antesAbertos} → ${leads.length} leads`);

        // Marca como ja entregues somente os leads que realmente vao aparecer/exportar.
        this.marcarComoEntregues(leads);

        console.log(`✨ RESULTADO FINAL: ${leads.length} leads com CNPJ + email`);

        if (leads.length < Number(quantidade || 0)) {
            console.log(`⚠️ Resultado menor que solicitado: ${leads.length}/${quantidade}. A busca analisou candidatos ampliados, mas manteve somente empresas novas com dados completos.`);
        }

        return leads;
    }

    // ============================================
    // HISTORICO LOCAL PARA EVITAR REPETICAO
    // ============================================
    carregarHistorico() {
        try {
            const bruto = localStorage.getItem(this.historicoKey);
            if (!bruto) return { googleIds: [], cnpjs: [], nomes: [] };
            const data = JSON.parse(bruto);
            return {
                googleIds: Array.isArray(data.googleIds) ? data.googleIds : [],
                cnpjs: Array.isArray(data.cnpjs) ? data.cnpjs : [],
                nomes: Array.isArray(data.nomes) ? data.nomes : []
            };
        } catch (error) {
            return { googleIds: [], cnpjs: [], nomes: [] };
        }
    }

    salvarHistorico(historico) {
        try {
            historico.googleIds = [...new Set(historico.googleIds)].slice(-this.maxHistorico);
            historico.cnpjs = [...new Set(historico.cnpjs)].slice(-this.maxHistorico);
            historico.nomes = [...new Set(historico.nomes)].slice(-this.maxHistorico);
            localStorage.setItem(this.historicoKey, JSON.stringify(historico));
        } catch (error) {
            console.log('⚠️ Não foi possível salvar histórico local:', error.message);
        }
    }

    jaFoiEntregue(lead, dadosCNPJ = null, historicoParam = null) {
        const historico = historicoParam || this.carregarHistorico();
        const googleId = lead?.id;
        const cnpj = this.limparCNPJ(dadosCNPJ?.cnpjRaw || dadosCNPJ?.cnpj || lead?.dadosCNPJ?.cnpjRaw || lead?.dadosCNPJ?.cnpj);
        const nomeChave = this.normalizarTexto(`${lead?.nome || ''}|${lead?.endereco || ''}`);

        if (googleId && historico.googleIds.includes(googleId)) return true;
        if (cnpj && historico.cnpjs.includes(cnpj)) return true;
        if (nomeChave && historico.nomes.includes(nomeChave)) return true;

        return false;
    }

    marcarComoEntregues(leads) {
        if (!Array.isArray(leads) || leads.length === 0) return;

        const historico = this.carregarHistorico();

        for (const lead of leads) {
            if (lead.id) historico.googleIds.push(lead.id);

            const cnpj = this.limparCNPJ(lead?.dadosCNPJ?.cnpjRaw || lead?.dadosCNPJ?.cnpj);
            if (cnpj) historico.cnpjs.push(cnpj);

            const nomeChave = this.normalizarTexto(`${lead?.nome || ''}|${lead?.endereco || ''}`);
            if (nomeChave) historico.nomes.push(nomeChave);
        }

        this.salvarHistorico(historico);
        console.log(`💾 Historico atualizado. Novos leads marcados como entregues: ${leads.length}`);
    }

    limparCNPJ(valor) {
        const cnpj = String(valor || '').replace(/\D/g, '');
        return cnpj.length === 14 ? cnpj : null;
    }

    normalizarTexto(texto) {
        return String(texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    limparHistoricoEntregues() {
        localStorage.removeItem(this.historicoKey);
        console.log('🧹 Histórico de leads entregues foi limpo neste navegador.');
        return true;
    }
}

const googleMapsService = new GoogleMapsService();

if (typeof window !== 'undefined') {
    window.limparHistoricoLeadsEntregues = function() {
        return googleMapsService.limparHistoricoEntregues();
    };

    console.log('📦 Módulo Google Maps carregado!');
    console.log('🔑 Chave configurada:', CONFIG.GOOGLE_API_KEY !== 'COLE_SUA_CHAVE_AQUI' ? '✅ Sim' : '❌ Não');
    console.log('✅ Regra ativa: retornar somente leads com CNPJ + email');
    console.log('✅ Busca ampliada ativa');
    console.log('✅ Anti-repetição ativo por navegador');
    console.log('🧹 Para testes, use no console: limparHistoricoLeadsEntregues()');
}
