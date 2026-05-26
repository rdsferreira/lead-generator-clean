// ============================================
// MÓDULO CNPJ - Enriquecimento de leads
// Usa primeiro a API serverless /api/buscar-cnpj no Vercel.
// Mantém ReceitaWS/Brasil API como fallback se um CNPJ já vier no lead.
// ============================================

class CNPJService {
    constructor() {
        this.apis = {
            receitaws: 'https://www.receitaws.com.br/v1/cnpj/',
            brasilapi: 'https://brasilapi.com.br/api/cnpj/v1/'
        };

        this.lastRequest = 0;
        this.minInterval = 20000;
        this.cache = new Map();
        this.telefoneCache = new Map();
    }

    // ============================================
    // BUSCA DADOS COMPLETOS DO CNPJ POR TELEFONE
    // ============================================
    async buscarDadosCNPJPorTelefone(telefone) {
        if (!telefone) return null;

        const telefoneLimpo = telefone.replace(/\D/g, '');
        if (!telefoneLimpo) return null;

        if (this.telefoneCache.has(telefoneLimpo)) {
            return this.telefoneCache.get(telefoneLimpo);
        }

        try {
            console.log(`🔍 Consultando BigQuery para telefone: ${telefone}`);

            const response = await fetch(`/api/buscar-cnpj?telefone=${encodeURIComponent(telefoneLimpo)}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`ℹ️ BigQuery: CNPJ não encontrado para telefone ${telefone}`);
                } else {
                    const erro = await response.json().catch(() => ({}));
                    console.log(`⚠️ BigQuery retornou erro ${response.status}:`, erro.message || erro.error || 'sem detalhes');
                }
                this.telefoneCache.set(telefoneLimpo, null);
                return null;
            }

            const data = await response.json();

            if (!data.found) {
                this.telefoneCache.set(telefoneLimpo, null);
                return null;
            }

            const dadosNormalizados = this.normalizarDadosBigQuery(data);
            console.log(`✅ CNPJ encontrado via BigQuery: ${dadosNormalizados.cnpjFormatado}`);

            this.telefoneCache.set(telefoneLimpo, dadosNormalizados);
            this.cache.set(dadosNormalizados.cnpjRaw, dadosNormalizados);

            return dadosNormalizados;

        } catch (error) {
            console.log('⚠️ Erro ao consultar BigQuery:', error.message);
            this.telefoneCache.set(telefoneLimpo, null);
            return null;
        }
    }

    // Mantido para compatibilidade com versões anteriores.
    async buscarCNPJPorTelefone(telefone) {
        const dados = await this.buscarDadosCNPJPorTelefone(telefone);
        return dados ? dados.cnpjRaw : null;
    }

    // ============================================
    // CONSULTA DADOS COMPLETOS DO CNPJ
    // ============================================
    async consultarCNPJ(cnpj) {
        const cnpjClean = String(cnpj || '').replace(/[^\d]/g, '');

        if (cnpjClean.length !== 14) {
            console.error('CNPJ inválido:', cnpj);
            return null;
        }

        if (this.cache.has(cnpjClean)) {
            console.log('✅ CNPJ encontrado no cache');
            return this.cache.get(cnpjClean);
        }

        await this.aguardarRateLimit();

        try {
            console.log(`🔍 Consultando CNPJ ${this.formatarCNPJ(cnpjClean)}...`);

            const dados = await this.consultarReceitaWS(cnpjClean);
            if (dados) {
                this.cache.set(cnpjClean, dados);
                return dados;
            }

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

    async consultarReceitaWS(cnpj) {
        try {
            const response = await fetch(this.apis.receitaws + cnpj, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) return null;

            const data = await response.json();
            if (data.status === 'ERROR') {
                console.log('⚠️ ReceitaWS:', data.message);
                return null;
            }

            return this.formatarDadosReceitaWS(data);

        } catch (error) {
            console.error('Erro ReceitaWS:', error);
            return null;
        }
    }

    async consultarBrasilAPI(cnpj) {
        try {
            const response = await fetch(this.apis.brasilapi + cnpj);
            if (!response.ok) return null;

            const data = await response.json();
            return this.formatarDadosBrasilAPI(data);

        } catch (error) {
            console.error('Erro Brasil API:', error);
            return null;
        }
    }

    // ============================================
    // FORMATAÇÕES DAS FONTES
    // ============================================
    normalizarDadosBigQuery(data) {
        return {
            cnpj: data.cnpjFormatado || data.cnpj,
            cnpjFormatado: data.cnpjFormatado || data.cnpj,
            cnpjRaw: data.cnpjRaw || String(data.cnpj || '').replace(/\D/g, ''),
            razaoSocial: data.razaoSocial,
            nomeFantasia: data.nomeFantasia || data.razaoSocial,
            situacao: data.situacao,
            situacaoAtiva: Boolean(data.situacaoAtiva),
            dataAbertura: data.dataAbertura || null,
            capitalSocial: Number(data.capitalSocial || 0),
            capitalSocialFormatado: data.capitalSocialFormatado || this.formatarMoeda(data.capitalSocial),
            email: data.email || null,
            telefone: data.telefone || null,
            endereco: data.endereco || null,
            enderecoCompleto: data.endereco?.completo || null,
            atividadePrincipal: data.atividadePrincipal || null,
            cnae: data.cnae || null,
            socios: data.socios || [],
            socioPrincipal: data.socioPrincipal || null,
            fonte: data.fonte || 'BigQuery - Base dos Dados',
            dataConsulta: data.dataConsulta || new Date().toISOString()
        };
    }

    formatarDadosReceitaWS(data) {
        const socioPrincipal = this.extrairSocioPrincipal(data.qsa);
        const cnpjRaw = String(data.cnpj || '').replace(/\D/g, '');

        return {
            cnpj: this.formatarCNPJ(cnpjRaw),
            cnpjFormatado: this.formatarCNPJ(cnpjRaw),
            cnpjRaw,
            razaoSocial: data.nome,
            nomeFantasia: data.fantasia || data.nome,
            situacao: data.situacao,
            situacaoAtiva: String(data.situacao || '').toLowerCase().includes('ativa'),
            dataAbertura: this.formatarData(data.abertura),
            capitalSocial: parseFloat(String(data.capital_social || '0').replace(/\./g, '').replace(',', '.')),
            capitalSocialFormatado: this.formatarMoeda(data.capital_social),
            email: data.email || null,
            telefone: data.telefone || null,
            logradouro: data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            enderecoCompleto: `${data.logradouro || ''}, ${data.numero || ''} - ${data.bairro || ''}, ${data.municipio || ''}/${data.uf || ''}`,
            atividadePrincipal: data.atividade_principal?.[0]?.text || null,
            cnae: data.atividade_principal?.[0]?.code || null,
            socios: data.qsa || [],
            socioPrincipal,
            fonte: 'ReceitaWS',
            dataConsulta: new Date().toISOString()
        };
    }

    formatarDadosBrasilAPI(data) {
        const socioPrincipal = this.extrairSocioPrincipal(data.qsa);
        const cnpjRaw = String(data.cnpj || '').replace(/\D/g, '');

        return {
            cnpj: this.formatarCNPJ(cnpjRaw),
            cnpjFormatado: this.formatarCNPJ(cnpjRaw),
            cnpjRaw,
            razaoSocial: data.razao_social,
            nomeFantasia: data.nome_fantasia || data.razao_social,
            situacao: data.descricao_situacao_cadastral,
            situacaoAtiva: data.codigo_situacao_cadastral === 2,
            dataAbertura: data.data_inicio_atividade,
            capitalSocial: Number(data.capital_social || 0),
            capitalSocialFormatado: this.formatarMoeda(data.capital_social),
            email: null,
            telefone: null,
            logradouro: `${data.descricao_tipo_logradouro || ''} ${data.logradouro || ''}`.trim(),
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            enderecoCompleto: `${data.logradouro || ''}, ${data.numero || ''} - ${data.bairro || ''}, ${data.municipio || ''}/${data.uf || ''}`,
            atividadePrincipal: data.cnae_fiscal_descricao,
            cnae: data.cnae_fiscal,
            socios: data.qsa || [],
            socioPrincipal,
            fonte: 'Brasil API',
            dataConsulta: new Date().toISOString()
        };
    }

    extrairSocioPrincipal(qsa) {
        if (!qsa || qsa.length === 0) return null;

        const administrador = qsa.find(socio => {
            const qual = socio.qual || socio.qualificacao || socio.qualificacao_socio || '';
            return String(qual).toLowerCase().includes('administrador');
        });

        const escolhido = administrador || qsa[0];
        const nome = escolhido.nome || escolhido.nome_socio || '';
        const qualificacao = escolhido.qual || escolhido.qualificacao || escolhido.qualificacao_socio || 'Sócio';

        return {
            nome: this.formatarNome(nome),
            qualificacao,
            ehAdministrador: String(qualificacao).toLowerCase().includes('administrador')
        };
    }

    // ============================================
    // ENRIQUECE LEAD COM DADOS DO CNPJ
    // ============================================
    async enriquecerLead(lead) {
        try {
            let dados = null;

            if (lead.cnpj) {
                dados = await this.consultarCNPJ(lead.cnpj);
            }

            if (!dados && lead.telefone) {
                dados = await this.buscarDadosCNPJPorTelefone(lead.telefone);
            }

            if (!dados) {
                console.log(`ℹ️ CNPJ não encontrado para ${lead.nome}`);
                return { ...lead, dadosCNPJ: null };
            }

            console.log(`✅ Lead enriquecido com CNPJ: ${lead.nome}`);
            return { ...lead, dadosCNPJ: dados };

        } catch (error) {
            console.error(`Erro ao enriquecer lead ${lead.nome}:`, error);
            return { ...lead, dadosCNPJ: null };
        }
    }

    limparNome(nome) {
        return String(nome || '')
            .toLowerCase()
            .replace(/restaurante|padaria|bar|café|pizzaria|lanchonete/gi, '')
            .trim();
    }

    extrairCEP(endereco) {
        const match = String(endereco || '').match(/\d{5}-?\d{3}/);
        return match ? match[0].replace('-', '') : null;
    }

    formatarCNPJ(cnpj) {
        const limpo = String(cnpj || '').replace(/\D/g, '').padStart(14, '0');
        return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    formatarData(data) {
        if (!data) return null;
        if (String(data).includes('/')) {
            const [dia, mes, ano] = String(data).split('/');
            return new Date(ano, mes - 1, dia);
        }
        return data;
    }

    formatarMoeda(valor) {
        if (!valor) return 'R$ 0,00';

        if (typeof valor === 'string' && valor.includes(',')) {
            return 'R$ ' + valor;
        }

        const num = Number(valor || 0);
        return 'R$ ' + num.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    formatarNome(nome) {
        if (!nome) return '';

        return String(nome)
            .toLowerCase()
            .split(' ')
            .filter(Boolean)
            .map(palavra => {
                if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(palavra)) return palavra;
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

    validarEmailDNS(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
}

const cnpjService = new CNPJService();

if (typeof window !== 'undefined') {
    console.log('🏢 Módulo CNPJ carregado!');
    console.log('✅ BigQuery via Vercel disponível');
    console.log('✅ ReceitaWS/Brasil API como fallback');
}
