// ============================================
// DIAGNÓSTICO - Verifica variáveis de ambiente
// ============================================
// Acesse: /api/diagnostico
// Este arquivo NÃO mostra valores sensíveis!

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;

  return res.status(200).json({
    mensagem: 'Diagnóstico das variáveis de ambiente',
    
    GOOGLE_CLOUD_PROJECT_ID: {
      existe: !!projectId,
      tamanho: projectId ? projectId.length : 0,
      primeiros5chars: projectId ? projectId.substring(0, 5) + '...' : 'VAZIO',
      temEspacos: projectId ? (projectId !== projectId.trim()) : false,
      temAspas: projectId ? (projectId.includes('"') || projectId.includes("'")) : false
    },
    
    GOOGLE_CLOUD_CLIENT_EMAIL: {
      existe: !!clientEmail,
      tamanho: clientEmail ? clientEmail.length : 0,
      primeiros10chars: clientEmail ? clientEmail.substring(0, 10) + '...' : 'VAZIO',
      terminaCom: clientEmail ? clientEmail.substring(clientEmail.length - 30) : 'VAZIO',
      temArroba: clientEmail ? clientEmail.includes('@') : false,
      temEspacos: clientEmail ? (clientEmail !== clientEmail.trim()) : false,
      temAspas: clientEmail ? (clientEmail.includes('"') || clientEmail.includes("'")) : false
    },
    
    GOOGLE_CLOUD_PRIVATE_KEY: {
      existe: !!privateKey,
      tamanho: privateKey ? privateKey.length : 0,
      comecaCom: privateKey ? privateKey.substring(0, 30) + '...' : 'VAZIO',
      temBeginKey: privateKey ? privateKey.includes('BEGIN PRIVATE KEY') : false,
      temEndKey: privateKey ? privateKey.includes('END PRIVATE KEY') : false,
      temBarraN: privateKey ? privateKey.includes('\\n') : false,
      temNewline: privateKey ? privateKey.includes('\n') : false,
      temEspacos: privateKey ? (privateKey !== privateKey.trim()) : false,
      temAspas: privateKey ? (privateKey.startsWith('"') || privateKey.startsWith("'")) : false
    },

    totalVariaveis: {
      encontradas: [!!projectId, !!clientEmail, !!privateKey].filter(Boolean).length,
      total: 3
    }
  });
}