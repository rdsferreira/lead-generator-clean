// ============================================
// BLOCO 5 - EXCEL EXPORTER
// Exporta leads para planilha Excel (.xlsx)
// ============================================

class ExcelExporter {
    constructor() {
        // Verifica se a biblioteca XLSX está disponível
        this.xlsxDisponivel = typeof XLSX !== 'undefined';
        
        if (!this.xlsxDisponivel) {
            console.warn('⚠️ Biblioteca XLSX não carregada. Exportação limitada a CSV.');
        }
    }

    // ============================================
    // EXPORTA PARA EXCEL (XLSX)
    // ============================================
    exportarParaExcel(leads, nomeArquivo = 'leads') {
        if (!this.xlsxDisponivel) {
            console.error('❌ Biblioteca XLSX não disponível. Use exportarParaCSV()');
            return this.exportarParaCSV(leads, nomeArquivo);
        }

        try {
            // Prepara os dados
            const dados = this.prepararDados(leads);
            
            // Cria a planilha
            const worksheet = XLSX.utils.json_to_sheet(dados);
            
            // Formata as colunas (largura)
            const larguraColunas = [
                { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 30 },
                { wch: 35 }, { wch: 30 }, { wch: 20 }, { wch: 14 },
                { wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 18 },
                { wch: 35 }, { wch: 35 }, { wch: 18 }, { wch: 30 },
                { wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
                { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 40 },
                { wch: 60 }
            ];
            
            worksheet['!cols'] = larguraColunas;
            
            // Cria o workbook
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
            
            // Gera o nome do arquivo com data
            const dataHora = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
            const nomeCompleto = `${nomeArquivo}_${dataHora}.xlsx`;
            
            // Faz o download
            XLSX.writeFile(workbook, nomeCompleto);
            
            console.log(`✅ Excel exportado: ${nomeCompleto}`);
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao exportar Excel:', error);
            alert('Erro ao exportar Excel. Verifique o console.');
            return false;
        }
    }

    // ============================================
    // EXPORTA PARA CSV (fallback)
    // ============================================
    exportarParaCSV(leads, nomeArquivo = 'leads') {
        try {
            // Prepara os dados
            const dados = this.prepararDados(leads);
            
            // Converte para CSV
            const csv = this.converterParaCSV(dados);
            
            // Cria o blob
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            
            // Cria link de download
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            const dataHora = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
            link.setAttribute('href', url);
            link.setAttribute('download', `${nomeArquivo}_${dataHora}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`✅ CSV exportado`);
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao exportar CSV:', error);
            alert('Erro ao exportar CSV. Verifique o console.');
            return false;
        }
    }

    // ============================================
    // PREPARA DADOS PARA EXPORTAÇÃO
    // ============================================
    prepararDados(leads) {
        return leads.map((lead, index) => {
            const cnpj = lead.dadosCNPJ || {};
            const decisor = cnpj.socioPrincipal || {};

            return {
                'Nº': index + 1,
                'Score': lead.scoreData.score,
                'Classificação': lead.scoreData.nome,
                'Nome Google': lead.nome,
                'Razão Social': cnpj.razaoSocial || 'N/A',
                'Nome Fantasia': cnpj.nomeFantasia || 'N/A',
                'CNPJ': cnpj.cnpjFormatado || cnpj.cnpj || 'N/A',
                'Situação CNPJ': cnpj.situacao || 'N/A',
                'CNPJ Ativo': cnpj.situacaoAtiva ? 'Sim' : (cnpj.situacao ? 'Não' : 'N/A'),
                'Decisor': decisor.nome || 'N/A',
                'Qualificação Decisor': decisor.qualificacao || 'N/A',
                'Capital Social': cnpj.capitalSocialFormatado || 'N/A',
                'Endereço Google': lead.endereco,
                'Endereço CNPJ': cnpj.enderecoCompleto || (cnpj.endereco && cnpj.endereco.completo) || 'N/A',
                'Telefone': lead.telefone || cnpj.telefone || 'N/A',
                'Email': lead.email || cnpj.email || 'N/A',
                'Website': lead.site || 'N/A',
                'Rating': lead.avaliacao.toFixed(1),
                'Reviews': lead.numeroAvaliacoes,
                'Status Google': lead.estaAberto ? 'Aberto' : 'Fechado',
                'CNAE': cnpj.cnae || 'N/A',
                'Fonte CNPJ': cnpj.fonte || 'N/A',
                'Conversão Estimada': lead.scoreData.conversao + '%',
                'Google Maps': lead.linkMaps || 'N/A',
                'Mensagem': messageGenerator.gerarMensagem(lead).replace(/
/g, ' ')
            };
        });
    }

    // ============================================
    // CONVERTE ARRAY DE OBJETOS PARA CSV
    // ============================================
    converterParaCSV(dados) {
        if (dados.length === 0) return '';
        
        // Cabeçalho
        const colunas = Object.keys(dados[0]);
        const cabecalho = colunas.join(',');
        
        // Linhas
        const linhas = dados.map(item => {
            return colunas.map(coluna => {
                let valor = item[coluna];
                
                // Escapa aspas e vírgulas
                if (typeof valor === 'string') {
                    valor = valor.replace(/"/g, '""');
                    if (valor.includes(',') || valor.includes('"') || valor.includes('\n')) {
                        valor = `"${valor}"`;
                    }
                }
                
                return valor;
            }).join(',');
        });
        
        return cabecalho + '\n' + linhas.join('\n');
    }

    // ============================================
    // GERA RELATÓRIO COMPLETO (com estatísticas)
    // ============================================
    exportarRelatorioCompleto(leads, filtros, nomeArquivo = 'relatorio_leads') {
        if (!this.xlsxDisponivel) {
            return this.exportarParaCSV(leads, nomeArquivo);
        }

        try {
            // Cria workbook
            const workbook = XLSX.utils.book_new();
            
            // ABA 1: Leads
            const dadosLeads = this.prepararDados(leads);
            const worksheetLeads = XLSX.utils.json_to_sheet(dadosLeads);
            worksheetLeads['!cols'] = [
                { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 30 },
                { wch: 35 }, { wch: 30 }, { wch: 20 }, { wch: 14 },
                { wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 18 },
                { wch: 35 }, { wch: 35 }, { wch: 18 }, { wch: 30 },
                { wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
                { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 40 },
                { wch: 60 }
            ];
            XLSX.utils.book_append_sheet(workbook, worksheetLeads, 'Leads');
            
            // ABA 2: Estatísticas
            const stats = scoreCalculator.calcularEstatisticas(leads);
            const dadosStats = [
                { 'Métrica': 'Total de Leads', 'Valor': stats.total },
                { 'Métrica': 'Score Médio', 'Valor': stats.scoreMedia },
                { 'Métrica': 'Conversão Média Estimada', 'Valor': stats.conversaoMedia + '%' },
                { 'Métrica': '', 'Valor': '' },
                { 'Métrica': 'Leads PREMIUM', 'Valor': stats.distribuicao.premium },
                { 'Métrica': 'Leads ALTO', 'Valor': stats.distribuicao.alto },
                { 'Métrica': 'Leads BOM', 'Valor': stats.distribuicao.bom },
                { 'Métrica': 'Leads MÉDIO', 'Valor': stats.distribuicao.medio },
                { 'Métrica': 'Leads BAIXO', 'Valor': stats.distribuicao.baixo }
            ];
            const worksheetStats = XLSX.utils.json_to_sheet(dadosStats);
            worksheetStats['!cols'] = [{ wch: 30 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(workbook, worksheetStats, 'Estatísticas');
            
            // ABA 3: Filtros Utilizados
            const dadosFiltros = [
                { 'Filtro': 'Cidade', 'Valor': filtros.cidade || 'N/A' },
                { 'Filtro': 'Bairro', 'Valor': filtros.bairro || 'Toda cidade' },
                { 'Filtro': 'Raio', 'Valor': filtros.raio ? (filtros.raio / 1000) + ' km' : 'N/A' },
                { 'Filtro': 'Tipo de Negócio', 'Valor': filtros.tipoNegocio || 'N/A' },
                { 'Filtro': 'Avaliação Mínima', 'Valor': filtros.avaliacaoMinima || 'Qualquer' },
                { 'Filtro': 'Requer Telefone', 'Valor': filtros.precisaTelefone ? 'Sim' : 'Não' },
                { 'Filtro': 'Requer Site', 'Valor': filtros.precisaSite ? 'Sim' : 'Não' },
                { 'Filtro': 'Data da Busca', 'Valor': new Date().toLocaleString('pt-BR') }
            ];
            const worksheetFiltros = XLSX.utils.json_to_sheet(dadosFiltros);
            worksheetFiltros['!cols'] = [{ wch: 25 }, { wch: 30 }];
            XLSX.utils.book_append_sheet(workbook, worksheetFiltros, 'Filtros');
            
            // Gera arquivo
            const dataHora = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
            const nomeCompleto = `${nomeArquivo}_${dataHora}.xlsx`;
            XLSX.writeFile(workbook, nomeCompleto);
            
            console.log(`✅ Relatório completo exportado: ${nomeCompleto}`);
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao exportar relatório:', error);
            return false;
        }
    }

    // ============================================
    // EXPORTA APENAS LEADS PREMIUM
    // ============================================
    exportarPremium(leads, nomeArquivo = 'leads_premium') {
        const leadsPremium = leads.filter(lead => 
            lead.scoreData.classificacao === 'premium'
        );
        
        if (leadsPremium.length === 0) {
            alert('Nenhum lead PREMIUM encontrado nesta busca.');
            return false;
        }
        
        return this.exportarParaExcel(leadsPremium, nomeArquivo);
    }

    // ============================================
    // EXPORTA POR CLASSIFICAÇÃO
    // ============================================
    exportarPorClassificacao(leads) {
        const classificacoes = ['premium', 'alto', 'bom', 'medio', 'baixo'];
        
        classificacoes.forEach(classe => {
            const leadsClasse = leads.filter(lead => 
                lead.scoreData.classificacao === classe
            );
            
            if (leadsClasse.length > 0) {
                this.exportarParaExcel(leadsClasse, `leads_${classe}`);
            }
        });
        
        console.log('✅ Exportação por classificação concluída!');
        return true;
    }
}

// ============================================
// EXPORTA PARA USO EM OUTROS ARQUIVOS
// ============================================
const excelExporter = new ExcelExporter();

// Log quando carregar
if (typeof window !== 'undefined') {
    console.log('📊 Módulo Excel Exporter carregado!');
    console.log('📚 Biblioteca XLSX:', excelExporter.xlsxDisponivel ? '✅ Disponível' : '❌ Não disponível');
}
