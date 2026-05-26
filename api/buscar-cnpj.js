// ============================================
// API SERVERLESS - BUSCAR CNPJ POR TELEFONE
// Caminho correto no Vercel: /api/buscar-cnpj.js
// ============================================

import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  try {
    validarVariaveisAmbiente();

    const telefoneRecebido = String(req.query.telefone || '').trim();

    if (!telefoneRecebido) {
      return res.status(400).json({
        found: false,
        error: 'Telefone é obrigatório',
        exemplo: '/api/buscar-cnpj?telefone=11987654321'
      });
    }

    const telefoneInfo = prepararTelefonesParaBusca(telefoneRecebido);

    if (telefoneInfo.todos.length === 0) {
      return res.status(400).json({
        found: false,
        error: 'Telefone inválido ou vazio após limpeza',
        telefone: telefoneRecebido
      });
    }

    console.log('🔎 Buscando CNPJ por telefone:', {
      recebido: telefoneRecebido,
      busca: telefoneInfo
    });

    const query = `
      SELECT
        e.cnpj,
        e.cnpj_basico,
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
        e.ddd_1,
        e.telefone_1,
        e.ddd_2,
        e.telefone_2,
        e.email,
        e.cnae_fiscal_principal
      FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
      LEFT JOIN \`basedosdados.br_me_cnpj.empresas\` emp
        ON e.cnpj_basico = emp.cnpj_basico
      WHERE
        CONCAT(
          REGEXP_REPLACE(COALESCE(CAST(e.ddd_1 AS STRING), ''), r'\\D', ''),
          REGEXP_REPLACE(COALESCE(CAST(e.telefone_1 AS STRING), ''), r'\\D', '')
        ) IN UNNEST(@telefonesComDDD)
        OR CONCAT(
          REGEXP_REPLACE(COALESCE(CAST(e.ddd_2 AS STRING), ''), r'\\D', ''),
          REGEXP_REPLACE(COALESCE(CAST(e.telefone_2 AS STRING), ''), r'\\D', '')
        ) IN UNNEST(@telefonesComDDD)
        OR REGEXP_REPLACE(COALESCE(CAST(e.telefone_1 AS STRING), ''), r'\\D', '') IN UNNEST(@numerosSemDDD)
        OR REGEXP_REPLACE(COALESCE(CAST(e.telefone_2 AS STRING), ''), r'\\D', '') IN UNNEST(@numerosSemDDD)
      ORDER BY
        CASE
          WHEN UPPER(CAST(e.situacao_cadastral AS STRING)) IN ('ATIVA', '02', '2') THEN 0
          ELSE 1
        END,
        e.data_inicio_atividade DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'US',
      params: {
        telefonesComDDD: telefoneInfo.telefonesComDDD,
        numerosSemDDD: telefoneInfo.numerosSemDDD
      }
    });

    if (!rows || rows.length === 0) {
      console.log('⚠️ CNPJ não encontrado para este telefone');
      return res.status(404).json({
        found: false,
        message: 'CNPJ não encontrado para este telefone',
        telefone: telefoneRecebido,
        tentativas: telefoneInfo.todos
      });
    }

    const empresa = rows[0];
    const cnpjLimpo = limparNumeros(empresa.cnpj);
    const cnpjBasico = empresa.cnpj_basico || cnpjLimpo.substring(0, 8);

    const socios = await buscarSocios(cnpjBasico);
    const resultado = formatarResultadoEmpresa(empresa, socios);

    console.log('✅ CNPJ encontrado:', resultado.cnpjFormatado);
    return res.status(200).json(resultado);

  } catch (error) {
    console.error('❌ Erro ao buscar CNPJ:', error);

    return res.status(500).json({
      found: false,
      error: 'Erro ao consultar BigQuery',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function buscarSocios(cnpjBasico) {
  if (!cnpjBasico) return [];

  const querySocios = `
    SELECT
      nome_socio,
      qualificacao_socio,
      tipo_socio,
      cpf_cnpj_socio
    FROM \`basedosdados.br_me_cnpj.socios\`
    WHERE cnpj_basico = @cnpjBasico
    ORDER BY
      CASE
        WHEN LOWER(CAST(qualificacao_socio AS STRING)) LIKE '%administrador%' THEN 1
        WHEN LOWER(CAST(qualificacao_socio AS STRING)) LIKE '%sócio-administrador%' THEN 1
        WHEN LOWER(CAST(qualificacao_socio AS STRING)) LIKE '%socio-administrador%' THEN 1
        ELSE 2
      END
    LIMIT 10
  `;

  const [socios] = await bigquery.query({
    query: querySocios,
    location: 'US',
    params: { cnpjBasico }
  });

  return socios || [];
}

function validarVariaveisAmbiente() {
  const faltando = [];
  if (!process.env.GOOGLE_CLOUD_PROJECT_ID) faltando.push('GOOGLE_CLOUD_PROJECT_ID');
  if (!process.env.GOOGLE_CLOUD_CLIENT_EMAIL) faltando.push('GOOGLE_CLOUD_CLIENT_EMAIL');
  if (!process.env.GOOGLE_CLOUD_PRIVATE_KEY) faltando.push('GOOGLE_CLOUD_PRIVATE_KEY');

  if (faltando.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes no Vercel: ${faltando.join(', ')}`);
  }
}

function prepararTelefonesParaBusca(telefone) {
  let limpo = limparNumeros(telefone);

  if (limpo.startsWith('55') && limpo.length > 11) {
    limpo = limpo.slice(2);
  }

  const candidatos = new Set();
  candidatos.add(limpo);

  let ddd = '';
  let numero = limpo;

  if (limpo.length >= 10) {
    ddd = limpo.slice(0, 2);
    numero = limpo.slice(2);
  }

  const numerosSemDDD = new Set();
  if (numero) numerosSemDDD.add(numero);

  // Muitos cadastros antigos têm celular sem o nono dígito.
  if (numero.length === 9 && numero.startsWith('9')) {
    numerosSemDDD.add(numero.slice(1));
  }

  // Alguns cadastros podem ter celular com o nono dígito e o Google sem ele.
  if (numero.length === 8) {
    numerosSemDDD.add(`9${numero}`);
  }

  const telefonesComDDD = new Set();
  if (ddd) {
    for (const n of numerosSemDDD) {
      telefonesComDDD.add(`${ddd}${n}`);
    }
  }

  // Fallback: caso o telefone já venha sem DDD na base ou formatado de outra forma.
  for (const n of numerosSemDDD) candidatos.add(n);
  for (const t of telefonesComDDD) candidatos.add(t);

  return {
    original: telefone,
    limpo,
    ddd,
    numero,
    telefonesComDDD: Array.from(telefonesComDDD),
    numerosSemDDD: Array.from(numerosSemDDD),
    todos: Array.from(candidatos).filter(Boolean)
  };
}

function formatarResultadoEmpresa(empresa, socios) {
  const cnpjLimpo = limparNumeros(empresa.cnpj);
  const socioPrincipal = escolherSocioPrincipal(socios);

  const telefonePrincipal = montarTelefone(empresa.ddd_1, empresa.telefone_1)
    || montarTelefone(empresa.ddd_2, empresa.telefone_2);

  const situacao = String(empresa.situacao_cadastral || '').trim();

  return {
    found: true,
    cnpj: formatarCNPJ(cnpjLimpo),
    cnpjFormatado: formatarCNPJ(cnpjLimpo),
    cnpjRaw: cnpjLimpo,
    razaoSocial: empresa.razao_social || empresa.nome_fantasia || 'Razão social não disponível',
    nomeFantasia: empresa.nome_fantasia || empresa.razao_social || 'Nome fantasia não disponível',
    situacao,
    situacaoAtiva: isSituacaoAtiva(situacao),
    dataAbertura: empresa.data_inicio_atividade || null,
    capitalSocial: Number(empresa.capital_social || 0),
    capitalSocialFormatado: formatarMoeda(empresa.capital_social),
    endereco: {
      logradouro: [empresa.tipo_logradouro, empresa.logradouro].filter(Boolean).join(' '),
      numero: empresa.numero || '',
      complemento: empresa.complemento || '',
      bairro: empresa.bairro || '',
      municipio: empresa.municipio || '',
      uf: empresa.uf || '',
      cep: empresa.cep || '',
      completo: montarEnderecoCompleto(empresa)
    },
    telefone: telefonePrincipal,
    email: empresa.email || null,
    cnae: empresa.cnae_fiscal_principal || null,
    socios: socios.map(s => ({
      nome: formatarNome(s.nome_socio),
      qualificacao: s.qualificacao_socio || 'Sócio',
      tipo: s.tipo_socio || null,
      cpfCnpj: s.cpf_cnpj_socio || null
    })),
    socioPrincipal,
    fonte: 'BigQuery - Base dos Dados',
    dataConsulta: new Date().toISOString()
  };
}

function escolherSocioPrincipal(socios) {
  if (!socios || socios.length === 0) return null;

  const administrador = socios.find(s => {
    const q = String(s.qualificacao_socio || '').toLowerCase();
    return q.includes('administrador') || q.includes('sócio-administrador') || q.includes('socio-administrador');
  });

  const escolhido = administrador || socios[0];

  return {
    nome: formatarNome(escolhido.nome_socio),
    qualificacao: escolhido.qualificacao_socio || 'Sócio',
    ehAdministrador: String(escolhido.qualificacao_socio || '').toLowerCase().includes('administrador')
  };
}

function limparNumeros(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function isSituacaoAtiva(situacao) {
  const s = String(situacao || '').trim().toUpperCase();
  return s === 'ATIVA' || s === '02' || s === '2';
}

function formatarCNPJ(cnpj) {
  const limpo = limparNumeros(cnpj).padStart(14, '0');
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarMoeda(valor) {
  const num = Number(valor || 0);
  return 'R$ ' + num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarNome(nome) {
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

function montarTelefone(ddd, telefone) {
  const d = limparNumeros(ddd);
  const t = limparNumeros(telefone);
  if (!t) return null;
  return d ? `(${d}) ${t}` : t;
}

function montarEnderecoCompleto(empresa) {
  const rua = [empresa.tipo_logradouro, empresa.logradouro].filter(Boolean).join(' ');
  const partes = [
    rua,
    empresa.numero,
    empresa.complemento,
    empresa.bairro,
    empresa.municipio && empresa.uf ? `${empresa.municipio}/${empresa.uf}` : empresa.municipio || empresa.uf,
    empresa.cep ? `CEP ${empresa.cep}` : null
  ].filter(Boolean);

  return partes.join(', ');
}
