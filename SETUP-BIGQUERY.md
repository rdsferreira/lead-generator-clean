# 🚀 SETUP COMPLETO - BigQuery + Vercel

## 📋 CHECKLIST GERAL

```
✅ Conta Google Cloud (você já tem!)
⬜ Ativar BigQuery API
⬜ Criar Service Account
⬜ Gerar chave JSON
⬜ Configurar Vercel
⬜ Deploy!
```

---

# PARTE 1: CONFIGURAR GOOGLE CLOUD

## 1️⃣ ATIVAR BIGQUERY API

### **Passo 1: Ir para Google Cloud Console**
```
https://console.cloud.google.com
```

### **Passo 2: Selecionar seu projeto**
- No topo da página, clique no nome do projeto
- Selecione o projeto que você criou

### **Passo 3: Ativar BigQuery API**
```
1. No menu lateral (☰), vá em: APIs e Serviços → Biblioteca
2. Busque: "BigQuery API"
3. Clique em "BigQuery API"
4. Clique em "ATIVAR"
5. Aguarde ~10 segundos
```

✅ **Pronto! API ativada!**

---

## 2️⃣ CRIAR SERVICE ACCOUNT

### **O que é?**
Uma "conta de serviço" que o Vercel vai usar para acessar o BigQuery.

### **Passo 1: Ir para Service Accounts**
```
Menu (☰) → IAM e Admin → Contas de serviço
```

### **Passo 2: Criar nova conta**
```
1. Clique em "+ CRIAR CONTA DE SERVIÇO"

2. Preencha:
   Nome: lead-generator-bigquery
   ID: lead-generator-bigquery
   Descrição: Acesso ao BigQuery para Lead Generator

3. Clique em "CRIAR E CONTINUAR"
```

### **Passo 3: Dar permissões**
```
1. Em "Conceder acesso ao projeto":
   
   Adicione função: BigQuery Job User
   Clique em "+ ADICIONAR OUTRA FUNÇÃO"
   Adicione função: BigQuery Data Viewer

2. Clique em "CONTINUAR"

3. Clique em "CONCLUIR"
```

✅ **Service Account criada!**

---

## 3️⃣ GERAR CHAVE JSON

### **Passo 1: Na lista de Service Accounts**
```
1. Encontre: lead-generator-bigquery
2. Clique nos 3 pontinhos (⋮) do lado direito
3. Clique em "Gerenciar chaves"
```

### **Passo 2: Criar chave**
```
1. Clique em "ADICIONAR CHAVE"
2. Clique em "Criar nova chave"
3. Selecione tipo: JSON
4. Clique em "CRIAR"
```

**Um arquivo JSON vai baixar automaticamente!**

### **Passo 3: Guardar o arquivo**
```
Arquivo baixado: lead-generator-bigquery-xxxxx.json

⚠️ IMPORTANTE: Não compartilhe este arquivo!
⚠️ Não suba para GitHub!
⚠️ Guarde em local seguro!
```

### **Passo 4: Abrir o arquivo**
Abra o arquivo JSON em qualquer editor de texto.

Você vai ver algo assim:
```json
{
  "type": "service_account",
  "project_id": "seu-projeto-123456",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "lead-generator-bigquery@seu-projeto.iam.gserviceaccount.com",
  "client_id": "123456789",
  ...
}
```

**Você vai precisar de 3 valores:**
1. `project_id`
2. `client_email`
3. `private_key` (a chave inteira, com \n)

---

# PARTE 2: CONFIGURAR VERCEL

## 4️⃣ ADICIONAR VARIÁVEIS DE AMBIENTE

### **Passo 1: Ir para Vercel**
```
https://vercel.com
Login → Selecione seu projeto
```

### **Passo 2: Settings → Environment Variables**
```
1. Clique em "Settings" (no topo)
2. Clique em "Environment Variables" (menu lateral)
```

### **Passo 3: Adicionar 3 variáveis**

#### **Variável 1: GOOGLE_CLOUD_PROJECT_ID**
```
Name: GOOGLE_CLOUD_PROJECT_ID
Value: [copie o project_id do JSON]

Exemplo: meu-projeto-lead-generator

Environment: Production, Preview, Development
Clique em "Save"
```

#### **Variável 2: GOOGLE_CLOUD_CLIENT_EMAIL**
```
Name: GOOGLE_CLOUD_CLIENT_EMAIL
Value: [copie o client_email do JSON]

Exemplo: lead-generator-bigquery@meu-projeto.iam.gserviceaccount.com

Environment: Production, Preview, Development
Clique em "Save"
```

#### **Variável 3: GOOGLE_CLOUD_PRIVATE_KEY**
```
Name: GOOGLE_CLOUD_PRIVATE_KEY
Value: [copie a private_key INTEIRA do JSON, incluindo os \n]

⚠️ IMPORTANTE: Cole EXATAMENTE como está no JSON, incluindo:
-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n

Environment: Production, Preview, Development
Clique em "Save"
```

✅ **Variáveis configuradas!**

---

# PARTE 3: DEPLOY NO VERCEL

## 5️⃣ PREPARAR ARQUIVOS

### **Estrutura necessária:**
```
seu-projeto/
├── api/
│   └── buscar-cnpj.js     ← NOVO! (criado)
├── index.html
├── style.css
├── config.js
├── busca.js
├── google-maps.js
├── cnpj-service.js
├── score-calculator.js
├── message-generator.js
├── excel-exporter.js
├── package.json            ← NOVO! (criado)
└── vercel.json            ← Vamos criar agora
```

### **Criar vercel.json:**
Crie arquivo `vercel.json` na raiz:
```json
{
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

---

## 6️⃣ FAZER DEPLOY

### **Opção A: Via Vercel Dashboard (mais fácil)**

```
1. Vá em: https://vercel.com/new

2. Clique em "Add New..." → "Project"

3. Import Git Repository OU Upload Files:
   
   SE TEM GITHUB:
   - Conecte seu repositório
   - Selecione a branch
   
   SE NÃO TEM GITHUB:
   - Clique em "Browse"
   - Selecione a pasta do projeto
   - Upload automático

4. Configure:
   Framework Preset: Other
   Root Directory: ./
   
5. Clique em "Deploy"

6. Aguarde ~2 minutos

7. Pronto! URL gerada!
```

### **Opção B: Via CLI (terminal)**

```bash
# Instalar Vercel CLI
npm install -g vercel

# Na pasta do projeto
cd /caminho/do/projeto

# Login
vercel login

# Deploy
vercel --prod
```

✅ **Deploy concluído!**

---

# PARTE 4: TESTAR

## 7️⃣ TESTAR A API

### **Pegar URL do deploy:**
```
Exemplo: https://lead-generator-pro.vercel.app
```

### **Testar endpoint:**
```
https://lead-generator-pro.vercel.app/api/buscar-cnpj?telefone=1132143347
```

### **Resposta esperada:**
```json
{
  "found": true,
  "cnpj": "12.345.678/0001-90",
  "razaoSocial": "PADARIA BELLA PAULISTA LTDA",
  "nomeFantasia": "Padaria Bella Paulista",
  "situacaoAtiva": true,
  "capitalSocial": 500000,
  "socioPrincipal": {
    "nome": "João Silva",
    "qualificacao": "Sócio-Administrador"
  },
  ...
}
```

### **Se der erro:**
```
1. Vá em: Vercel Dashboard → Seu projeto → Functions
2. Clique na function que falhou
3. Veja o log de erro
4. Verifique se as variáveis de ambiente estão corretas
```

---

# PARTE 5: INTEGRAR NO FRONTEND

## 8️⃣ ATUALIZAR cnpj-service.js

Substitua a função `buscarCNPJPorTelefone` por:

```javascript
async buscarCNPJPorTelefone(telefone) {
    if (!telefone) return null;
    
    try {
        // Limpa telefone
        const telefoneLimpo = telefone.replace(/\D/g, '');
        
        console.log(`🔍 Consultando BigQuery para telefone: ${telefone}`);
        
        // Chama a API no Vercel
        const response = await fetch(
            `/api/buscar-cnpj?telefone=${telefoneLimpo}`
        );
        
        if (!response.ok) {
            console.log(`⚠️ BigQuery não encontrou CNPJ`);
            return null;
        }
        
        const data = await response.json();
        
        if (!data.found) {
            return null;
        }
        
        console.log(`✅ CNPJ encontrado via BigQuery: ${data.cnpj}`);
        
        return data.cnpjRaw;
        
    } catch (error) {
        console.log(`⚠️ Erro ao consultar BigQuery:`, error.message);
        return null;
    }
}
```

---

# ✅ CHECKLIST FINAL

```
✅ BigQuery API ativada
✅ Service Account criada
✅ Chave JSON baixada
✅ Variáveis no Vercel configuradas
✅ Arquivos criados (api/buscar-cnpj.js, package.json)
✅ Deploy feito
✅ API testada
✅ Frontend integrado
```

---

# 💰 CUSTOS ESPERADOS

## **BigQuery:**
```
1 TB grátis/mês de queries
Estimativa: 1.000 buscas = ~1 GB = R$ 0

Após free tier: R$ 5-10/mês
```

## **Vercel:**
```
Hobby plan: GRÁTIS
- 100 GB bandwidth
- Serverless functions ilimitadas
- Sem cartão de crédito necessário

Suficiente para 1.000+ usuários!
```

---

# 🎯 RESULTADO FINAL

Seu sistema agora:
- ✅ Busca leads no Google Maps
- ✅ Extrai telefone
- ✅ **Busca CNPJ automaticamente no BigQuery**
- ✅ **Retorna nome do sócio, capital, tudo!**
- ✅ Score inteligente
- ✅ Mensagem personalizada
- ✅ **Custo: ~R$ 0-10/mês!**

---

# 🆘 PROBLEMAS COMUNS

## **1. Erro: "Invalid credentials"**
→ Verifique as 3 variáveis de ambiente no Vercel
→ Copie/cole novamente a private_key INTEIRA

## **2. Erro: "BigQuery API not enabled"**
→ Volte no Google Cloud Console
→ Ative a BigQuery API novamente

## **3. Erro: "Permission denied"**
→ Service Account precisa das 2 roles:
   - BigQuery Job User
   - BigQuery Data Viewer

## **4. API retorna 404**
→ Verifique se o arquivo está em: `/api/buscar-cnpj.js`
→ Não pode estar em `/api/buscar-cnpj/index.js`

## **5. Deploy falhou**
→ Verifique se package.json está na raiz
→ Delete node_modules e .vercel se existirem
→ Tente novamente

---

# 📞 TESTE RÁPIDO

Depois de deployar, teste com:
```
https://SEU-DOMINIO.vercel.app/api/buscar-cnpj?telefone=1133214455
```

Se retornar JSON com CNPJ → **FUNCIONOU!** 🎉

---

**Qualquer dúvida, me avisa!** 😊
