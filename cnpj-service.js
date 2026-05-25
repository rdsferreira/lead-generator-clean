// ============================================
// MÓDULO CNPJ - Receita Federal do Brasil
// Integração com ReceitaWS e Brasil API
// ============================================

class CNPJService {
    constructor() {
        // APIs públicas gratuitas
        this.apis = {
            receitaws: 'https://www.receitaws.com.br/v1/cnpj/',
            brasilapi: 'https://brasilapi.com.br/api/cnpj/v1/'
        };
        
        // Rate limiting (ReceitaWS: 3 req/min)
        this.lastRequest = 0;
        this.minInterval = 20000; // 20 segundos entre requests
        
        // Cache para evitar consultas repetidas
        this.cache = new Map();
    }

    // ============================================
    // BUSCA CNPJ POR TELEFONE via BigQuery
    // ============================================
    async buscarCNPJPorTelefone(telefone) {
        if (!telefone) return null;
        
        try {
            // Limpa o telefone (remove tudo exceto números)
            const telefoneLimpo = telefone.replace(/\D/g, '');
            
            console.log(`🔍 Consultando BigQuery para telefone: ${telefone}`);
            
            // Chama a API serverless no Vercel
            const response = await fetch(
                `/api/buscar-cnpj?telefone=${telefoneLimpo}`
            );
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`ℹ️ BigQuery: CNPJ não encontrado para telefone ${telefone}`);
                } else {
                    console.log(`⚠️ BigQuery retornou erro ${response.status}`);
                }
                return null;
            }
            
            const data = await response.json();
            
            if (!data.found) {
                console.log(`ℹ️ BigQuery: CNPJ não cadastrado com este telefone`);
                return null;
            }
            
            console.log(`✅ CNPJ encontrado via BigQuery: ${data.cnpj}`);
            
            // Retorna o CNPJ limpo (sem formatação) para consulta posterior
            return data.cnpjRaw;
            
        } catch (error) {
            console.log(`⚠️ Erro ao consultar BigQuery:`, error.message);
            return null;
        }
    }

    // ============================================
    // CONSULTA DADOS COMPLETOS DO CNPJ
    // ============================================
    async consultarCNPJ(cnpj) {
        // Remove formatação
        const cnpjClean = cnpj.replace(/[^\d]/g, '');
        
        if (cnpjClean.length !== 14) {
            console.error('CNPJ inválido:', cnpj);
            return null;
        }

        // Verifica cache
        if (this.cache.has(cnpjClean)) {
            console.log('✅ CNPJ encontrado no cache');
            return this.cache.get(cnpjClean);
        }

        // Rate limiting
        await this.aguardarRateLimit();

        try {
            // Tenta ReceitaWS primeiro
            console.log(`🔍 Consultando CNPJ ${this.formatarCNPJ(cnpjClean)}...`);
            
            const dados = await this.consultarReceitaWS(cnpjClean);
            
            if (dados) {
                // Salva no cache
                this.cache.set(cnpjClean, dados);
                return dados;
            }

            // Se falhar, tenta Brasil API
            console.log('⚠️ ReceitaWS falhou, tentando Brasil API...');
            const dadosBrasil = await this.consultarBrasilAPI(cnpjClean);
            
            if (dadosBrasil) {
                this.cache.set(cnpjClean, dadosBrasil);
                return dadosBrasil;
            }

            console.log('❌ Nenhuma API retornou dados');
            return null;

        } catch (error) {
            console.error('Erro ao consultar CNPJ:', error);
            return null;
        }
    }

    // ============================================
    // CONSULTA RECEITAWS
    // ============================================
    async consultarReceitaWS(cnpj) {
        try {
            const response = await fetch(this.apis.receitaws + cnpj, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            // Verifica se retornou erro
            if (data.status === 'ERROR') {
                console.log('⚠️ ReceitaWS:', data.message);
                return null;
            }

            // Formata dados
            return this.formatarDadosReceitaWS(data);

        } catch (error) {
            console.error('Erro ReceitaWS:', error);
            return null;
        }
    }

    // ============================================
    // CONSULTA BRASIL API
    // ============================================
    async consultarBrasilAPI(cnpj) {
        try {
            const response = await fetch(this.apis.brasilapi + cnpj);

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            
            // Formata dados
            return this.formatarDadosBrasilAPI(data);

        } catch (error) {
            console.error('Erro Brasil API:', error);
            return null;
        }
    }

    // ============================================
    // FORMATA DADOS RECEITAWS
    // ============================================
    formatarDadosReceitaWS(data) {
        // Extrai sócio principal (maior participação ou administrador)
        const socioPrincipal = this.extrairSocioPrincipal(data.qsa);

        return {
            cnpj: data.cnpj,
            cnpjFormatado: this.formatarCNPJ(data.cnpj),
            razaoSocial: data.nome,
            nomeFantasia: data.fantasia || data.nome,
            situacao: data.situacao,
            situacaoAtiva: data.situacao.toLowerCase().includes('ativa'),
            dataAbertura: this.formatarData(data.abertura),
            capitalSocial: parseFloat(data.capital_social.replace(/\./g, '').replace(',', '.')),
            capitalSocialFormatado: this.formatarMoeda(data.capital_social),
            
            // Contatos
            email: data.email || null,
            telefone: data.telefone || null,
            
            // Endereço
            logradouro: data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            enderecoCompleto: `${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.municipio}/${data.uf}`,
            
            // Atividade
            atividadePrincipal: data.atividade_principal?.[0]?.text || null,
            cnae: data.atividade_principal?.[0]?.code || null,
            
            // Sócios (QSA - Quadro de Sócios e Administradores)
            socios: data.qsa || [],
            socioPrincipal: socioPrincipal,
            
            // Metadata
            fonte: 'ReceitaWS',
            dataConsulta: new Date().toISOString()
        };
    }

    // ============================================
    // FORMATA DADOS BRASIL API
    // ============================================
    formatarDadosBrasilAPI(data) {
        const socioPrincipal = this.extrairSocioPrincipal(data.qsa);

        return {
            cnpj: data.cnpj,
            cnpjFormatado: this.formatarCNPJ(data.cnpj),
            razaoSocial: data.razao_social,
            nomeFantasia: data.nome_fantasia || data.razao_social,
            situacao: data.descricao_situacao_cadastral,
            situacaoAtiva: data.codigo_situacao_cadastral === 2, // 2 = ativa
            dataAbertura: data.data_inicio_atividade,
            capitalSocial: data.capital_social,
            capitalSocialFormatado: this.formatarMoeda(data.capital_social),
            
            // Contatos (Brasil API não tem)
            email: null,
            telefone: null,
            
            // Endereço
            logradouro: data.descricao_tipo_logradouro + ' ' + data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            enderecoCompleto: `${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.municipio}/${data.uf}`,
            
            // Atividade
            atividadePrincipal: data.cnae_fiscal_descricao,
            cnae: data.cnae_fiscal,
            
            // Sócios
            socios: data.qsa || [],
            socioPrincipal: socioPrincipal,
            
            // Metadata
            fonte: 'Brasil API',
            dataConsulta: new Date().toISOString()
        };
    }

    // ============================================
    // EXTRAI SÓCIO PRINCIPAL
    // ============================================
    extrairSocioPrincipal(qsa) {
        if (!qsa || qsa.length === 0) return null;

        // Prioriza administradores
        const administrador = qsa.find(socio => 
            socio.qual && socio.qual.toLowerCase().includes('administrador')
        );

        if (administrador) {
            return {
                nome: this.formatarNome(administrador.nome),
                qualificacao: administrador.qual || 'Sócio',
                ehAdministrador: true
            };
        }

        // Se não tem administrador, pega o primeiro
        return {
            nome: this.formatarNome(qsa[0].nome),
            qualificacao: qsa[0].qual || 'Sócio',
            ehAdministrador: false
        };
    }

    // ============================================
    // ENRIQUECE LEAD COM DADOS DO CNPJ
    // ============================================
    async enriquecerLead(lead) {
        try {
            let cnpj = null;
            
            // Estratégia 1: Se já tem CNPJ no lead (raro)
            if (lead.cnpj) {
                cnpj = lead.cnpj;
                console.log(`📋 CNPJ já existe no lead: ${cnpj}`);
            }
            
            // Estratégia 2: Buscar CNPJ pelo telefone (BigQuery!)
            if (!cnpj && lead.telefone) {
                cnpj = await this.buscarCNPJPorTelefone(lead.telefone);
            }
            
            // Se não encontrou CNPJ, retorna lead sem enriquecimento
            if (!cnpj) {
                console.log(`ℹ️ CNPJ não encontrado para ${lead.nome}`);
                return { ...lead, dadosCNPJ: null };
            }
            
            // Consulta dados completos do CNPJ na ReceitaWS
            const dados = await this.consultarCNPJ(cnpj);
            
            if (dados) {
                console.log(`✅ Lead enriquecido com CNPJ: ${lead.nome}`);
                return { ...lead, dadosCNPJ: dados };
            }
            
            return { ...lead, dadosCNPJ: null };
            
        } catch (error) {
            console.error(`Erro ao enriquecer lead ${lead.nome}:`, error);
            return { ...lead, dadosCNPJ: null };
        }
    }

    // ============================================
    // UTILITÁRIOS
    // ============================================

    limparNome(nome) {
        // Remove palavras comuns
        return nome
            .toLowerCase()
            .replace(/restaurante|padaria|bar|café|pizzaria|lanchonete/gi, '')
            .trim();
    }

    extrairCEP(endereco) {
        const match = endereco.match(/\d{5}-?\d{3}/);
        return match ? match[0].replace('-', '') : null;
    }

    formatarCNPJ(cnpj) {
        // 12.345.678/0001-90
        return cnpj.replace(
            /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
            '$1.$2.$3/$4-$5'
        );
    }

    formatarData(data) {
        // 01/01/2020 -> Date object
        if (!data) return null;
        const [dia, mes, ano] = data.split('/');
        return new Date(ano, mes - 1, dia);
    }

    formatarMoeda(valor) {
        if (!valor) return 'R$ 0,00';
        
        // Se já é string formatada, retorna
        if (typeof valor === 'string' && valor.includes(',')) {
            return 'R$ ' + valor;
        }
        
        // Se é número, formata
        const num = typeof valor === 'string' ? parseFloat(valor) : valor;
        return 'R$ ' + num.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    formatarNome(nome) {
        // Capitaliza nome próprio
        return nome
            .toLowerCase()
            .split(' ')
            .map(palavra => {
                // Não capitaliza preposições
                if (['de', 'da', 'do', 'dos', 'das'].includes(palavra)) {
                    return palavra;
                }
                return palavra.charAt(0).toUpperCase() + palavra.slice(1);
            })
            .join(' ');
    }

    async aguardarRateLimit() {
        const agora = Date.now();
        const tempoDecorrido = agora - this.lastRequest;
        
        if (tempoDecorrido < this.minInterval) {
            const esperar = this.minInterval - tempoDecorrido;
            console.log(`⏱️ Aguardando ${Math.ceil(esperar / 1000)}s (rate limit)...`);
            await new Promise(resolve => setTimeout(resolve, esperar));
        }
        
        this.lastRequest = Date.now();
    }

    // ============================================
    // VALIDA EMAIL VIA DNS (GRÁTIS!)
    // ============================================
    validarEmailDNS(email) {
        // Esta validação precisa ser feita no backend
        // Por enquanto, faz validação básica de formato
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
}

// ============================================
// EXPORTA PARA USO EM OUTROS ARQUIVOS
// ============================================
const cnpjService = new CNPJService();

// Log quando carregar
if (typeof window !== 'undefined') {
    console.log('🏢 Módulo CNPJ carregado!');
    console.log('✅ ReceitaWS API disponível');
    console.log('✅ Brasil API disponível');
}
