// ============================================
// API SERVERLESS - BUSCAR CNPJ
// Versao v8 - CNPJ com criterios de confianca
// Caminho correto: /api/buscar-cnpj.js
// ============================================

import { BigQuery } from '@google-cloud/bigquery';

const API_VERSION = 'v8-cnpj-confianca-2026-06-01';
const CONFIANCA_MINIMA = 75;

function criarBigQueryClient() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Variaveis de ambiente ausentes no Vercel.');
  }

  return new BigQuery({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.query.version === '1' || req.query.debug === '1') {
    return res.status(200).json({ ok: true, version: API_VERSION, regra: 'Aceita somente CNPJ com confianca >= ' + CONFIANCA_MINIMA });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo nao permitido', version: API_VERSION });

  try {
    const { telefone, nome, endereco, bairro, uf, cidade, numero } = req.query;
    if (!telefone && !nome && !endereco) {
      return res.status(400).json({ error: 'Informe pelo menos telefone, nome ou endereco', version: API_VERSION });
    }

    const bigquery = criarBigQueryClient();
    const contexto = {
      telefone: String(telefone || ''),
      nome: String(nome || ''),
      endereco: String(endereco || ''),
      bairro: String(bairro || ''),
      uf: uf ? String(uf).trim().toUpperCase().slice(0, 2) : extrairUF(String(endereco || '')),
      cidade: String(cidade || ''),
      numero: String(numero || '') || extrairNumero(String(endereco || ''))
    };

    let candidatos = [];
    if (contexto.telefone) candidatos = await buscarPorTelefone(bigquery, contexto);
    if (candidatos.length === 0 && contexto.nome && contexto.uf) candidatos = await buscarPorNome(bigquery, contexto);
    if (candidatos.length === 0 && contexto.endereco && contexto.uf) candidatos = await buscarPorEndereco(bigquery, contexto);

    if (!candidatos || candidatos.length === 0) {
      return res.status(404).json({ found: false, message: 'CNPJ nao encontrado com os criterios informados', criteriosRecebidos: contexto, version: API_VERSION });
    }

    const avaliados = candidatos.map(c => ({ ...c, match: calcularConfianca(c, contexto) })).sort((a, b) => b.match.score - a.match.score);
    const melhor = avaliados[0];

    if (!melhor || melhor.match.score < CONFIANCA_MINIMA) {
      return res.status(404).json({ found: false, message: 'Possivel CNPJ encontrado, mas confianca abaixo do minimo', confiancaMinima: CONFIANCA_MINIMA, melhorScore: melhor?.match?.score || 0, criteriosRecebidos: contexto, version: API_VERSION });
    }

    const empresa = await buscarEmpresa(bigquery, melhor.cnpj_basico);
    return res.status(200).json(montarResultado(melhor, empresa, contexto));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao consultar BigQuery', message: error.message, version: API_VERSION });
  }
}

async function buscarPorTelefone(bigquery, contexto) {
  const normalizado = normalizarTelefone(contexto.telefone);
  if (!normalizado.ddd || normalizado.numeros.length === 0) return [];
  const query = `
    SELECT e.cnpj_basico, e.cnpj_ordem, e.cnpj_dv,
      CONCAT(e.cnpj_basico, e.cnpj_ordem, e.cnpj_dv) AS cnpj,
      e.nome_fantasia, CAST(e.situacao_cadastral AS STRING) AS situacao_cadastral,
      e.data_inicio_atividade, e.tipo_logradouro, e.logradouro, e.numero, e.complemento,
      e.bairro, e.id_municipio, e.sigla_uf, e.cep,
      CAST(e.ddd_1 AS STRING) AS ddd_1, CAST(e.telefone_1 AS STRING) AS telefone_1,
      CAST(e.ddd_2 AS STRING) AS ddd_2, CAST(e.telefone_2 AS STRING) AS telefone_2,
      e.email, e.cnae_fiscal_principal, 'telefone' AS criterio_primario
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    WHERE (@uf IS NULL OR e.sigla_uf = @uf)
      AND ((CAST(e.ddd_1 AS STRING) = @ddd AND CAST(e.telefone_1 AS STRING) IN UNNEST(@numeros))
      OR (CAST(e.ddd_2 AS STRING) = @ddd AND CAST(e.telefone_2 AS STRING) IN UNNEST(@numeros)))
    ORDER BY CASE WHEN CAST(e.situacao_cadastral AS STRING) IN ('2','02','ATIVA') THEN 0 ELSE 1 END,
      e.data_inicio_atividade DESC
    LIMIT 5`;
  const [rows] = await bigquery.query({ query, location: 'US', params: { ddd: normalizado.ddd, numeros: normalizado.numeros, uf: contexto.uf || null }, types: { ddd: 'STRING', numeros: ['STRING'], uf: 'STRING' } });
  return rows || [];
}

async function buscarPorNome(bigquery, contexto) {
  const tokens = tokensBusca(contexto.nome).slice(0, 4);
  if (tokens.length === 0) return [];
  const query = `
    SELECT e.cnpj_basico, e.cnpj_ordem, e.cnpj_dv,
      CONCAT(e.cnpj_basico, e.cnpj_ordem, e.cnpj_dv) AS cnpj,
      e.nome_fantasia, CAST(e.situacao_cadastral AS STRING) AS situacao_cadastral,
      e.data_inicio_atividade, e.tipo_logradouro, e.logradouro, e.numero, e.complemento,
      e.bairro, e.id_municipio, e.sigla_uf, e.cep,
      CAST(e.ddd_1 AS STRING) AS ddd_1, CAST(e.telefone_1 AS STRING) AS telefone_1,
      CAST(e.ddd_2 AS STRING) AS ddd_2, CAST(e.telefone_2 AS STRING) AS telefone_2,
      e.email, e.cnae_fiscal_principal, 'nome' AS criterio_primario
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    WHERE e.sigla_uf = @uf AND e.nome_fantasia IS NOT NULL
      AND (UPPER(e.nome_fantasia) LIKE @token1 OR UPPER(e.nome_fantasia) LIKE @token2 OR UPPER(e.nome_fantasia) LIKE @token3 OR UPPER(e.nome_fantasia) LIKE @token4)
    ORDER BY CASE WHEN CAST(e.situacao_cadastral AS STRING) IN ('2','02','ATIVA') THEN 0 ELSE 1 END,
      e.data_inicio_atividade DESC
    LIMIT 15`;
  const params = { uf: contexto.uf, token1: `%${tokens[0] || '__NAO_EXISTE__'}%`, token2: `%${tokens[1] || '__NAO_EXISTE__'}%`, token3: `%${tokens[2] || '__NAO_EXISTE__'}%`, token4: `%${tokens[3] || '__NAO_EXISTE__'}%` };
  const [rows] = await bigquery.query({ query, location: 'US', params, types: { uf: 'STRING', token1: 'STRING', token2: 'STRING', token3: 'STRING', token4: 'STRING' } });
  return rows || [];
}

async function buscarPorEndereco(bigquery, contexto) {
  const bairroNorm = normalizarTexto(contexto.bairro);
  const numero = contexto.numero;
  if (!numero && !bairroNorm) return [];
  const query = `
    SELECT e.cnpj_basico, e.cnpj_ordem, e.cnpj_dv,
      CONCAT(e.cnpj_basico, e.cnpj_ordem, e.cnpj_dv) AS cnpj,
      e.nome_fantasia, CAST(e.situacao_cadastral AS STRING) AS situacao_cadastral,
      e.data_inicio_atividade, e.tipo_logradouro, e.logradouro, e.numero, e.complemento,
      e.bairro, e.id_municipio, e.sigla_uf, e.cep,
      CAST(e.ddd_1 AS STRING) AS ddd_1, CAST(e.telefone_1 AS STRING) AS telefone_1,
      CAST(e.ddd_2 AS STRING) AS ddd_2, CAST(e.telefone_2 AS STRING) AS telefone_2,
      e.email, e.cnae_fiscal_principal, 'endereco' AS criterio_primario
    FROM \`basedosdados.br_me_cnpj.estabelecimentos\` e
    WHERE e.sigla_uf = @uf
      AND (@numero IS NULL OR CAST(e.numero AS STRING) = @numero)
      AND (@bairro IS NULL OR UPPER(e.bairro) LIKE @bairro)
    ORDER BY CASE WHEN CAST(e.situacao_cadastral AS STRING) IN ('2','02','ATIVA') THEN 0 ELSE 1 END,
      e.data_inicio_atividade DESC
    LIMIT 15`;
  const [rows] = await bigquery.query({ query, location: 'US', params: { uf: contexto.uf, numero: numero || null, bairro: bairroNorm ? `%${bairroNorm}%` : null }, types: { uf: 'STRING', numero: 'STRING', bairro: 'STRING' } });
  return rows || [];
}

async function buscarEmpresa(bigquery, cnpjBasico) {
  const query = `SELECT razao_social, capital_social, natureza_juridica, qualificacao_responsavel FROM \`basedosdados.br_me_cnpj.empresas\` WHERE cnpj_basico = @cnpjBasico LIMIT 1`;
  const [rows] = await bigquery.query({ query, location: 'US', params: { cnpjBasico }, types: { cnpjBasico: 'STRING' } });
  return rows?.[0] || {};
}

function calcularConfianca(c, contexto) {
  let score = 0; const motivos = [];
  if (contexto.uf && String(c.sigla_uf || '').toUpperCase() === contexto.uf) { score += 10; motivos.push('UF confere'); }
  const normalizado = normalizarTelefone(contexto.telefone);
  if (normalizado.ddd) {
    const ok = (String(c.ddd_1 || '') === normalizado.ddd && normalizado.numeros.includes(String(c.telefone_1 || ''))) || (String(c.ddd_2 || '') === normalizado.ddd && normalizado.numeros.includes(String(c.telefone_2 || '')));
    if (ok) { score += 70; motivos.push('Telefone confere'); }
  }
  const nomeLead = normalizarTexto(contexto.nome); const nomeFantasia = normalizarTexto(c.nome_fantasia || '');
  if (nomeLead && nomeFantasia) { const sim = similaridadeTokens(nomeLead, nomeFantasia); if (sim >= 0.75) { score += 25; motivos.push('Nome muito parecido'); } else if (sim >= 0.45) { score += 15; motivos.push('Nome parcialmente parecido'); } }
  const bairroLead = normalizarTexto(contexto.bairro); const bairroCnpj = normalizarTexto(c.bairro || '');
  if (bairroLead && bairroCnpj && (bairroLead.includes(bairroCnpj) || bairroCnpj.includes(bairroLead))) { score += 10; motivos.push('Bairro confere'); }
  if (contexto.numero && String(c.numero || '') === String(contexto.numero)) { score += 15; motivos.push('Numero do endereco confere'); }
  const enderecoLead = normalizarTexto(contexto.endereco); const logradouroCnpj = normalizarTexto(`${c.tipo_logradouro || ''} ${c.logradouro || ''}`);
  if (enderecoLead && logradouroCnpj) { const termosRua = tokensBusca(logradouroCnpj); if (termosRua.some(t => enderecoLead.includes(t))) { score += 15; motivos.push('Logradouro parecido'); } }
  if (['2','02','ATIVA'].includes(String(c.situacao_cadastral || '').toUpperCase())) { score += 10; motivos.push('Empresa ativa'); }
  score = Math.min(score, 100);
  return { score, nivel: score >= 90 ? 'Alta' : score >= 75 ? 'Boa' : score >= 60 ? 'Media' : 'Baixa', motivos };
}

function montarResultado(est, empresa, contexto) {
  return { found: true, version: API_VERSION, cnpj: formatarCNPJ(est.cnpj), cnpjRaw: est.cnpj,
    razaoSocial: empresa.razao_social || est.nome_fantasia || 'Razao social nao disponivel', nomeFantasia: est.nome_fantasia || empresa.razao_social || 'Nome fantasia nao disponivel',
    situacao: traduzirSituacao(est.situacao_cadastral), situacaoCodigo: est.situacao_cadastral, situacaoAtiva: ['2','02','ATIVA'].includes(String(est.situacao_cadastral).toUpperCase()),
    dataAbertura: est.data_inicio_atividade || null, capitalSocial: parseFloat(empresa.capital_social || 0), capitalSocialFormatado: formatarMoeda(empresa.capital_social),
    endereco: { logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' '), numero: est.numero || '', complemento: est.complemento || '', bairro: est.bairro || '', municipio: est.id_municipio || '', uf: est.sigla_uf || '', cep: est.cep || '', completo: montarEnderecoCompleto(est) },
    telefone: montarTelefone(est.ddd_1, est.telefone_1) || montarTelefone(est.ddd_2, est.telefone_2), email: est.email || null, cnae: est.cnae_fiscal_principal || null,
    socios: [], socioPrincipal: null, match: est.match || calcularConfianca(est, contexto), fonte: 'BigQuery - Base dos Dados', dataConsulta: new Date().toISOString() };
}

function normalizarTelefone(valor) { let digitos = String(valor || '').replace(/\D/g, ''); if (digitos.startsWith('55') && digitos.length > 11) digitos = digitos.slice(2); if (digitos.length < 10) return { ddd: null, numeros: [] }; const ddd = digitos.slice(0, 2); const numero = digitos.slice(2); const variantes = new Set([numero]); if (numero.length === 9 && numero.startsWith('9')) variantes.add(numero.slice(1)); if (numero.length === 8) variantes.add(numero); variantes.add(numero.replace(/^0+/, '')); return { ddd, numeros: Array.from(variantes).filter(n => n && n.length >= 8) }; }
function normalizarTexto(txt) { return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function tokensBusca(txt) { const stop = new Set(['DE','DA','DO','DOS','DAS','E','A','O','AS','OS','LTDA','ME','EIRELI','RESTAURANTE','PADARIA','PIZZARIA','BAR','CAFE']); return normalizarTexto(txt).split(' ').filter(t => t.length >= 3 && !stop.has(t)); }
function similaridadeTokens(a, b) { const ta = new Set(tokensBusca(a)); const tb = new Set(tokensBusca(b)); if (ta.size === 0 || tb.size === 0) return 0; let inter = 0; for (const t of ta) if (tb.has(t)) inter++; return inter / Math.max(ta.size, tb.size); }
function extrairUF(txt) { const m = String(txt || '').match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i); return m ? m[1].toUpperCase() : null; }
function extrairNumero(endereco) { const m = String(endereco || '').match(/,\s*(\d{1,6})\b/); return m ? m[1] : ''; }
function formatarCNPJ(cnpj) { const limpo = String(cnpj || '').replace(/\D/g, '').padStart(14, '0'); return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'); }
function formatarMoeda(valor) { const num = parseFloat(valor || 0); return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function traduzirSituacao(codigo) { const valor = String(codigo || '').toUpperCase(); const mapa = {'1':'NULA','01':'NULA','2':'ATIVA','02':'ATIVA','3':'SUSPENSA','03':'SUSPENSA','4':'INAPTA','04':'INAPTA','8':'BAIXADA','08':'BAIXADA','ATIVA':'ATIVA'}; return mapa[valor] || valor || 'NAO INFORMADA'; }
function montarTelefone(ddd, telefone) { if (!ddd || !telefone) return null; return `(${ddd}) ${telefone}`; }
function montarEnderecoCompleto(est) { return [[est.tipo_logradouro, est.logradouro].filter(Boolean).join(' '), est.numero, est.complemento, est.bairro, est.sigla_uf ? `UF: ${est.sigla_uf}` : null, est.cep ? `CEP: ${est.cep}` : null].filter(Boolean).join(', '); }
