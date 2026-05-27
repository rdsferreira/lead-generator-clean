// ============================================
// API SERVERLESS - BUSCAR CNPJ POR TELEFONE
// Arquivo correto: /api/buscar-cnpj.js
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  try {
    const { telefone } = req.query;

    if (!telefone) {
      return res.status(400).json({
        error: 'Telefone e obrigatorio',
        exemplo: '/api/buscar-cnpj?telefone=1132143347',
      });
    }

    const normalizado = normalizarTelefone(telefone);

    console.log('🔍 Buscando CNPJ por telefone:', {
      recebido: telefone,
      telefoneCompleto: normalizado.telefoneCompleto,
      numero: normalizado.numero,
      telefoneSem9: normalizado.telefoneSem9,
      numeroSem9: normalizado.numeroSem9,
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
        mun.nome AS municipio,
        e.sigla_uf AS uf,
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
      LEFT JOIN \`basedosdados.br_bd_diretorios_brasil.municipio\` mun
        ON e.id_municipio = mun.id_municipio
      WHERE
        CONCAT(
          REGEXP_REPLACE(COALESCE(CAST(e.ddd_1 AS STRING), ''), r'\\D', ''),
          REGEXP_REPLACE(COALESCE(CAST(e.telefone_1 AS STRING), ''), r'\\D', '')
        ) IN (@telefoneCompleto, @telefoneSem9)
        OR CONCAT(
          REGEXP_REPLACE(COALESCE(CAST(e.ddd_2 AS STRING), ''), r'\\D', ''),
          REGEXP_REPLACE(COALESCE(CAST(e.telefone_2 AS STRING), ''), r'\\D', '')
        ) IN (@telefoneCompleto, @telefoneSem9)
        OR REGEXP_REPLACE(COALESCE(CAST(e.telefone_1 AS STRING), ''), r'\\D', '') IN (@numero, @numeroSem9)
        OR REGEXP_REPLACE(COALESCE(CAST(e.telefone_2 AS STRING), ''), r'\\D', '') IN (@numero, @numeroSem9)
      ORDER BY
        CASE
          WHEN CAST(e.situacao_cadastral AS STRING) = '2' THEN 1
          WHEN UPPER(CAST(e.situacao_cadastral AS STRING)) = 'ATIVA' THEN 1
          ELSE 2
        END
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'US',
      params: {
        telefoneCompleto: normalizado.telefoneCompleto,
        telefoneSem9: normalizado.telefoneSem9 || normalizado.telefoneCompleto,
        numero: normalizado.numero,
        numeroSem9: normalizado.numeroSem9 || normalizado.numero,
      },
    });

    if (!rows || rows.length === 0) {
      console.log('⚠️ CNPJ nao encontrado para este telefone');
      return res.status(404).json({
        found: false,
        message: 'CNPJ nao encontrado para este telefone',
        telefone,
        telefoneNormalizado: normalizado.telefoneCompleto,
      });
    }

    const empresa = rows[0];
    const cnpjRaw = limparNumeros(empresa.cnpj);
    const cnpjBasico = empresa.cnpj_basico || cnpjRaw.substring(0, 8);

    console.log('✅ CNPJ encontrado:', cnpjRaw);

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
          WHEN UPPER(COALESCE(CAST(qualificacao_socio AS STRING), '')) LIKE '%ADMINISTRADOR%' THEN 1
          ELSE 2
        END
      LIMIT 10
    `;

    let socios = [];
    try {
      const [sociosRows] = await bigquery.query({
        query: querySocios,
        location: 'US',
        params: { cnpjBasico },
      });
      socios = sociosRows || [];
    } catch (socioError) {
      console.warn('⚠️ Nao foi possivel buscar socios:', socioError.message);
    }

    const situacaoTexto = formatarSituacao(empresa.situacao_cadastral);

    const resultado = {
      found: true,
      cnpj: formatarCNPJ(cnpjRaw),
      cnpjRaw,
      razaoSocial: empresa.razao_social,
      nomeFantasia: empresa.nome_fantasia || empresa.razao_social,
      situacao: situacaoTexto,
      situacaoAtiva: situacaoTexto === 'ATIVA',
      dataAbertura: empresa.data_inicio_atividade,
      capitalSocial: parseFloat(empresa.capital_social || 0),
      capitalSocialFormatado: formatarMoeda(empresa.capital_social),
      endereco: {
        logradouro: [empresa.tipo_logradouro, empresa.logradouro].filter(Boolean).join(' '),
        numero: empresa.numero,
        complemento: empresa.complemento,
        bairro: empresa.bairro,
        municipio: empresa.municipio,
        uf: empresa.uf,
        cep: empresa.cep,
        completo: montarEnderecoCompleto(empresa),
      },
      telefone: montarTelefone(empresa.ddd_1, empresa.telefone_1) || montarTelefone(empresa.ddd_2, empresa.telefone_2),
      email: empresa.email || null,
      cnae: empresa.cnae_fiscal_principal,
      socios: socios.map((s) => ({
        nome: s.nome_socio ? formatarNome(s.nome_socio) : null,
        qualificacao: s.qualificacao_socio,
        tipo: s.tipo_socio,
        cpfCnpj: s.cpf_cnpj_socio,
      })),
      socioPrincipal: socios[0]
        ? {
            nome: formatarNome(socios[0].nome_socio),
            qualificacao: socios[0].qualificacao_socio,
            ehAdministrador: String(socios[0].qualificacao_socio || '')
              .toLowerCase()
              .includes('administrador'),
          }
        : null,
      fonte: 'BigQuery - Base dos Dados',
      dataConsulta: new Date().toISOString(),
    };

    return res.status(200).json(resultado);
  } catch (error) {
    console.error('❌ Erro ao buscar CNPJ:', error);
    return res.status(500).json({
      error: 'Erro ao consultar BigQuery',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

function limparNumeros(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function normalizarTelefone(telefone) {
  let digits = limparNumeros(telefone);

  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }

  const telefoneCompleto = digits;
  const ddd = digits.length >= 10 ? digits.slice(0, 2) : '';
  const numero = digits.length >= 10 ? digits.slice(2) : digits;

  let telefoneSem9 = telefoneCompleto;
  let numeroSem9 = numero;

  if (ddd && numero.length === 9 && numero.startsWith('9')) {
    numeroSem9 = numero.slice(1);
    telefoneSem9 = ddd + numeroSem9;
  }

  return { telefoneCompleto, ddd, numero, telefoneSem9, numeroSem9 };
}

function formatarCNPJ(cnpj) {
  const limpo = limparNumeros(cnpj).padStart(14, '0');
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarSituacao(situacao) {
  const texto = String(situacao || '').trim();
  const mapa = {
    '1': 'NULA',
    '2': 'ATIVA',
    '3': 'SUSPENSA',
    '4': 'INAPTA',
    '8': 'BAIXADA',
  };
  return mapa[texto] || texto.toUpperCase();
}

function formatarMoeda(valor) {
  if (!valor) return 'R$ 0,00';
  const num = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : valor;
  return 'R$ ' + Number(num || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function montarTelefone(ddd, telefone) {
  const d = limparNumeros(ddd);
  const t = limparNumeros(telefone);
  if (!t) return null;
  return d ? `(${d}) ${t}` : t;
}

function montarEnderecoCompleto(empresa) {
  return [
    [empresa.tipo_logradouro, empresa.logradouro].filter(Boolean).join(' '),
    empresa.numero,
    empresa.complemento,
    empresa.bairro,
    [empresa.municipio, empresa.uf].filter(Boolean).join('/'),
    empresa.cep,
  ]
    .filter(Boolean)
    .join(', ');
}

function formatarNome(nome) {
  if (!nome) return '';
  return String(nome)
    .toLowerCase()
    .split(' ')
    .map((palavra) => {
      if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ');
}
