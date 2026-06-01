// ============================================
// MODULO CNPJ - Integracao via BigQuery/Vercel
// Versao v5 - usa os dados completos retornados pela API
// ============================================

class CNPJService {
    constructor() {
        this.cache = new Map();
    }

    async buscarDadosCNPJPorTelefone(telefone, uf = null) {
        if (!telefone) return null;

        try {
            const telefoneLimpo = telefone.replace(/\D/g, '');
            const cacheKey = `${telefoneLimpo}_${uf || ''}`;

            if (this.cache.has(cacheKey)) {
                console.log('✅ CNPJ encontrado no cache');
                return this.cache.get(cacheKey);
            }

            console.log(`🔍 Consultando BigQuery para telefone: ${telefone}`);

            const params = new URLSearchParams({ telefone: telefoneLimpo });
            if (uf) params.set('uf', uf);

            const response = await fetch(`/api/buscar-cnpj?${params.toString()}`);
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`ℹ️ BigQuery: CNPJ não encontrado para telefone ${telefone}`);
                } else {
                    console.log(`⚠️ BigQuery retornou erro ${response.status}:`, data?.message || data?.error || 'erro desconhecido');
                }
                return null;
            }

            if (!data || !data.found) {
                console.log(`ℹ️ BigQuery: CNPJ não cadastrado com este telefone`);
                return null;
            }

            const dadosFormatados = this.normalizarDadosBigQuery(data);
            this.cache.set(cacheKey, dadosFormatados);

            console.log(`✅ CNPJ encontrado via BigQuery: ${dadosFormatados.cnpjFormatado}`);
            return dadosFormatados;

        } catch (error) {
            console.log(`⚠️ Erro ao consultar BigQuery:`, error.message);
            return null;
        }
    }

    async buscarCNPJPorTelefone(telefone) {
        const dados = await this.buscarDadosCNPJPorTelefone(telefone);
        return dados ? dados.cnpj : null;
    }

    async enriquecerLead(lead) {
        try {
            if (lead.dadosCNPJ) {
                return lead;
            }

            let dadosCNPJ = null;

            if (lead.telefone) {
                const uf = this.extrairUF(lead.endereco);
                dadosCNPJ = await this.buscarDadosCNPJPorTelefone(lead.telefone, uf);
            }

            if (!dadosCNPJ) {
                console.log(`ℹ️ CNPJ não encontrado para ${lead.nome}`);
                return { ...lead, dadosCNPJ: null };
            }

            const leadEnriquecido = { ...lead, dadosCNPJ };

            if (dadosCNPJ.email && !leadEnriquecido.email) {
                leadEnriquecido.email = dadosCNPJ.email;
            }

            if (dadosCNPJ.telefone && !leadEnriquecido.telefone) {
                leadEnriquecido.telefone = dadosCNPJ.telefone;
            }

            console.log(`✅ Lead enriquecido com CNPJ: ${lead.nome}`);
            return leadEnriquecido;

        } catch (error) {
            console.error(`Erro ao enriquecer lead ${lead.nome}:`, error);
            return { ...lead, dadosCNPJ: null };
        }
    }

    normalizarDadosBigQuery(data) {
        return {
            cnpj: data.cnpjRaw || data.cnpj,
            cnpjFormatado: data.cnpj || this.formatarCNPJ(data.cnpjRaw),
            razaoSocial: data.razaoSocial || data.nomeFantasia || '',
            nomeFantasia: data.nomeFantasia || data.razaoSocial || '',
            situacao: data.situacao || '',
            situacaoAtiva: !!data.situacaoAtiva,
            dataAbertura: data.dataAbertura || null,
            capitalSocial: data.capitalSocial || 0,
            capitalSocialFormatado: data.capitalSocialFormatado || 'R$ 0,00',
            email: data.email || null,
            telefone: data.telefone || null,
            endereco: data.endereco || null,
            logradouro: data.endereco?.logradouro || '',
            numero: data.endereco?.numero || '',
            complemento: data.endereco?.complemento || '',
            bairro: data.endereco?.bairro || '',
            municipio: data.endereco?.municipio || '',
            uf: data.endereco?.uf || '',
            cep: data.endereco?.cep || '',
            enderecoCompleto: data.endereco?.completo || '',
            cnae: data.cnae || null,
            socios: data.socios || [],
            socioPrincipal: data.socioPrincipal || null,
            fonte: data.fonte || 'BigQuery - Base dos Dados',
            dataConsulta: data.dataConsulta || new Date().toISOString()
        };
    }

    extrairUF(endereco) {
        if (!endereco) return null;
        const match = endereco.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
        return match ? match[1].toUpperCase() : null;
    }

    formatarCNPJ(cnpj) {
        const limpo = String(cnpj || '').replace(/\D/g, '');
        if (limpo.length !== 14) return cnpj || '';
        return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
}

const cnpjService = new CNPJService();

if (typeof window !== 'undefined') {
    console.log('🏢 Módulo CNPJ carregado!');
    console.log('✅ BigQuery via Vercel disponível');
}
