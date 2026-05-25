// ============================================
// BLOCO 3 - SCORE CALCULATOR
// Calcula a pontuação (0-100) de cada lead
// ============================================

class ScoreCalculator {
    constructor() {
        // Pesos dos critérios
        this.weights = {
            rating: 25,           // Avaliação do Google
            reviews: 20,          // Número de avaliações
            contacts: 30,         // Telefone + Site
            status: 15,           // Status do negócio
            activity: 10          // Atividade recente
        };
    }

    // ============================================
    // CALCULA SCORE TOTAL (0-100)
    // ============================================
    calcularScore(lead) {
        let score = 0;

        // 1. Rating (0-25 pontos)
        score += this.calcularPontosRating(lead.avaliacao);

        // 2. Número de avaliações (0-20 pontos)
        score += this.calcularPontosReviews(lead.numeroAvaliacoes);

        // 3. Contatos disponíveis (0-30 pontos)
        score += this.calcularPontosContatos(lead);

        // 4. Status do negócio (0-15 pontos)
        score += this.calcularPontosStatus(lead);

        // 5. Atividade recente (0-10 pontos)
        score += this.calcularPontosAtividade(lead);

        // Garante que fica entre 0 e 100
        return Math.min(100, Math.max(0, Math.round(score)));
    }

    // ============================================
    // PONTOS POR RATING (0-25)
    // ============================================
    calcularPontosRating(rating) {
        if (!rating || rating === 0) return 0;
        
        if (rating >= 4.5) return 25;      // Excelente
        if (rating >= 4.0) return 15;      // Muito bom
        if (rating >= 3.5) return 5;       // Bom
        return 0;                          // Abaixo de 3.5 = ruim
    }

    // ============================================
    // PONTOS POR NÚMERO DE AVALIAÇÕES (0-20)
    // ============================================
    calcularPontosReviews(numeroAvaliacoes) {
        if (!numeroAvaliacoes) return 0;
        
        if (numeroAvaliacoes >= 200) return 20;    // Muito popular
        if (numeroAvaliacoes >= 100) return 15;    // Popular
        if (numeroAvaliacoes >= 50) return 10;     // Conhecido
        if (numeroAvaliacoes >= 10) return 5;      // Alguns clientes
        return 0;                                   // Poucos clientes
    }

    // ============================================
    // PONTOS POR CONTATOS (0-30)
    // ============================================
    calcularPontosContatos(lead) {
        let pontos = 0;

        // Tem telefone? +15 pontos
        if (lead.telefone) {
            pontos += 15;
        }

        // Tem site? +15 pontos
        if (lead.site) {
            pontos += 15;
        }

        return pontos;
    }

    // ============================================
    // PONTOS POR STATUS (0-15)
    // ============================================
    calcularPontosStatus(lead) {
        if (lead.estaAberto === true) {
            return 15;  // Aberto = ótimo
        }
        
        if (lead.status === 'OPERATIONAL') {
            return 10;  // Operacional mas não sabemos se está aberto agora
        }
        
        if (lead.status === 'CLOSED_TEMPORARILY') {
            return 5;   // Fechado temporariamente = ainda pode ser lead
        }
        
        return 0;  // Fechado permanentemente
    }

    // ============================================
    // PONTOS POR ATIVIDADE RECENTE (0-10)
    // ============================================
    calcularPontosAtividade(lead) {
        // Por enquanto, damos pontos fixos
        // Futuramente, podemos analisar a data das reviews
        
        if (lead.numeroAvaliacoes > 0) {
            // Se tem reviews, assume que há atividade
            return 10;
        }
        
        return 0;
    }

    // ============================================
    // CLASSIFICA LEAD BASEADO NO SCORE
    // ============================================
    classificarLead(score) {
        if (score >= 90) return 'premium';
        if (score >= 75) return 'alto';
        if (score >= 60) return 'bom';
        if (score >= 45) return 'medio';
        return 'baixo';
    }

    // ============================================
    // RETORNA EMOJI DA CLASSIFICAÇÃO
    // ============================================
    getEmojiClassificacao(classificacao) {
        const emojis = {
            premium: '🟢',
            alto: '🔵',
            bom: '🟡',
            medio: '🟠',
            baixo: '🔴'
        };
        return emojis[classificacao] || '⚪';
    }

    // ============================================
    // RETORNA NOME LEGÍVEL DA CLASSIFICAÇÃO
    // ============================================
    getNomeClassificacao(classificacao) {
        const nomes = {
            premium: 'PREMIUM',
            alto: 'ALTO',
            bom: 'BOM',
            medio: 'MÉDIO',
            baixo: 'BAIXO'
        };
        return nomes[classificacao] || 'INDEFINIDO';
    }

    // ============================================
    // RETORNA COR DA CLASSIFICAÇÃO
    // ============================================
    getCorClassificacao(classificacao) {
        const cores = {
            premium: '#10b981',  // Verde
            alto: '#3b82f6',     // Azul
            bom: '#f59e0b',      // Amarelo/Laranja
            medio: '#f97316',    // Laranja
            baixo: '#ef4444'     // Vermelho
        };
        return cores[classificacao] || '#6b7280';
    }

    // ============================================
    // ESTIMA TAXA DE CONVERSÃO (%)
    // ============================================
    estimarConversao(score) {
        if (score >= 90) return 45;  // Premium: 45%
        if (score >= 75) return 28;  // Alto: 28%
        if (score >= 60) return 15;  // Bom: 15%
        if (score >= 45) return 8;   // Médio: 8%
        return 3;                     // Baixo: 3%
    }

    // ============================================
    // GERA DICA BASEADA NO SCORE
    // ============================================
    gerarDica(classificacao, lead) {
        const dicas = {
            premium: `Lead PREMIUM - Alta chance de conversão! ${lead.nome} tem excelente reputação (${lead.avaliacao}⭐) e ${lead.numeroAvaliacoes} avaliações. Entre em contato AGORA!`,
            
            alto: `Lead ALTO - Boa oportunidade! ${lead.nome} tem boa reputação e presença online. Vale investir tempo neste contato.`,
            
            bom: `Lead BOM - Vale tentar! ${lead.nome} tem potencial, mas pode precisar de uma abordagem mais cuidadosa.`,
            
            medio: `Lead MÉDIO - Avaliar melhor. ${lead.nome} tem alguns pontos fracos. Considere se vale o esforço.`,
            
            baixo: `Lead BAIXO - Pouco promissor. ${lead.nome} tem score baixo. Priorize outros leads primeiro.`
        };

        return dicas[classificacao] || 'Lead para avaliar.';
    }

    // ============================================
    // CALCULA SCORE COMPLETO COM TODOS OS DADOS
    // ============================================
    calcularScoreCompleto(lead) {
        const score = this.calcularScore(lead);
        const classificacao = this.classificarLead(score);
        const emoji = this.getEmojiClassificacao(classificacao);
        const nome = this.getNomeClassificacao(classificacao);
        const cor = this.getCorClassificacao(classificacao);
        const conversao = this.estimarConversao(score);
        const dica = this.gerarDica(classificacao, lead);

        return {
            score,
            classificacao,
            emoji,
            nome,
            cor,
            conversao,
            dica,
            // Detalhamento dos pontos
            detalhes: {
                rating: this.calcularPontosRating(lead.avaliacao),
                reviews: this.calcularPontosReviews(lead.numeroAvaliacoes),
                contatos: this.calcularPontosContatos(lead),
                status: this.calcularPontosStatus(lead),
                atividade: this.calcularPontosAtividade(lead)
            }
        };
    }

    // ============================================
    // ORDENA LEADS POR SCORE (MAIOR PRIMEIRO)
    // ============================================
    ordenarLeadsPorScore(leads) {
        return [...leads].sort((a, b) => {
            return b.scoreData.score - a.scoreData.score;
        });
    }

    // ============================================
    // FILTRA LEADS POR CLASSIFICAÇÃO
    // ============================================
    filtrarPorClassificacao(leads, classificacao) {
        return leads.filter(lead => 
            lead.scoreData.classificacao === classificacao
        );
    }

    // ============================================
    // CALCULA ESTATÍSTICAS GERAIS
    // ============================================
    calcularEstatisticas(leads) {
        if (leads.length === 0) {
            return {
                total: 0,
                scoremedio: 0,
                conversaoMedia: 0,
                distribuicao: {
                    premium: 0,
                    alto: 0,
                    bom: 0,
                    medio: 0,
                    baixo: 0
                }
            };
        }

        // Score médio
        const scoreTotal = leads.reduce((sum, lead) => sum + lead.scoreData.score, 0);
        const scoreMedia = Math.round(scoreTotal / leads.length);

        // Conversão média
        const conversaoTotal = leads.reduce((sum, lead) => sum + lead.scoreData.conversao, 0);
        const conversaoMedia = Math.round(conversaoTotal / leads.length);

        // Distribuição por classificação
        const distribuicao = {
            premium: leads.filter(l => l.scoreData.classificacao === 'premium').length,
            alto: leads.filter(l => l.scoreData.classificacao === 'alto').length,
            bom: leads.filter(l => l.scoreData.classificacao === 'bom').length,
            medio: leads.filter(l => l.scoreData.classificacao === 'medio').length,
            baixo: leads.filter(l => l.scoreData.classificacao === 'baixo').length
        };

        return {
            total: leads.length,
            scoreMedia,
            conversaoMedia,
            distribuicao
        };
    }
}

// ============================================
// EXPORTA PARA USO EM OUTROS ARQUIVOS
// ============================================
const scoreCalculator = new ScoreCalculator();

// Log quando carregar
if (typeof window !== 'undefined') {
    console.log('📊 Módulo Score Calculator carregado!');
}
