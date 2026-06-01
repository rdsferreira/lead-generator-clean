// ============================================
// API SERVERLESS - BUSCAR CNPJ POR TELEFONE
// Versao v7-debug - sem consulta de socios
// Caminho correto: /api/buscar-cnpj.js
// ============================================

import { BigQuery } from '@google-cloud/bigquery';

const API_VERSION = 'v7-debug-sem-socios-2026-06-01';

function criarBigQueryClient() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Variaveis de ambiente ausentes no Vercel.');
  }

  return new BigQuery({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey
    }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query.version === '1' || req.query.debug === '1') {
    return res.status(200).json({
      ok: true,
      version: API_VERSION,
      observacao: 'Esta versao NAO consulta tabela de socios e NAO usa nome_socio.'
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido', version: API_VERSION });
  }

  try {
    const { telefone, uf } = req.query;

    if (!telefone) {
      return res.status(400).json({
        error: 'Telefone e obrigatorio',
        exemplo: '/api/buscar-cnpj?telefone=1132143347',
        version: API_VERSION
      });
    }

    const bigquery = criarBigQueryClient();
    const normalizado = normalizarTelefone(telefone);

    if (!normalizado.ddd || normalizado.numeros.length === 0) {
      return res.status(400).json({
        error: 'Telefone invalido',
        telefoneRecebido: telefone,
        version: API_VERSION
      });
    }

    const ufNormalizada = uf ? String(uf).trim().toUpperCase().slice(0, 2) : null;

    const queryEstabelecimento = `
      SELECT
        e.cnpj_basico,
        e.cnpj_ordem,
        e.cnpj_dv,
        CONCAT(e.cnpj_basico, e.cnpj_ordem, e.cnpj_dv) AS cnpj,
        e.nome_fantasia,
        CAST(e.situacao_cadastral AS STRING) AS situacao_cadastral,
        e.data_inicio_atividade,
        e.tipo_logradouro,
        e.logradouro,
        e.numero,
        e.complemento,
        e.bairro,
        e.id_municipio,
        e.sigla_uf,
        e.cep,
        CAST(e.ddd_1 AS STRING) AS ddd_1,
        CAST(e.telefone_1 AS STRING) AS telefone_1,
        CAST(e.ddd_2 AS STRING) AS ddd_2,
        CAST(e.telefone_2 AS STRING) AS telefone_2,
        e.email,
        e.cnae_fiscal_principal
      FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
      WHERE
        (@uf IS NULL OR e.sigla_uf = @uf)
        AND (
          (CAST(e.ddd_1 AS STRING) = @ddd AND CAST(e.telefone_1 AS STRING) IN UNNEST(@numeros))
          OR
          (CAST(e.ddd_2 AS STRING) = @ddd AND CAST(e.telefone_2 AS STRING) IN UNNEST(@numeros))
        )
      ORDER BY
        CASE
          WHEN CAST(e.situacao_cadastral AS STRING) IN ('2', '02', 'ATIVA') THEN 0
          ELSE 1
        END,
        e.data_inicio_atividade DESC
      LIMIT 1
    `;

    const [estabelecimentos] = await bigquery.query({
      query: queryEstabelecimento,
      location: 'US',
      params: {
        ddd: normalizado.ddd,
        numeros: normalizado.numeros,
        uf: ufNormalizada
      },
      types: {
        ddd: 'STRING',
        numeros: ['STRING'],
        uf: 'STRING'
      }
    });

    if (!estabelecimentos || estabelecimentos.length === 0) {
      return res.status(404).json({
        found: false,
        message: 'CNPJ nao encontrado para este telefone',
        telefone,
        tentativa: {
          ddd: normalizado.ddd,
          numeros: normalizado.numeros,
          uf: ufNormalizada
        },
        version: API_VERSION
      });
    }

    const est = estabelecimentos[0];

    const queryEmpresa = `
      SELECT
        razao_social,
        capital_social,
        natureza_juridica,
        qualificacao_responsavel
      FROM \`basedosdados.br_me_cnpj.empresas\`
      WHERE cnpj_basico = @cnpjBasico
      LIMIT 1
    `;

    const [empresas] = await bigquery.query({
      query: queryEmpresa,
      location: 'US',
      params: { cnpjBasico: est.cnpj_basico },
      types: { cnpjBasico: 'STRING' }
    });

    const emp = empresas?.[0] || {};

    return res.status(200).json({
      found: true,
      version: API_VERSION,
      cnpj: formatarCNPJ(est.cnpj),
      cnpjRaw: est.cnpj,
      razaoSocial: emp.razao_social || est.nome_fantasia || 'Razao social nao disponivel',
      nomeFantasia: est.nome_fantasia || emp.razao_social || 'Nome fantasia nao disponivel',
      situacao: traduzirSituacao(est.situacao_cadastral),
      situacaoCodigo: est.situacao_cadastral,
      situacaoAtiva: ['2', '02', 'ATIVA'].includes(String(est.situacao_cadastral).toUpperCase()),
      dataAbertura: est.data_inicio_atividade || null,
      capitalSocial: parseFloat(emp.capital_social || 0),
      capitalSocialFormatado: formatarMoeda(emp.capital_social),
      endereco: {
        logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' '),
        numero: est.numero || '',
        complemento: est.complemento || '',
        bairro: est.bairro || '',
        municipio: est.id_municipio || '',
        uf: est.sigla_uf || '',
        cep: est.cep || '',
        completo: montarEnderecoCompleto(est)
      },
      telefone: montarTelefone(est.ddd_1, est.telefone_1) || montarTelefone(est.ddd_2, est.telefone_2),
      email: est.email || null,
      cnae: est.cnae_fiscal_principal || null,
      socios: [],
      socioPrincipal: null,
      fonte: 'BigQuery - Base dos Dados',
      dataConsulta: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Erro ao consultar BigQuery',
      message: error.message,
      version: API_VERSION
    });
  }
}

function normalizarTelefone(valor) {
  let digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length > 11) digitos = digitos.slice(2);
  if (digitos.length < 10) return { ddd: null, numeros: [] };

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const variantes = new Set([numero]);

  if (numero.length === 9 && numero.startsWith('9')) variantes.add(numero.slice(1));
  if (numero.length === 8) variantes.add(numero);
  variantes.add(numero.replace(/^0+/, ''));

  return {
    ddd,
    numeros: Array.from(variantes).filter(n => n && n.length >= 8)
  };
}

function formatarCNPJ(cnpj) {
  const limpo = String(cnpj || '').replace(/\D/g, '').padStart(14, '0');
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarMoeda(valor) {
  const num = parseFloat(valor || 0);
  return 'R$ ' + num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function traduzirSituacao(codigo) {
  const valor = String(codigo || '').toUpperCase();
  const mapa = {
    '1': 'NULA',
    '01': 'NULA',
    '2': 'ATIVA',
    '02': 'ATIVA',
    '3': 'SUSPENSA',
    '03': 'SUSPENSA',
    '4': 'INAPTA',
    '04': 'INAPTA',
    '8': 'BAIXADA',
    '08': 'BAIXADA',
    'ATIVA': 'ATIVA'
  };
  return mapa[valor] || valor || 'NAO INFORMADA';
}

function montarTelefone(ddd, telefone) {
  if (!ddd || !telefone) return null;
  return `(${ddd}) ${telefone}`;
}

function montarEnderecoCompleto(est) {
  return [
    [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' '),
    est.numero,
    est.complemento,
    est.bairro,
    est.sigla_uf ? `UF: ${est.sigla_uf}` : null,
    est.cep ? `CEP: ${est.cep}` : null
  ].filter(Boolean).join(', ');
}
