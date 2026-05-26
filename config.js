// ============================================
// CONFIGURAÇÃO - GOOGLE PLACES API
// ============================================
// IMPORTANTE:
// 1) Por segurança, não deixe uma chave real exposta em repositório público.
// 2) Crie/restrinja sua chave no Google Cloud para aceitar apenas o domínio do seu Vercel.
// 3) Depois cole a chave abaixo, entre as aspas.

const CONFIG = {
    GOOGLE_API_KEY: 'COLE_SUA_CHAVE_AQUI',
    MAX_RESULTS: 50,
    TIMEOUT: 10000
};

function validarConfiguracao() {
    const chavesInvalidas = [
        'COLE_SUA_CHAVE_AQUI',
        'SUA_CHAVE_AQUI',
        'YOUR_API_KEY_HERE'
    ];

    if (!CONFIG.GOOGLE_API_KEY || chavesInvalidas.includes(CONFIG.GOOGLE_API_KEY)) {
        console.error('❌ ERRO: Chave da API do Google não configurada.');
        console.log('📝 Abra config.js e cole sua chave em GOOGLE_API_KEY.');
        return false;
    }

    if (CONFIG.GOOGLE_API_KEY.length < 30) {
        console.error('❌ ERRO: Chave da API parece inválida ou muito curta.');
        return false;
    }

    console.log('✅ Configuração válida!');
    console.log('🔑 Chave carregada:', CONFIG.GOOGLE_API_KEY.substring(0, 10) + '...' + CONFIG.GOOGLE_API_KEY.slice(-4));
    return true;
}

if (typeof window !== 'undefined') {
    validarConfiguracao();
}
