// ============================================
// CONFIGURAÇÃO - COLOQUE SUA CHAVE AQUI
// ============================================

// ⚠️ IMPORTANTE: Este arquivo contém informações sensíveis!
// NÃO compartilhe este arquivo com ninguém
// NÃO suba este arquivo para GitHub público

const CONFIG = {
    // Cole sua chave da API do Google aqui (entre as aspas)
    GOOGLE_API_KEY: 'AIzaSyCncAHvmbabdqa7bbW79A1bQ-iThwOSgzM',
    
    // Configurações gerais
    MAX_RESULTS: 50,  // Máximo de leads por busca
    TIMEOUT: 10000    // Tempo máximo de espera (10 segundos)
};

// ============================================
// VALIDAÇÃO DA CHAVE
// ============================================
function validarConfiguracao() {
    // Lista de chaves inválidas (exemplos que não devem ser usados)
    const chavesInvalidas = [
        'COLE_SUA_CHAVE_AQUI',
        'SUA_CHAVE_AQUI',
        'YOUR_API_KEY_HERE'
    ];
    
    // Verifica se a chave existe
    if (!CONFIG.GOOGLE_API_KEY) {
        console.error('❌ ERRO: Chave da API do Google não configurada!');
        console.log('📝 Abra o arquivo config.js e cole sua chave na linha 10');
        return false;
    }
    
    // Verifica se é uma das chaves de exemplo
    if (chavesInvalidas.includes(CONFIG.GOOGLE_API_KEY)) {
        console.error('❌ ERRO: Chave da API do Google não configurada!');
        console.log('📝 Abra o arquivo config.js e cole sua chave na linha 10');
        return false;
    }
    
    // Verifica tamanho mínimo
    if (CONFIG.GOOGLE_API_KEY.length < 30) {
        console.error('❌ ERRO: Chave da API parece inválida (muito curta)');
        return false;
    }
    
    console.log('✅ Configuração válida!');
    console.log('🔑 Chave carregada:', CONFIG.GOOGLE_API_KEY.substring(0, 10) + '...' + CONFIG.GOOGLE_API_KEY.slice(-4));
    return true;
}

// Valida quando o arquivo carrega
if (typeof window !== 'undefined') {
    validarConfiguracao();
}
