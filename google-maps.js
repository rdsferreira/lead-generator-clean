// ============================================
// BLOCO 2 - GOOGLE MAPS / PLACES API
// Este arquivo busca leads REAIS no Google
// ============================================

class GoogleMapsService {
    constructor() {
        this.baseUrl = 'https://places.googleapis.com/v1/places:searchText';
        this.detailsUrl = 'https://places.googleapis.com/v1/places';
    }

    // ============================================
    // BUSCA PRINCIPAL - Encontra estabelecimentos
    // ============================================
    async buscarLeads(cidade, tipoNegocio, quantidade, bairro = null, raio = 5000) {
        const localizacao = bairro 
            ? `${tipoNegocio} em ${bairro}, ${cidade}`
            : `${tipoNegocio} em ${cidade}`;
        
        console.log(`🔍 Buscando: ${quantidade} ${tipoNegocio} em ${localizacao} (raio: ${raio/1000}km)`);

        // Verifica se a chave está configurada
        if (!CONFIG.GOOGLE_API_KEY || CONFIG.GOOGLE_API_KEY === 'COLE_SUA_CHAVE_AQUI') {
            throw new Error('Chave da API não configurada! Abra o arquivo config.js e adicione sua chave.');
        }

        try {
            // Monta a busca (query)
            const query = localizacao;
            
            // Adiciona timestamp para evitar cache
            const timestamp = Date.now();

            // Monta o corpo da requisição
            const requestBody = {
                textQuery: query,
                maxResultCount: Math.min(quantidade, 20), // Google limita a 20 por vez
                languageCode: 'pt-BR',
                regionCode: 'BR',
                // Cache busting
                _cache_bust: timestamp
            };

            // Se tem bairro especificado, adiciona restrição de localização
            // Isso vai fazer a busca focar mais na região específica
            if (bairro) {
                requestBody.locationBias = {
                    circle: {
                        radius: raio // em metros
                    }
                };
            }

            // Faz a requisição para a API do Google
            const response = await fetch(`${this.baseUrl}?_t=${timestamp}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': CONFIG.GOOGLE_API_KEY,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.businessStatus,places.regularOpeningHours,places.priceLevel,places.primaryType,places.location'
                },
                body: JSON.stringify(requestBody),
                cache: 'no-store' // Força não usar cache do navegador
            });

            // Verifica se deu erro
            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Erro da API:', errorData);
                throw new Error(`Erro ao buscar no Google: ${errorData.error?.message || response.statusText}`);
            }

            // Pega os dados
            const data = await response.json();
            
            console.log('═══════════════════════════════════════');
            console.log('📦 RESPOSTA DA API:');
            console.log('═══════════════════════════════════════');
            console.log('Status:', response.status);
            console.log('Dados retornados:', data);
            console.log('Quantidade de places:', data.places ? data.places.length : 0);

            // Verifica se encontrou algo
            if (!data.places || data.places.length === 0) {
                console.log('═══════════════════════════════════════');
                console.log('⚠️ NENHUM RESULTADO ENCONTRADO');
                console.log('═══════════════════════════════════════');
                console.log('Possíveis causas:');
                console.log('1. Cidade/bairro não encontrado');
                console.log('2. Tipo de negócio muito específico');
                console.log('3. Área de busca muito restrita');
                console.log('4. Problema com a API Key');
                console.log('═══════════════════════════════════════');
                return [];
            }

            console.log(`✅ Encontrados: ${data.places.length} estabelecimentos ANTES dos filtros`);

            // Converte os dados do Google para nosso formato
            const leads = data.places.map(place => this.converterParaLead(place));

            // Enriquece com emails dos websites
            const leadsComEmails = await this.enriquecerComEmails(leads);

            // Enriquece com dados do CNPJ (Receita Federal)
            const leadsComCNPJ = await this.enriquecerComCNPJ(leadsComEmails);

            // Calcula o score de cada lead
            const leadsComScore = leadsComCNPJ.map(lead => {
                const scoreData = scoreCalculator.calcularScoreCompleto(lead);
                return {
                    ...lead,
                    scoreData
                };
            });

            // Ordena por score (maior primeiro)
            leadsComScore.sort((a, b) => b.scoreData.score - a.scoreData.score);

            return leadsComScore;

        } catch (error) {
            console.error('❌ Erro ao buscar leads:', error);
            throw error;
        }
    }

    // ============================================
    // CONVERTE dados do Google para nosso formato
    // ============================================
    converterParaLead(place) {
        // Extrai informações do Google
        const nome = place.displayName?.text || 'Nome não disponível';
        const endereco = place.formattedAddress || 'Endereço não disponível';
        
        // Telefone (tenta pegar o brasileiro primeiro)
        let telefone = place.nationalPhoneNumber || place.internationalPhoneNumber || null;
        
        // Limpa o telefone (remove +55 e espaços extras se tiver)
        if (telefone) {
            telefone = telefone.replace('+55 ', '').trim();
        }

        // Website
        const site = place.websiteUri || null;

        // Avaliação
        const avaliacao = place.rating || 0;
        const numeroAvaliacoes = place.userRatingCount || 0;

        // Link do Google Maps
        const linkMaps = place.googleMapsUri || null;

        // Status do negócio
        const status = place.businessStatus || 'UNKNOWN';
        const estaAberto = status === 'OPERATIONAL';

        // Horário de funcionamento
        let horarioFuncionamento = null;
        if (place.regularOpeningHours?.weekdayDescriptions) {
            horarioFuncionamento = place.regularOpeningHours.weekdayDescriptions;
        }

        // ID único do Google
        const googleId = place.id;

        // Tipo de estabelecimento
        const tipo = place.primaryType || 'establishment';

        // Email - vai ser preenchido depois pela busca assíncrona
        let email = null;

        // Monta o objeto lead
        return {
            // Dados básicos
            id: googleId,
            nome: nome,
            endereco: endereco,
            telefone: telefone,
            site: site,
            email: email, // Será preenchido depois
            
            // Avaliações
            avaliacao: avaliacao,
            numeroAvaliacoes: numeroAvaliacoes,
            
            // Links
            linkMaps: linkMaps,
            
            // Status
            estaAberto: estaAberto,
            status: status,
            
            // Extras
            horarioFuncionamento: horarioFuncionamento,
            tipo: tipo,
            
            // Metadata
            fonte: 'Google Places API',
            dataColeta: new Date().toISOString()
        };
    }

    // ============================================
    // EXTRAI EMAIL DO WEBSITE (assíncrono)
    // ============================================
    async extrairEmailDoWebsite(url) {
        if (!url) return null;

        try {
            // Remove protocolo e espaços
            let cleanUrl = url.trim();
            if (!cleanUrl.startsWith('http')) {
                cleanUrl = 'https://' + cleanUrl;
            }

            console.log(`📧 Buscando email em: ${url}`);

            // Lista de proxies CORS gratuitos (tenta em ordem)
            const proxies = [
                `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`,
                `https://proxy.cors.sh/${cleanUrl}`
            ];

            let html = null;

            // Tenta cada proxy
            for (const proxyUrl of proxies) {
                try {
                    const response = await fetch(proxyUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'text/html',
                            'User-Agent': 'Mozilla/5.0'
                        },
                        signal: AbortSignal.timeout(8000) // 8 segundos timeout
                    });

                    if (response.ok) {
                        html = await response.text();
                        break; // Sucesso! Para de tentar
                    }
                } catch (err) {
                    continue; // Tenta próximo proxy
                }
            }

            if (!html) {
                console.log(`⚠️ Nenhum proxy conseguiu acessar ${url}`);
                return null;
            }

            // Regex para encontrar emails
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = html.match(emailRegex) || [];

            if (emails.length === 0) return null;

            // Remove duplicatas
            const uniqueEmails = [...new Set(emails)];

            // Filtra emails inúteis
            const blacklist = [
                'example@example.com',
                'test@test.com',
                'noreply@',
                'no-reply@',
                'wordpress@',
                'wix@',
                'admin@localhost',
                'siteground',
                'register.com',
                'privacy@',
                'abuse@',
                'cloudflare',
                'hostinger'
            ];

            const filtrados = uniqueEmails.filter(email => {
                const emailLower = email.toLowerCase();
                return !blacklist.some(blocked => emailLower.includes(blocked));
            });

            if (filtrados.length === 0) return null;

            // Prioriza emails corporativos
            const prioridades = ['contato', 'vendas', 'comercial', 'atendimento', 'info', 'suporte', 'sac'];
            
            const emailPrioritario = filtrados.find(email => {
                return prioridades.some(palavra => email.toLowerCase().includes(palavra));
            });

            const emailFinal = emailPrioritario || filtrados[0];
            console.log(`✅ Email encontrado: ${emailFinal}`);
            
            return emailFinal;

        } catch (error) {
            console.log(`⚠️ Erro ao buscar email em ${url}:`, error.message);
            return null;
        }
    }

    // ============================================
    // ENRIQUECE LEADS COM EMAILS (em lote)
    // ============================================
    async enriquecerComEmails(leads) {
        console.log('📧 Buscando emails nos websites...');
        
        // Processa em paralelo (máximo 5 por vez)
        const BATCH_SIZE = 5;
        
        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
            const batch = leads.slice(i, i + BATCH_SIZE);
            
            await Promise.all(
                batch.map(async (lead) => {
                    if (lead.site && !lead.email) {
                        const email = await this.extrairEmailDoWebsite(lead.site);
                        if (email) {
                            lead.email = email;
                            console.log(`✅ Email encontrado para ${lead.nome}: ${email}`);
                        }
                    }
                })
            );
        }
        
        const leadsComEmail = leads.filter(l => l.email).length;
        console.log(`📧 Total de emails encontrados: ${leadsComEmail}/${leads.length}`);
        
        return leads;
    }

    // ============================================
    // ENRIQUECE LEADS COM DADOS DO CNPJ (em lote)
    // ============================================
    async enriquecerComCNPJ(leads) {
        console.log('🏢 Buscando dados do CNPJ na Receita Federal...');
        
        // Enriquece apenas os 5 primeiros (leads top) para economizar rate limit
        // Em produção, você pode ajustar isso
        const leadsParaEnriquecer = leads.slice(0, 5);
        
        for (const lead of leadsParaEnriquecer) {
            try {
                const enriquecido = await cnpjService.enriquecerLead(lead);
                
                if (enriquecido.dadosCNPJ) {
                    lead.dadosCNPJ = enriquecido.dadosCNPJ;
                    
                    // Atualiza email se a Receita tiver um melhor
                    if (enriquecido.dadosCNPJ.email && !lead.email) {
                        lead.email = enriquecido.dadosCNPJ.email;
                    }
                    
                    // Atualiza telefone se a Receita tiver um melhor  
                    if (enriquecido.dadosCNPJ.telefone && !lead.telefone) {
                        lead.telefone = enriquecido.dadosCNPJ.telefone;
                    }
                    
                    console.log(`✅ CNPJ encontrado para ${lead.nome}`);
                }
            } catch (error) {
                console.log(`⚠️ Não foi possível enriquecer ${lead.nome} com CNPJ`);
            }
        }
        
        const leadsComCNPJ = leads.filter(l => l.dadosCNPJ).length;
        console.log(`🏢 Total com dados do CNPJ: ${leadsComCNPJ}/${leadsParaEnriquecer.length}`);
        
        return leads;
    }

    // ============================================
    // BUSCA COM FILTROS (avançado)
    // ============================================
    async buscarComFiltros(filtros) {
        const {
            cidade,
            bairro,
            raio,
            tipoNegocio,
            quantidade,
            avaliacaoMinima,
            precisaTelefone,
            precisaEmail,
            precisaSite
        } = filtros;

        console.log('═══════════════════════════════════════');
        console.log('🔧 APLICANDO FILTROS:');
        console.log('═══════════════════════════════════════');
        console.log('📞 Precisa telefone:', precisaTelefone);
        console.log('📧 Precisa email:', precisaEmail);
        console.log('🌐 Precisa site:', precisaSite);
        console.log('⭐ Avaliação mínima:', avaliacaoMinima);
        console.log('═══════════════════════════════════════');

        // Busca os leads
        let leads = await this.buscarLeads(cidade, tipoNegocio, quantidade, bairro, raio);

        console.log(`📊 Total BRUTO (antes dos filtros): ${leads.length} leads`);

        if (leads.length === 0) {
            console.log('═══════════════════════════════════════');
            console.log('⚠️ DIAGNÓSTICO: Nenhum lead encontrado');
            console.log('═══════════════════════════════════════');
            console.log('Sugestões:');
            console.log('1. Tente uma cidade maior (ex: São Paulo)');
            console.log('2. Use tipo de negócio mais genérico');
            console.log('3. Remova o bairro específico');
            console.log('4. Aumente o raio de busca');
            console.log('═══════════════════════════════════════');
            return [];
        }

        // Aplica filtros
        if (avaliacaoMinima > 0) {
            const antes = leads.length;
            leads = leads.filter(lead => lead.avaliacao >= avaliacaoMinima);
            console.log(`🔍 Filtro avaliação ≥${avaliacaoMinima}: ${antes} → ${leads.length} leads (removidos: ${antes - leads.length})`);
        }

        if (precisaTelefone) {
            const antes = leads.length;
            leads = leads.filter(lead => lead.telefone !== null);
            console.log(`📞 Filtro telefone obrigatório: ${antes} → ${leads.length} leads (removidos: ${antes - leads.length})`);
        }

        if (precisaEmail) {
            const antes = leads.length;
            leads = leads.filter(lead => lead.email !== null);
            console.log(`📧 Filtro email obrigatório: ${antes} → ${leads.length} leads (removidos: ${antes - leads.length})`);
        }

        if (precisaSite) {
            const antes = leads.length;
            leads = leads.filter(lead => lead.site !== null);
            console.log(`🌐 Filtro site obrigatório: ${antes} → ${leads.length} leads (removidos: ${antes - leads.length})`);
        }

        // Filtra apenas estabelecimentos abertos
        const antes = leads.length;
        leads = leads.filter(lead => lead.estaAberto);
        console.log(`✅ Apenas abertos: ${antes} → ${leads.length} leads (removidos: ${antes - leads.length})`);

        console.log('═══════════════════════════════════════');
        console.log(`✨ RESULTADO FINAL: ${leads.length} leads`);
        console.log('═══════════════════════════════════════');

        if (leads.length === 0) {
            console.log('⚠️ Filtros muito restritivos!');
            console.log('Tente desmarcar alguns filtros.');
        }

        return leads;
    }

    // ============================================
    // VALIDA se a API está funcionando
    // ============================================
    async testarConexao() {
        try {
            console.log('🧪 Testando conexão com Google Places API...');
            
            const leads = await this.buscarLeads('São Paulo', 'padaria', 1);
            
            if (leads.length > 0) {
                console.log('✅ API funcionando perfeitamente!');
                console.log('📍 Lead de teste encontrado:', leads[0].nome);
                return true;
            } else {
                console.log('⚠️ API conectou mas não retornou resultados');
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao testar API:', error.message);
            return false;
        }
    }
}

// ============================================
// EXPORTA para uso em outros arquivos
// ============================================
// Cria uma instância global
const googleMapsService = new GoogleMapsService();

// Testa a conexão quando carregar
if (typeof window !== 'undefined') {
    console.log('📦 Módulo Google Maps carregado!');
    console.log('🔑 Chave configurada:', CONFIG.GOOGLE_API_KEY !== 'COLE_SUA_CHAVE_AQUI' ? '✅ Sim' : '❌ Não');
}
