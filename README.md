# Integração Assinatura Digital BRy (PSC via QRCode + Easy Sign)

Este documento atua como o guia definitivo para consulta, testes e implementação do processo de Assinatura Digital de PDFs utilizando as APIs da BRy Tecnologia em uma aplicação Next.js.

A aplicação oferece duas modalidades de assinatura:
1. **Assinatura com Certificado em Nuvem (PSC)** - Autenticação via QRCode
2. **Assinatura Eletrônica com Selfie (Easy Sign)** - Captura facial

---

## 1. Visão Geral da Integração

### 1.1 Assinatura via Certificado em Nuvem (PSC)

O fluxo de assinatura via nuvem segue os seguintes passos lógicos e arquiteturais:
1. **Autenticação**: A aplicação Next.js se autentica na BRy utilizando credenciais (Client ID e Secret) para obter um token de acesso global.
2. **Seleção de Provedor**: A aplicação lista os provedores de certificado em nuvem (PSCs) disponíveis.
3. **Geração do QRCode**: É gerado um link de autorização junto à BRy (que o frontend exibirá posteriormente como um QRCode).
4. **Autorização**: O usuário escaneia o QRCode e aprova a assinatura em seu próprio app do dispositivo móvel.
5. **Assinatura Final**: Após constatar a aprovação do usuário, o backend envia o documento PDF para ser digitalmente assinado no HUB Signer da BRy.

### 1.2 Assinatura com Selfie (Easy Sign)

O fluxo de assinatura eletrônica com captura facial:
1. **Preparação**: O usuário preenche dados (nome, e-mail) e faz upload do PDF.
2. **Criação da Requisição**: O backend cria uma requisição de assinatura com autenticação `SELFIE`.
3. **Captura Facial**: O usuário abre o link da BRy e realiza a captura facial (selfie) com documento.
4. **Download**: Após confirmação, o documento assinado é baixado automaticamente.

---

## 2. Variáveis de Ambiente e URLs base

Para o ambiente de homologação (testes), você deverá configurar as seguintes variáveis obrigatórias no seu arquivo `.env.local`:

```env
# Credenciais da Aplicação (Mantenha em sigilo absoluto - apenas no servidor)
BRY_CLIENT_ID=seu_client_id_aqui
BRY_CLIENT_SECRET=seu_client_secret_aqui

# URLs Base - Serviços BRy (Ambiente de Homologação)
BRY_AUTH_URL=https://cloud-hom.bry.com.br/token-service/jwt
BRY_INTEGRA_URL=https://integra.hom.bry.com.br/api/service
BRY_HUB_URL=https://hub2.hom.bry.com.br
BRY_EASYSIGN_URL=https://easysign.hom.bry.com.br/api/service/sign/v1

# URL Local da Aplicação Callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 3. Passo a Passo do Fluxo de Assinatura via PSC (Documentação Técnica)

### Passo 3.1: Obtenção do Token de Acesso (Login da Aplicação)
Este passo efetua o login da sua aplicação Next.js nos servidores da BRy para consumir os recursos de integração.

- **Método HTTP**: `POST`
- **Endpoint**: `{BRY_AUTH_URL}`
- **Headers Obrigatórios**:
  - `Content-Type`: `application/x-www-form-urlencoded`
  > **Atenção Crucial**: O `Content-Type` DEVE ser obrigatoriamente `application/x-www-form-urlencoded`. Enviar um cabeçalho de JSON resultará em falha na requisição.
- **Body**: 
  - O envio **NÃO** é JSON, é uma string URL-encoded. Exemplo:
  ```text
  grant_type=client_credentials&client_id=SEU_CLIENT_ID&client_secret=SEU_CLIENT_SECRET
  ```
- **Ação e Retorno**: O token de acesso retornado (`access_token`) possui nível de servidor. Deve ser guardado em memória/cache no backend e usado no header `Authorization: Bearer <token>` nas próximas requisições desta integração.

### Passo 3.2: Listagem de PSCs (Provedores em Nuvem)
Recupera as opções de provedores de certificado em nuvem.

- **Método HTTP**: `GET`
- **Endpoint**: `{BRY_INTEGRA_URL}/psc/list`
- **Headers Obrigatórios**:
  - `Authorization`: `Bearer <token_do_passo_3.1>`
- **Ação e Retorno**: Retorna um array contendo os dados dos provedores de confiança em nuvem disponíveis (ex: BirdID, SafeID, VidaaS). Você deverá utilizar este array para montar um dropdown/lista no frontend para escolha do usuário.

### Passo 3.3: Geração do QRCode (Link de Autenticação)
Gera os recursos e tickets essenciais para uma transação de assinatura do usuário.

- **Método HTTP**: `POST`
- **Endpoint**: `{BRY_INTEGRA_URL}/psc/link`
- **Headers Obrigatórios**:
  - `Authorization`: `Bearer <token_do_passo_3.1>`
  - `Content-Type`: `application/json`
- **Body (JSON)**:
  ```json
  {
    "pscName": "nome_do_provedor_selecionado",
    "redirectUri": "http://localhost:3000/api/bry/callback",
    "state": "uuid_unico_gerado_no_backend",
    "scope": "single_signature"
  }
  ```
  - *Nota*: `state` é um UUID de controle local gerado pela aplicação, atrelado à sessão do usuário. `redirectUri` aponta para uma rota API do seu Next.js.
- **Ação e Retorno**: A API devolve um JSON contendo uma `url` (o link nativo para aprovação via app do PSC que seu frontend transformará visualmente num QRCode) e um **token de credencial temporária** (geralmente sob `kms_data`), que o backend interceptará para a construção do payload final.

### Passo 3.4: Sincronização Mobile/Desktop (Polling e Callback)
Para garantir a sinergia entre o smartphone e a aba do navegador desktop:

1. **Callback (Aprovação)**: Quando o usuário lê o QRCode e clica em aprovar, o servidor mobile do PSC o redireciona (Webhook) diretamente para a sua `redirectUri` (callback do Next.js), levando o UUID parametrizado no construtor `state`. 
2. **Processamento do Backend**: O Route Handler do Next intercepta essa requisição e assinala (em cache, Redis ou banco temporário) que esse `state` está validado.
3. **Polling do Frontend (Desktop)**: A aplicação na tela em que o QRCode pulsa deve realizar um **polling** temporizado (ex.: `setInterval` de 3s em 3s). Em cada ciclo, confere numa API interna se o `state` correspondente teve sua validação atualizada.
4. **Start Automation**: Ao detectar "sucesso" na verificação de polling, o frontend aborta as checagens, avança passivamente as animações na tela e inicia o gatilho para o "Passo 3.5".

### Passo 3.5: Finalização da Assinatura (HUB Signer)
Com o aval do usuário consolidado e certificado credenciado, é hora de assinar o PDF real.

- **Método HTTP**: `POST`
- **Endpoint**: `{BRY_HUB_URL}/fw/v1/pdf/kms/lote/assinaturas`
- **Headers Obrigatórios**:
  - `Authorization`: `Bearer <token_aplicacao>` (token do passo 3.1).
  - `kms_type`: `PSC` *(Obriagtório para indicar a modalidade da autorização)*.
- **Body (Multipart/Form-Data)**:
  - **Destaque:** DEVE ser enviado estritamente como `multipart/form-data`.
  - Campos de entrada exigidos form-data:
    1. `documento`: Arquivo binário (Buffer/Blob) do PDF aguardando assinatura.
    2. `kms_data`: O token temporário devolvido outrora no Passo 3.3.
    3. `dados_assinatura`: Um JSON **stringificado**. Exemplo obrigatório base de formatação de payload:
    ```json
    "[{\"perfil\":\"PERFIL_PADRAO\",\"algoritmoHash\":\"SHA256\",\"formatoDadosEntrada\":\"Base64\",\"padraoAssinatura\":\"PADES\"}]"
    ```
- **Ação e Retorno**: A resposta do servidor devolve **diretamente em array de bytes** (buffer binário) correspondendo ao novo documento PDF, agora assinado de forma vitalícia e inalterada. O Server deve encapsular esse stream e servi-lo para que o navegador inicie o download automatizado do PDF firmado.

---

## 4. Passo a Passo do Fluxo de Assinatura com Selfie (Easy Sign)

### Passo 4.1: Criação da Requisição de Assinatura
Envia os dados do documento e do signatário para iniciar o processo de assinatura com captura facial.

- **Método HTTP**: `POST`
- **Endpoint**: `{BRY_EASYSIGN_URL}/signatures`
- **Headers Obrigatórios**:
  - `Authorization`: `Bearer <token_da_aplicacao>`
  - `Content-Type`: `application/json`
- **Body (JSON)**:
  ```json
  {
    "documents": [
      {
        "documentBase64": "conteúdo_base64_do_pdf",
        "documentName": "documento.pdf",
        "documentType": "PDF"
      }
    ],
    "signers": [
      {
        "name": "Nome do Funcionário",
        "email": "email@empresa.com.br"
      }
    ],
    "authentications": ["SELFIE"]
  }
  ```
  > **Atenção**: A chave `authentications` com valor `["SELFIE"]` é obrigatória para ativar a captura facial.

- **Ação e Retorno**: Retorna um JSON complexo. Extraia as seguintes informações:
  - `uuid` (raiz): ID da requisição de assinatura
  - `documents[].documentNonce`: Nonce do documento
  - `signers[].link.url`: Link para abertura do portal de assinatura

### Passo 4.2: Captura Facial (Portal BRy)
O frontend abre o `signatureLink` em nova aba (target="_blank"). O portal da BRy solicitará:
- Câmera do dispositivo
- Selfie com documento (CNH, RG, etc)
- Confirmação final

### Passo 4.3: Resgate do Documento Assinado
Após a conclusão da assinatura no portal BRy, resgate o documento final.

- **Método HTTP**: `GET`
- **Endpoint**: `{BRY_EASYSIGN_URL}/signatures/{request_id}/documents/{documentNonce}/signed?returnType=BINARY`
- **Headers Obrigatórios**:
  - `Authorization`: `Bearer <token_da_aplicacao>`
- **Ação e Retorno**: Retorna os **bytes do PDF assinado** (application/octet-stream). O backend deve forçar o download automático com nome `documento_assinado_facial.pdf`.

---

## 5. Rotas da Aplicação

| Rota | Descrição |
|------|------------|
| `/` | Página principal - Assinatura via QRCode (PSC) |
| `/easysign` | Página de Assinatura com Selfie |
| `/api/bry/callback` | Callback para autenticação QRCode |
| `/api/bry/status` | API de polling para verificação de autenticação |
| `/api/bry/sign` | Endpoint para finalizar assinatura PSC |

---

## 6. Orientações Importantes e Tratamento de Erros

**Expedição e Manutenção de Tokens de Acesso**
O token principal de aplicação obtido no Passo 3.1 tem um prazo de duração explícito na resposta API (`expires_in`). Programe a infraestrutura para prever a expiração. Uma chamada negada com falha 401 deve invocar uma função *renew* silenciosa que reconecta a aplicação sem interromper a jornada do usuário.

**Segurança Crítica**
O valor da variável ambiente `BRY_CLIENT_SECRET` é o elo de segurança principal que garante a confidencialidade do processo. É imperativo que os transacionais do passo 3.1 até o 3.5 sejam blindados e geridos por Route Handlers APIs ou Server Actions do Framework. Nunca exponha as confidenciais como `NEXT_PUBLIC`, restringindo que toda ação rode Server-Side.

**Controle de Memory Leaks**
No fluxo de aprovação com QRCode e Polling (Passo 3.4), assegure a criação de uma mecânica de Cleanup (`clearInterval` no destruidor do React `useEffect`). É imprescindível interromper requisições assíncronas cíclicas se o usuário subitamente abortar a tarefa minimizando a janela principal, fechando o painel de assinatura prematuramente ou navegando da página, bloqueando sobrecarga de infraestrutura.

**Logs e Debug**
A aplicação implementa logs estruturados no formato `[Serviço] Mensagem` em todas as requisições HTTP. Isso facilita o debug em produção, permitindo rastrear payloads enviados e respostas recebidas da API BRy.
