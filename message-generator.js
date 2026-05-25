// ============================================
// BLOCO 4 - MESSAGE GENERATOR
// Gera mensagens personalizadas para cada lead
// ============================================

class MessageGenerator {
    constructor() {
        // Configurações padrão (usuário pode personalizar)
        this.config = {
            seuNome: '[SEU NOME]',
            suaEmpresa: '[SUA EMPRESA]',
            seuServico: '[SEU SERVIÇO]',
            beneficio: '[BENEFÍCIO]'
        };
    }

    // ============================================
    // CONFIGURA VARIÁVEIS PERSONALIZADAS
    // ============================================
    configurar(config) {
        this.config = {
            ...this.config,
            ...config
        };
    }

    // ============================================
    // GERA MENSAGEM BASEADA NO SCORE
    // ============================================
    gerarMensagem(lead) {
        const classificacao = lead.scoreData.classificacao;

        switch (classificacao) {
            case 'premium':
                return this.mensagemPremium(lead);
            case 'alto':
                return this.mensagemAlto(lead);
            case 'bom':
                return this.mensagemBom(lead);
            case 'medio':
                return this.mensagemMedio(lead);
            case 'baixo':
                return this.mensagemBaixo(lead);
            default:
                return this.mensagemGenerica(lead);
        }
    }

    // ============================================
    // MENSAGEM PREMIUM (90-100) - VIP
    // ============================================
    mensagemPremium(lead) {
        const templates = [
            // Template 1: Elogio à reputação
            `Olá, ${lead.nome}! 👋

Vi que ${this.getPrimeiroNome(lead.nome)} tem uma excelente reputação em ${this.getCidade(lead.endereco)} (${lead.avaliacao}⭐ com ${lead.numeroAvaliacoes} avaliações - parabéns pela qualidade!).

Sou ${this.config.seuNome} da ${this.config.suaEmpresa}.

Trabalho com ${this.config.seuServico} e acredito que posso ajudar a ${this.config.beneficio}.

Tem 5 minutos para conversarmos?`,

            // Template 2: Reconhecimento de sucesso
            `Oi, ${lead.nome}! 

Estava pesquisando os melhores estabelecimentos em ${this.getCidade(lead.endereco)} e ${this.getPrimeiroNome(lead.nome)} se destacou com ${lead.avaliacao}⭐ e ${lead.numeroAvaliacoes} avaliações.

Trabalho com ${this.config.seuServico} para negócios como o seu e tenho certeza que posso ajudar a ${this.config.beneficio}.

Podemos agendar uma conversa rápida?

${this.config.seuNome}
${this.config.suaEmpresa}`,

            // Template 3: Abordagem consultiva
            `Olá! 

${lead.nome} tem números impressionantes no Google (${lead.avaliacao}⭐ e ${lead.numeroAvaliacoes} reviews).

Sou especialista em ${this.config.seuServico} e trabalho com estabelecimentos de sucesso como o seu.

Acredito que posso agregar ainda mais valor ajudando a ${this.config.beneficio}.

Que tal uma conversa de 5 minutos?`
        ];

        // Retorna um template aleatório
        return templates[Math.floor(Math.random() * templates.length)];
    }

    // ============================================
    // MENSAGEM ALTO (75-89) - Profissional
    // ============================================
    mensagemAlto(lead) {
        const templates = [
            `Olá, ${lead.nome}!

Vi que vocês têm uma boa presença em ${this.getCidade(lead.endereco)} (${lead.avaliacao}⭐).

Trabalho com ${this.config.seuServico} e posso ajudar a ${this.config.beneficio}.

Tem interesse em conversar?

${this.config.seuNome}`,

            `Oi!

Encontrei ${lead.nome} e gostei da avaliação de ${lead.avaliacao}⭐.

Sou ${this.config.seuNome} e ajudo empresas com ${this.config.seuServico}.

Posso te explicar rapidamente como posso ajudar a ${this.config.beneficio}?`,

            `Olá, ${lead.nome}!

Estava procurando estabelecimentos em ${this.getCidade(lead.endereco)} e achei vocês.

Trabalho com ${this.config.seuServico} e acredito que posso ajudar.

Podemos conversar?`
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }

    // ============================================
    // MENSAGEM BOM (60-74) - Direto
    // ============================================
    mensagemBom(lead) {
        const templates = [
            `Olá!

Encontrei ${lead.nome} em ${this.getCidade(lead.endereco)}.

Trabalho com ${this.config.seuServico} e posso ajudar a ${this.config.beneficio}.

Tem alguns minutos para conversarmos?`,

            `Oi, ${lead.nome}!

Sou ${this.config.seuNome} e trabalho com ${this.config.seuServico}.

Acredito que posso ajudar vocês a ${this.config.beneficio}.

Podemos conversar rapidamente?`,

            `Olá!

Vi que vocês atuam em ${this.getCidade(lead.endereco)}.

Trabalho com ${this.config.seuServico} e gostaria de apresentar uma proposta.

Tem interesse?`
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }

    // ============================================
    // MENSAGEM MÉDIO (45-59) - Cauteloso
    // ============================================
    mensagemMedio(lead) {
        const templates = [
            `Olá, ${lead.nome}!

Sou ${this.config.seuNome} e trabalho com ${this.config.seuServico}.

Podemos conversar sobre como posso ajudar?`,

            `Oi!

Trabalho com ${this.config.seuServico} em ${this.getCidade(lead.endereco)}.

Tem interesse em saber mais?`,

            `Olá!

Encontrei ${lead.nome} e gostaria de apresentar ${this.config.seuServico}.

Podemos conversar?`
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }

    // ============================================
    // MENSAGEM BAIXO (0-44) - Básico
    // ============================================
    mensagemBaixo(lead) {
        return `Olá!

Sou ${this.config.seuNome} e trabalho com ${this.config.seuServico}.

Gostaria de saber se tem interesse em conhecer minha solução.

Obrigado!`;
    }

    // ============================================
    // MENSAGEM GENÉRICA (fallback)
    // ============================================
    mensagemGenerica(lead) {
        return `Olá, ${lead.nome}!

Sou ${this.config.seuNome} da ${this.config.suaEmpresa}.

Trabalho com ${this.config.seuServico} e acredito que posso ajudar.

Podemos conversar?`;
    }

    // ============================================
    // UTILITÁRIOS
    // ============================================

    // Extrai primeiro nome do estabelecimento
    getPrimeiroNome(nomeCompleto) {
        // Remove palavras comuns
        const palavrasRemover = ['restaurante', 'padaria', 'lanchonete', 'bar', 'café', 
                                  'pizzaria', 'churrascaria', 'confeitaria', 'sorveteria',
                                  'academia', 'clínica', 'consultório', 'pet shop', 'hotel'];
        
        let nome = nomeCompleto.toLowerCase();
        
        palavrasRemover.forEach(palavra => {
            nome = nome.replace(palavra, '').trim();
        });
        
        // Pega a primeira palavra que sobrou
        const palavras = nome.split(' ').filter(p => p.length > 0);
        
        if (palavras.length > 0) {
            // Capitaliza primeira letra
            return palavras[0].charAt(0).toUpperCase() + palavras[0].slice(1);
        }
        
        return nomeCompleto; // Se não conseguir extrair, retorna completo
    }

    // Extrai cidade do endereço
    getCidade(endereco) {
        // Tenta pegar a cidade do endereço
        // Formato comum: "Rua X, 123 - Bairro, Cidade - Estado"
        
        if (!endereco) return 'sua região';
        
        // Remove CEP se tiver
        let enderecoLimpo = endereco.replace(/\d{5}-?\d{3}/g, '').trim();
        
        // Tenta pegar a parte antes do hífen (geralmente a cidade)
        const partes = enderecoLimpo.split('-');
        
        if (partes.length >= 2) {
            // Pega a penúltima parte (geralmente a cidade)
            const cidade = partes[partes.length - 2].split(',').pop().trim();
            return cidade;
        }
        
        // Se não conseguir, pega a última vírgula
        const virgulas = enderecoLimpo.split(',');
        if (virgulas.length >= 2) {
            return virgulas[virgulas.length - 2].trim();
        }
        
        return 'sua região';
    }

    // ============================================
    // GERA VERSÃO PARA WHATSAPP
    // ============================================
    gerarMensagemWhatsApp(lead) {
        const mensagem = this.gerarMensagem(lead);
        
        // Remove emojis problemáticos e formata para WhatsApp
        return mensagem
            .replace(/👋/g, '')
            .replace(/⭐/g, 'estrelas')
            .trim();
    }

    // ============================================
    // GERA MENSAGEM COM TODAS AS VARIÁVEIS PREENCHIDAS
    // ============================================
    gerarMensagemCompleta(lead, variaveis) {
        // Atualiza configuração temporariamente
        const configOriginal = { ...this.config };
        this.configurar(variaveis);
        
        // Gera mensagem
        const mensagem = this.gerarMensagem(lead);
        
        // Restaura configuração original
        this.config = configOriginal;
        
        return mensagem;
    }

    // ============================================
    // VERIFICA SE TEM VARIÁVEIS NÃO PREENCHIDAS
    // ============================================
    temVariaveisVazias() {
        return this.config.seuNome.includes('[') ||
               this.config.suaEmpresa.includes('[') ||
               this.config.seuServico.includes('[') ||
               this.config.beneficio.includes('[');
    }

    // ============================================
    // RETORNA LISTA DE VARIÁVEIS DISPONÍVEIS
    // ============================================
    getVariaveis() {
        return {
            seuNome: this.config.seuNome,
            suaEmpresa: this.config.suaEmpresa,
            seuServico: this.config.seuServico,
            beneficio: this.config.beneficio
        };
    }
}

// ============================================
// EXPORTA PARA USO EM OUTROS ARQUIVOS
// ============================================
const messageGenerator = new MessageGenerator();

// Log quando carregar
if (typeof window !== 'undefined') {
    console.log('💬 Módulo Message Generator carregado!');
}
