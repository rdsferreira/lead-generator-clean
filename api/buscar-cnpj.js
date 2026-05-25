// ============================================
// API SERVERLESS - BUSCAR CNPJ POR TELEFONE
// ============================================
// Este arquivo vai para: /api/buscar-cnpj.js
// Roda automaticamente no Vercel como serverless function

import { BigQuery } from '@google-cloud/bigquery';

// ============================================
// CONFIGURAÇÃO
// ============================================
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// ============================================
// HANDLER PRINCIPAL (Vercel chama isso)
// ============================================
export default async function handler(req, res) {
  // Permite CORS (importante!)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responde OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Só aceita GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Pega telefone da query string
    const { telefone } = req.query;

    if (!telefone) {
      return res.status(400).json({ 
        error: 'Telefone é obrigatório',
        exemplo: '/api/buscar-cnpj?telefone=1132143347'
      });
    }

    console.log(`🔍 Buscando CNPJ para telefone: ${telefone}`);

    // Limpa telefone (remove tudo exceto números)
    const telefoneLimpo = telefone.replace(/\D/g, '');

    // ============================================
    // QUERY NO BIGQUERY (Base dos Dados)
    // ============================================
    const query = `
      SELECT 
        e.cnpj,
        emp.razao_social,
        e.nome_fantasia,
        e.situacao_cadastral,
        e.data_inicio_atividade,
        emp.capital_social,
        e.tipo_logradouro,
        e.logradouro,
        e.numero,
        e.complemento,
        e.bairro,
        e.municipio,
        e.uf,
        e.cep,
        e.ddd_1 as ddd,
        e.telefone_1 as telefone,
        e.email,
        e.cnae_fiscal_principal,
        e.situacao_cadastral as status
      FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
      LEFT JOIN \`basedosdados.br_me_cnpj.empresas\` emp
        ON e.cnpj_basico = emp.cnpj_basico
      WHERE 
        REPLACE(REPLACE(REPLACE(e.telefone_1, '-', ''), ' ', ''), '(', '') = '${telefoneLimpo}'
        OR REPLACE(REPLACE(REPLACE(e.telefone_2, '-', ''), ' ', ''), '(', '') = '${telefoneLimpo}'
      LIMIT 1
    `;

    console.log('📊 Executando query no BigQuery...');

    // Executa query
    const [rows] = await bigquery.query({
      query: query,
      location: 'US', // Base dos Dados está em US
    });

    // Se não encontrou
    if (!rows || rows.length === 0) {
      console.log('⚠️ CNPJ não encontrado para este telefone');
      return res.status(404).json({
        found: false,
        message: 'CNPJ não encontrado para este telefone',
        telefone: telefone
      });
    }

    const empresa = rows[0];

    console.log(`✅ CNPJ encontrado: ${empresa.cnpj}`);

    // Agora busca sócios do CNPJ
    const cnpjBasico = empresa.cnpj.substring(0, 8);
    
    const querySocios = `
      SELECT 
        nome_socio,
        qualificacao_socio,
        tipo_socio,
        cpf_cnpj_socio
      FROM \`basedosdados.br_me_cnpj.socios\`
      WHERE cnpj_basico = '${cnpjBasico}'
      ORDER BY 
        CASE 
          WHEN qualificacao_socio LIKE '%Administrador%' THEN 1
          ELSE 2
        END
      LIMIT 10
    `;

    const [socios] = await bigquery.query({
      query: querySocios,
      location: 'US',
    });

    // Formata resposta
    const resultado = {
      found: true,
      cnpj: formatarCNPJ(empresa.cnpj),
      cnpjRaw: empresa.cnpj,
      razaoSocial: empresa.razao_social,
      nomeFantasia: empresa.nome_fantasia || empresa.razao_social,
      situacao: empresa.situacao_cadastral,
      situacaoAtiva: empresa.situacao_cadastral === 'ATIVA',
      dataAbertura: empresa.data_inicio_atividade,
      capitalSocial: parseFloat(empresa.capital_social || 0),
      capitalSocialFormatado: formatarMoeda(empresa.capital_social),
      
      // Endereço
      endereco: {
        logradouro: empresa.tipo_logradouro + ' ' + empresa.logradouro,
        numero: empresa.numero,
        complemento: empresa.complemento,
        bairro: empresa.bairro,
        municipio: empresa.municipio,
        uf: empresa.uf,
        cep: empresa.cep,
        completo: montarEnderecoCompleto(empresa)
      },
      
      // Contatos
      telefone: empresa.ddd && empresa.telefone 
        ? `(${empresa.ddd}) ${empresa.telefone}` 
        : null,
      email: empresa.email,
      
      // Atividade
      cnae: empresa.cnae_fiscal_principal,
      
      // Sócios
      socios: socios.map(s => ({
        nome: s.nome_socio,
        qualificacao: s.qualificacao_socio,
        tipo: s.tipo_socio,
        cpfCnpj: s.cpf_cnpj_socio
      })),
      
      socioPrincipal: socios[0] ? {
        nome: formatarNome(socios[0].nome_socio),
        qualificacao: socios[0].qualificacao_socio,
        ehAdministrador: socios[0].qualificacao_socio?.includes('Administrador')
      } : null,
      
      // Metadata
      fonte: 'BigQuery - Base dos Dados',
      dataConsulta: new Date().toISOString()
    };

    console.log('✅ Resposta formatada com sucesso');

    return res.status(200).json(resultado);

  } catch (error) {
    console.error('❌ Erro ao buscar CNPJ:', error);
    
    return res.status(500).json({
      error: 'Erro ao consultar BigQuery',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function formatarCNPJ(cnpj) {
  // 12345678000190 → 12.345.678/0001-90
  const limpo = cnpj.replace(/\D/g, '');
  return limpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

function formatarMoeda(valor) {
  if (!valor) return 'R$ 0,00';
  
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  
  return 'R$ ' + num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarNome(nome) {
  if (!nome) return '';
  
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

function montarEnderecoCompleto(empresa) {
  const partes = [
    empresa.tipo_logradouro,
    empresa.logradouro,
    empresa.numero,
    empresa.complemento,
    empresa.bairro,
    empresa.municipio + '/' + empresa.uf
  ].filter(Boolean);
  
  return partes.join(', ');
}
