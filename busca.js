// ============================================
// BLOCO 1 - INTERFACE DE BUSCA
// Este arquivo controla o formulário e valida os dados
// ============================================

// Espera a página carregar completamente
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Lead Generator Pro carregado!');
    
    // Variáveis globais para exportação
    window.ultimosLeads = [];
    window.ultimosFiltros = {};
    
    // Pega os elementos da tela
    const form = document.getElementById('searchForm');
    const quantitySlider = document.getElementById('quantity');
    const quantityDisplay = document.getElementById('quantityDisplay');
    const btnSearch = document.getElementById('btnSearch');
    const statusMessage = document.getElementById('statusMessage');
    const statusText = document.getElementById('statusText');
    
    // Elementos de resultados
    const resultsSection = document.getElementById('resultsSection');
    const leadsList = document.getElementById('resultsContainer'); // O HTML usa 'resultsContainer' como ID
    
    // Variáveis de estado
    let currentLeads = [];
    let currentFilters = null;
    
    // ============================================
    // ATUALIZA O NÚMERO DE LEADS QUANDO ARRASTA O SLIDER
    // ============================================
    quantitySlider.addEventListener('input', function() {
        const quantidade = this.value;
        quantityDisplay.textContent = quantidade;
    });
    
    // ============================================
    // QUANDO O USUÁRIO CLICA EM "BUSCAR LEADS"
    // ============================================
    form.addEventListener('submit', function(event) {
        // Impede o formulário de recarregar a página
        event.preventDefault();
        
        // Pega os valores que o usuário digitou
        const dadosDaBusca = {
            cidade: document.getElementById('city').value.trim(),
            bairro: document.getElementById('neighborhood').value.trim(),
            raio: parseInt(document.getElementById('radius').value),
            tipoNegocio: document.getElementById('businessType').value.trim(),
            quantidade: parseInt(quantitySlider.value),
            precisaTelefone: document.getElementById('requirePhone').checked,
            precisaEmail: document.getElementById('requireEmail').checked,
            precisaSite: document.getElementById('requireWebsite').checked,
            avaliacaoMinima: parseFloat(document.getElementById('minRating').value)
        };
        
        // Valida os dados antes de buscar
        if (validarDados(dadosDaBusca)) {
            iniciarBusca(dadosDaBusca);
        }
    });
    
    // ============================================
    // VALIDA SE OS DADOS ESTÃO CORRETOS
    // ============================================
    function validarDados(dados) {
        // Verifica se a cidade foi digitada
        if (!dados.cidade || dados.cidade.length < 3) {
            mostrarErro('Por favor, digite uma cidade válida (mínimo 3 letras)');
            document.getElementById('city').focus();
            return false;
        }
        
        // Verifica se o tipo de negócio foi digitado
        if (!dados.tipoNegocio || dados.tipoNegocio.length < 3) {
            mostrarErro('Por favor, digite um tipo de negócio válido (mínimo 3 letras)');
            document.getElementById('businessType').focus();
            return false;
        }
        
        // Verifica se a quantidade está no limite
        if (dados.quantidade < 1 || dados.quantidade > 50) {
            mostrarErro('A quantidade deve estar entre 1 e 50 leads');
            return false;
        }
        
        // Tudo certo!
        return true;
    }
    
    // ============================================
    // INICIA A BUSCA DE LEADS
    // ============================================
    function iniciarBusca(dados) {
        console.log('🔍 Iniciando busca com os dados:', dados);
        
        // ============================================
        // LIMPA RESULTADOS ANTERIORES (anti-cache)
        // ============================================
        resultsSection.style.display = 'none';
        leadsList.innerHTML = '';
        currentLeads = [];
        currentFilters = null;
        
        // Configura o gerador de mensagens com os dados do usuário
        const configMensagem = {
            seuNome: document.getElementById('userNome').value.trim() || '[SEU NOME]',
            suaEmpresa: document.getElementById('userEmpresa').value.trim() || '[SUA EMPRESA]',
            seuServico: document.getElementById('userServico').value.trim() || '[SEU SERVIÇO]',
            beneficio: document.getElementById('userBeneficio').value.trim() || '[BENEFÍCIO]'
        };
        
        messageGenerator.configurar(configMensagem);
        
        // Desabilita o botão para evitar cliques múltiplos
        btnSearch.disabled = true;
        btnSearch.textContent = '⏳ Buscando...';
        
        // Mostra mensagem de carregamento
        mostrarMensagem('loading', '🔍 Buscando leads no Google... Aguarde alguns segundos!');
        
        // BUSCA REAL NO GOOGLE MAPS!
        googleMapsService.buscarComFiltros({
            cidade: dados.cidade,
            bairro: dados.bairro,
            raio: dados.raio,
            tipoNegocio: dados.tipoNegocio,
            quantidade: dados.quantidade,
            avaliacaoMinima: dados.avaliacaoMinima,
            precisaTelefone: dados.precisaTelefone,
            precisaEmail: dados.precisaEmail,
            precisaSite: dados.precisaSite
        })
        .then(function(leads) {
            // Salva leads e filtros para exportação
            window.ultimosLeads = leads;
            window.ultimosFiltros = dados;
            
            // Sucesso! Mostra os resultados
            mostrarResultados(leads);
            
            // Reabilita o botão
            btnSearch.disabled = false;
            btnSearch.textContent = '🚀 BUSCAR LEADS';
            
            // Mostra mensagem de sucesso
            if (leads.length > 0) {
                mostrarMensagem('success', `✅ Busca concluída! ${leads.length} leads encontrados.`);
            } else {
                mostrarMensagem('error', '⚠️ Nenhum lead encontrado com esses filtros. Tente ajustar os critérios.');
            }
        })
        .catch(function(error) {
            // Erro! Mostra mensagem
            console.error('❌ Erro na busca:', error);
            
            // Reabilita o botão
            btnSearch.disabled = false;
            btnSearch.textContent = '🚀 BUSCAR LEADS';
            
            // Mostra erro para o usuário
            let mensagemErro = 'Erro ao buscar leads. ';
            
            if (error.message.includes('Chave da API')) {
                mensagemErro += 'Configure sua chave da API no arquivo config.js';
            } else if (error.message.includes('quota')) {
                mensagemErro += 'Limite de uso da API atingido. Tente novamente amanhã.';
            } else {
                mensagemErro += error.message;
            }
            
            mostrarMensagem('error', '❌ ' + mensagemErro);
        });
    }
    
    // ============================================
    // MOSTRA OS RESULTADOS NA TELA
    // ============================================
    function mostrarResultados(leads) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContainer = document.getElementById('resultsContainer');
        
        // Limpa resultados anteriores
        resultsContainer.innerHTML = '';
        
        // Se não encontrou nada
        if (leads.length === 0) {
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="font-size: 1.2em; color: #666;">
                        😕 Nenhum lead encontrado com esses critérios.<br>
                        Tente ajustar os filtros e buscar novamente.
                    </p>
                </div>
            `;
            resultsSection.style.display = 'block';
            return;
        }
        
        // Cria um card para cada lead
        leads.forEach(function(lead, index) {
            const leadCard = document.createElement('div');
            leadCard.style.cssText = `
                background: white;
                border: 2px solid ${lead.scoreData.cor};
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 15px;
                transition: all 0.3s;
            `;
            
            // Formata o telefone (se tiver)
            const telefoneTexto = lead.telefone 
                ? `<p style="color: #666; margin: 5px 0;">📞 ${lead.telefone}</p>`
                : '<p style="color: #999; margin: 5px 0;">📞 Telefone não disponível</p>';
            
            // Formata o site (se tiver)
            const siteTexto = lead.site
                ? `<p style="color: #666; margin: 5px 0;">🌐 <a href="${lead.site}" target="_blank" style="color: #667eea;">Ver site</a></p>`
                : '';
            
            // Ícone de status
            const statusIcon = lead.estaAberto ? '✅' : '⚠️';
            const statusTexto = lead.estaAberto ? 'Aberto' : 'Fechado';
            
            leadCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 15px;">
                    <div style="flex: 1;">
                        <!-- Score Badge -->
                        <div style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 10px; 
                                    background: ${lead.scoreData.cor}15; padding: 8px 15px; border-radius: 20px;
                                    border: 2px solid ${lead.scoreData.cor};">
                            <span style="font-size: 1.5em;">${lead.scoreData.emoji}</span>
                            <span style="font-size: 1.3em; font-weight: bold; color: ${lead.scoreData.cor};">
                                ${lead.scoreData.score}
                            </span>
                            <span style="font-size: 0.9em; font-weight: 600; color: ${lead.scoreData.cor};">
                                ${lead.scoreData.nome}
                            </span>
                            ${lead.dadosCNPJ && lead.dadosCNPJ.situacaoAtiva ? `
                            <span style="font-size: 0.85em; font-weight: 600; color: #10b981; 
                                         background: #10b98120; padding: 4px 8px; border-radius: 10px;">
                                ✅ CNPJ VERIFICADO
                            </span>
                            ` : ''}
                        </div>
                        
                        <h3 style="color: #667eea; margin-bottom: 10px; font-size: 1.2em;">
                            ${index + 1}. ${lead.nome}
                        </h3>
                        
                        ${lead.dadosCNPJ ? `
                        <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; 
                                    margin-bottom: 12px; border-left: 4px solid #10b981;">
                            <p style="margin: 0; font-weight: 600; color: #065f46; font-size: 0.95em;">
                                🏢 ${lead.dadosCNPJ.razaoSocial}
                            </p>
                            <p style="margin: 5px 0 0 0; color: #047857; font-size: 0.85em;">
                                CNPJ: ${lead.dadosCNPJ.cnpjFormatado} • ${lead.dadosCNPJ.situacao}
                            </p>
                            ${lead.dadosCNPJ.socioPrincipal ? `
                            <p style="margin: 8px 0 0 0; color: #047857; font-size: 0.9em;">
                                👔 <strong>Decisor:</strong> ${lead.dadosCNPJ.socioPrincipal.nome}
                                <br><span style="font-size: 0.85em; opacity: 0.8;">
                                    ${lead.dadosCNPJ.socioPrincipal.qualificacao}
                                </span>
                            </p>
                            ` : ''}
                            ${lead.dadosCNPJ.capitalSocial > 0 ? `
                            <p style="margin: 5px 0 0 0; color: #047857; font-size: 0.85em;">
                                💰 Capital Social: ${lead.dadosCNPJ.capitalSocialFormatado}
                            </p>
                            ` : ''}
                        </div>
                        ` : ''}
                        
                        <p style="color: #666; margin: 5px 0;">
                            📍 ${lead.endereco}
                        </p>
                        ${telefoneTexto}
                        ${lead.email ? `
                        <p style="color: #666; margin: 5px 0;">
                            📧 ${lead.email} ${lead.dadosCNPJ && lead.dadosCNPJ.email ? '(Receita Federal)' : ''}
                        </p>
                        ` : ''}
                        ${siteTexto}
                        <p style="color: #666; margin: 5px 0;">
                            ⭐ ${lead.avaliacao.toFixed(1)} (${lead.numeroAvaliacoes} avaliações)
                        </p>
                        <p style="color: #666; margin: 5px 0; font-size: 0.9em;">
                            ${statusIcon} ${statusTexto}
                        </p>
                        
                        <!-- Dica de conversão -->
                        <div style="margin-top: 10px; padding: 10px; background: #f0f4ff; 
                                    border-radius: 8px; border-left: 4px solid ${lead.scoreData.cor};">
                            <p style="margin: 0; color: #666; font-size: 0.9em;">
                                💡 <strong>Taxa de conversão estimada: ${lead.scoreData.conversao}%</strong>
                            </p>
                            <p style="margin: 5px 0 0 0; color: #666; font-size: 0.85em;">
                                ${lead.scoreData.dica}
                            </p>
                        </div>

                        <!-- Mensagem Personalizada -->
                        <div style="margin-top: 15px; padding: 15px; background: #fff9e6; 
                                    border-radius: 8px; border: 2px solid #f59e0b;">
                            <p style="margin: 0 0 10px 0; font-weight: bold; color: #333; display: flex; align-items: center; gap: 5px;">
                                <span style="font-size: 1.2em;">📱</span> MENSAGEM SUGERIDA
                            </p>
                            <div style="background: white; padding: 12px; border-radius: 6px; 
                                        font-size: 0.9em; color: #444; line-height: 1.6; white-space: pre-line;"
                                 id="mensagem-${lead.id}">
${messageGenerator.gerarMensagem(lead)}
                            </div>
                            <button onclick="copiarMensagem('mensagem-${lead.id}')"
                                    style="margin-top: 10px; padding: 8px 16px; background: #f59e0b; 
                                           color: white; border: none; border-radius: 6px; cursor: pointer;
                                           font-weight: 600; font-size: 0.9em;">
                                📋 Copiar Mensagem
                            </button>
                            ${messageGenerator.temVariaveisVazias() ? `
                            <p style="margin: 10px 0 0 0; color: #d97706; font-size: 0.85em;">
                                ⚠️ Preencha seus dados acima para personalizar a mensagem
                            </p>
                            ` : ''}
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${lead.linkMaps ? `
                        <button onclick="window.open('${lead.linkMaps}', '_blank')" 
                                style="padding: 10px 20px; background: #4285f4; color: white; 
                                       border: none; border-radius: 6px; cursor: pointer;
                                       font-weight: 600; white-space: nowrap;">
                            🗺️ Google Maps
                        </button>
                        ` : ''}
                        ${lead.telefone ? `
                        <button onclick="copiarTexto('${lead.telefone}')" 
                                style="padding: 10px 20px; background: #25D366; color: white; 
                                       border: none; border-radius: 6px; cursor: pointer;
                                       font-weight: 600; white-space: nowrap;">
                            📞 Copiar Tel
                        </button>
                        ` : ''}
                        ${lead.email ? `
                        <button onclick="copiarTexto('${lead.email}')" 
                                style="padding: 10px 20px; background: #EA4335; color: white; 
                                       border: none; border-radius: 6px; cursor: pointer;
                                       font-weight: 600; white-space: nowrap;">
                            📧 Copiar Email
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
            
            // Adiciona efeito hover
            leadCard.addEventListener('mouseenter', function() {
                this.style.borderColor = lead.scoreData.cor;
                this.style.boxShadow = `0 4px 12px ${lead.scoreData.cor}40`;
                this.style.transform = 'translateY(-2px)';
            });
            
            leadCard.addEventListener('mouseleave', function() {
                this.style.borderColor = lead.scoreData.cor;
                this.style.boxShadow = 'none';
                this.style.transform = 'translateY(0)';
            });
            
            resultsContainer.appendChild(leadCard);
        });
        
        // Mostra a seção de resultados
        resultsSection.style.display = 'block';
        
        // Adiciona seção de exportação
        const exportSection = document.createElement('div');
        exportSection.style.cssText = `
            margin-top: 30px;
            padding: 25px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            color: white;
        `;
        
        exportSection.innerHTML = `
            <h3 style="margin: 0 0 15px 0; font-size: 1.3em;">
                📥 Exportar Leads
            </h3>
            <p style="margin: 0 0 20px 0; opacity: 0.9;">
                Baixe todos os ${leads.length} leads com scores, contatos e mensagens personalizadas
            </p>
            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <button onclick="exportarTodosLeads()" 
                        style="padding: 15px 30px; background: white; color: #667eea; 
                               border: none; border-radius: 10px; cursor: pointer;
                               font-weight: bold; font-size: 1.1em; flex: 1; min-width: 200px;
                               box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                    📊 Baixar Excel Completo
                </button>
                <button onclick="exportarRelatorioCompleto()" 
                        style="padding: 15px 30px; background: rgba(255,255,255,0.2); color: white; 
                               border: 2px solid white; border-radius: 10px; cursor: pointer;
                               font-weight: bold; font-size: 1.1em; flex: 1; min-width: 200px;">
                    📋 Relatório Detalhado
                </button>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <small style="opacity: 0.8;">✅ Incluído: Scores</small>
                <small style="opacity: 0.8;">✅ Contatos completos</small>
                <small style="opacity: 0.8;">✅ Mensagens prontas</small>
                <small style="opacity: 0.8;">✅ Taxa de conversão</small>
            </div>
        `;
        
        resultsContainer.appendChild(exportSection);
        
        // Rola a página até os resultados
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // ============================================
    // MOSTRA MENSAGENS DE STATUS
    // ============================================
    function mostrarMensagem(tipo, texto) {
        statusMessage.className = 'status-message ' + tipo;
        statusText.textContent = texto;
        statusMessage.style.display = 'block';
    }
    
    function mostrarErro(texto) {
        mostrarMensagem('error', '❌ ' + texto);
        
        // Esconde a mensagem depois de 5 segundos
        setTimeout(function() {
            statusMessage.style.display = 'none';
        }, 5000);
    }
});

// ============================================
// FUNÇÕES GLOBAIS AUXILIARES
// ============================================
function copiarTexto(texto) {
    // Cria um elemento temporário
    const elementoTemp = document.createElement('textarea');
    elementoTemp.value = texto;
    document.body.appendChild(elementoTemp);
    
    // Seleciona e copia
    elementoTemp.select();
    document.execCommand('copy');
    
    // Remove o elemento
    document.body.removeChild(elementoTemp);
    
    // Mostra feedback
    alert('✅ Copiado: ' + texto);
}

function copiarMensagem(elementId) {
    // Pega o conteúdo da mensagem
    const elemento = document.getElementById(elementId);
    const mensagem = elemento.textContent.trim();
    
    // Copia
    const elementoTemp = document.createElement('textarea');
    elementoTemp.value = mensagem;
    document.body.appendChild(elementoTemp);
    
    elementoTemp.select();
    document.execCommand('copy');
    
    document.body.removeChild(elementoTemp);
    
    // Feedback visual
    alert('✅ Mensagem copiada! Cole no WhatsApp, SMS ou email.');
}

// ============================================
// FUNÇÕES DE EXPORTAÇÃO
// ============================================
function exportarTodosLeads() {
    if (!window.ultimosLeads || window.ultimosLeads.length === 0) {
        alert('❌ Nenhum lead para exportar. Faça uma busca primeiro!');
        return;
    }
    
    const sucesso = excelExporter.exportarParaExcel(window.ultimosLeads, 'leads');
    
    if (sucesso) {
        alert(`✅ Excel baixado com sucesso!\n\n${window.ultimosLeads.length} leads exportados.`);
    }
}

function exportarRelatorioCompleto() {
    if (!window.ultimosLeads || window.ultimosLeads.length === 0) {
        alert('❌ Nenhum lead para exportar. Faça uma busca primeiro!');
        return;
    }
    
    const sucesso = excelExporter.exportarRelatorioCompleto(
        window.ultimosLeads, 
        window.ultimosFiltros,
        'relatorio_leads'
    );
    
    if (sucesso) {
        alert(`✅ Relatório completo baixado!\n\nInclui:\n• ${window.ultimosLeads.length} leads\n• Estatísticas\n• Filtros utilizados`);
    }
}

function exportarPorClassificacao() {
    if (!window.ultimosLeads || window.ultimosLeads.length === 0) {
        alert('❌ Nenhum lead para exportar. Faça uma busca primeiro!');
        return;
    }
    
    const sucesso = excelExporter.exportarPorClassificacao(window.ultimosLeads);
    
    if (sucesso) {
        alert('✅ Arquivos exportados por classificação!\n\nVerifique sua pasta de downloads.');
    }
}

// ============================================
// MENSAGEM DE BOAS-VINDAS NO CONSOLE
// ============================================
console.log('%c🚀 Lead Generator Pro', 'font-size: 20px; font-weight: bold; color: #667eea;');
console.log('%cBLOCO 1 ativo: Interface de Busca ✅', 'color: green;');
console.log('%cBLOCO 2 ativo: Google Maps API ✅', 'color: green;');
console.log('%cBLOCO 3 ativo: Score Inteligente ✅', 'color: green;');
console.log('%cBLOCO 4 ativo: Mensagem Personalizada ✅', 'color: green;');
console.log('%cBLOCO 5 ativo: Exportar Excel ✅', 'color: green;');
console.log('%c🎉 MVP 100% COMPLETO!', 'font-size: 16px; font-weight: bold; color: #10b981;');
