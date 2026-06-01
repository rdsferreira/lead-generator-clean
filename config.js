// ============================================
// CONFIGURAÇÃO - GOOGLE MAPS / PLACES API
// ============================================

const CONFIG = {
    // Cole sua chave da API do Google aqui
    GOOGLE_API_KEY: 'AIzaSyB_vyjrjktpehkfAjAI0cET2C8tlbDcamw',

    // Configurações gerais
    MAX_RESULTS: 50,
    TIMEOUT: 10000
};

// ============================================
// VALIDAÇÃO DA CHAVE
// ============================================
function validarConfiguracao() {
    const chavesInvalidas = [
        'COLE_SUA_CHAVE_AQUI',
        'SUA_CHAVE_AQUI',
        'YOUR_API_KEY_HERE'
    ];

    if (!CONFIG.GOOGLE_API_KEY) {
        console.error('❌ ERRO: Chave da API do Google não configurada!');
        return false;
    }

    if (chavesInvalidas.includes(CONFIG.GOOGLE_API_KEY)) {
        console.error('❌ ERRO: Chave da API do Google não configurada!');
        return false;
    }

    if (CONFIG.GOOGLE_API_KEY.length < 30) {
        console.error('❌ ERRO: Chave da API parece inválida (muito curta)');
        return false;
    }

    console.log('✅ Configuração válida!');
    console.log(
        '🔑 Chave carregada:',
        CONFIG.GOOGLE_API_KEY.substring(0, 10) + '...' + CONFIG.GOOGLE_API_KEY.slice(-4)
    );

    return true;
}

if (typeof window !== 'undefined') {
    validarConfiguracao();
}
