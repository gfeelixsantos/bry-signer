import { bryAuthService } from './bryAuthService';
import axios from 'axios';

interface BryErrorResponse {
  chave?: string;
  message: string;
}
interface BryError {
  message: string;
  status: number;
  details?: unknown;
}

export interface SignatureImageConfig {
  altura: number;
  largura: number;
  coordenadaX: number;
  coordenadaY: number;
  posicao: 'INFERIOR_DIREITO' | 'INFERIOR_ESQUERDO' | 'SUPERIOR_DIREITO' | 'SUPERIOR_ESQUERDO';
  pagina: number | 'TODAS' | 'PRIMEIRA' | 'ULTIMA';
}

export interface SignatureTextConfig {
  texto: string;
  pagina: number | 'TODAS' | 'PRIMEIRA' | 'ULTIMA';
  fonte: string;
  tamanhoFonte: number;
  coordenadaX: number;
  coordenadaY: number;
}

export interface SignatureQRCodeConfig {
  texto: string;
  dimensao: number;
  margem?: number;
  nivelCorrecaoErro?: 'L' | 'M' | 'Q' | 'H';
  coordenadaX?: number;
  coordenadaY?: number;
  largura?: number;
  altura?: number;
  pagina?: number | 'TODAS' | 'PRIMEIRA' | 'ULTIMA';
  posicao?: 'INFERIOR_DIREITO' | 'INFERIOR_ESQUERDO' | 'SUPERIOR_DIREITO' | 'SUPERIOR_ESQUERDO';
}

export type KmsType = 'BRYKMS' | 'PSC';

class BryClient {
  private getIntegraUrl(): string {
    const url = process.env.BRY_INTEGRA_URL;
    if (!url) {
      throw new Error('BRY_INTEGRA_URL não configurada');
    }
    return url;
  }

  private getHubUrl(): string {
    const url = process.env.BRY_HUB_URL;
    if (!url) {
      throw new Error('BRY_HUB_URL não configurada');
    }
    return url;
  }

  private getAppUrl(): string {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    if (!url) {
      throw new Error('NEXT_PUBLIC_APP_URL não configurada');
    }
    return url;
  }

  getBrykmsToken(): string {
    const token = process.env.BRYKMS_TOKEN;
    if (!token) {
      throw new Error('BRYKMS_TOKEN não configurado');
    }
    return token;
  }

  getBrykmsCredentials(): { uuid_cert?: string; user?: string; pin?: string; token?: string } {
    return {
      uuid_cert: process.env.BRYKMS_UUID_CERT,
      user: process.env.BRYKMS_USER,
      pin: process.env.BRYKMS_PIN,
      token: process.env.BRYKMS_TOKEN,
    };
  }

  hasBrykmsCredentials(): boolean {
    const creds = this.getBrykmsCredentials();
    return !!(creds.uuid_cert || creds.user) && !!(creds.pin || creds.token);
  }

  private async makeAuthenticatedRequest(
    endpoint: string,
    options: RequestInit & { useHubUrl?: boolean } = {}
  ): Promise<unknown> {
    const { useHubUrl = false, ...fetchOptions } = options;
    const baseUrl = useHubUrl ? this.getHubUrl() : this.getIntegraUrl();
    const url = `${baseUrl}${endpoint}`;

    const token = await bryAuthService.getAccessToken();

    console.info(`[BryClient] Request: ${options.method || 'GET'} ${url}`);
    console.info(`[BryClient] Headers: Authorization: Bearer ${token.substring(0, 20)}...`);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...fetchOptions.headers,
        },
      });

      console.info(`[BryClient] Response Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BryClient] Erro na requisição: ${errorText}`);

        const error: BryError = {
          message: `Erro na comunicação com a API BRy: ${response.status}`,
          status: response.status,
          details: errorText,
        };
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const jsonData = await response.json();
        console.info(`[BryClient] Response JSON:`, JSON.stringify(jsonData).substring(0, 200));
        return jsonData;
      }

      return null;
    } catch (error) {
      if ((error as BryError).status) {
        throw error;
      }
      console.error(`[BryClient] Erro de rede:`, error);
      throw new Error('Falha na comunicação com a API BRy');
    }
  }

  async listPSCs(): Promise<Array<{ name: string; id?: string }>> {
    console.info('[BryClient] Listando PSCs disponíveis...');
    const response = await this.makeAuthenticatedRequest('/psc/list', {
      method: 'GET',
    }) as Array<{ name: string; id?: string }>;

    console.info(`[BryClient] Total de PSCs encontrados: ${response.length}`);
    return response;
  }

  async generateIntegrationLink(pscName: string, state: string): Promise<{ url: string; token: string }> {
    console.info(`[BryClient] Gerando link de integração para PSC: ${pscName}`);

    const body = {
      pscName,
      redirectUri: `${this.getAppUrl()}/api/bry/callback`,
      state,
      scope: 'signature_session',
    };

    console.info(`[BryClient] Request body:`, JSON.stringify(body));

    const response = await this.makeAuthenticatedRequest('/psc/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }) as { url: string; token: string };

    console.info(`[BryClient] Link de integração gerado com sucesso`);
    return response;
  }

  async signPdf(
    pdfBuffer: ArrayBuffer,
    fileName: string,
    kmsToken: string,
    kmsType: KmsType = 'PSC',
    imageConfig?: SignatureImageConfig,
    textConfig?: SignatureTextConfig,
    imageBase64?: string,
    qrCodeConfig?: SignatureQRCodeConfig
  ): Promise<ArrayBuffer> {
    console.info(`[BryClient] Enviando PDF para assinatura: ${fileName}`);
    console.info(`[BryClient] KMS Type: ${kmsType}`);
    console.info(`[BryClient] KMS Data: ${kmsToken}`);
    if (imageConfig) {
      console.info(`[BryClient] Configuração de imagem:`, JSON.stringify(imageConfig));
    }
    if (textConfig) {
      console.info(`[BryClient] Configuração de texto:`, JSON.stringify(textConfig));
    }
    if (qrCodeConfig) {
      console.info(`[BryClient] Configuração de QR Code:`, JSON.stringify(qrCodeConfig));
    }
    if (textConfig) {
      console.info(`[BryClient] Configuração de texto:`, JSON.stringify(textConfig));
    }

    let kmsDataObject: Record<string, string>;
    
    if (kmsType === 'BRYKMS') {
      try {
        kmsDataObject = JSON.parse(kmsToken);
        console.info(`[BryClient] KMS Data (BRYKMS) - uuid_cert: ${kmsDataObject.uuid_cert || 'N/A'}, user: ${kmsDataObject.user || 'N/A'}`);
      } catch {
        throw new Error('kmsToken inválido para BRYKMS - deve ser um JSON válido');
      }
    } else {
      kmsDataObject = { token: kmsToken };
    }

    const configAssinatura = {
      perfil: 'Completa',
      algoritmoHash: 'SHA256',
      kms_type: kmsType,
      kms_data: kmsDataObject
    };

    const formData = new FormData();
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('documento', pdfBlob, fileName);
    formData.append('dados_assinatura', JSON.stringify(configAssinatura));

    if (imageConfig) {
      const configImagem = [imageConfig];
      formData.append('configuracao_imagem', JSON.stringify(configImagem));
      console.info(`[BryClient] configuracao_imagem enviado: ${JSON.stringify(configImagem)}`);
    }

    if (textConfig) {
      const configTexto = [textConfig];
      formData.append('configuracao_texto', JSON.stringify(configTexto));
      console.info(`[BryClient] configuracao_texto enviado: ${JSON.stringify(configTexto)}`);
    }

    if (imageBase64) {
      // Passo 1: Remover o append de imagem conforme solicitado para uso de QR Code dinâmico
      // const imageBuffer = Buffer.from(imageBase64, 'base64');
      // const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
      // formData.append('imagem', imageBlob, 'selo_assinatura.png');
      console.info(`[BryClient] Imagem NÃO enviada no FormData (configuração para QR Code dinâmico)`);
    }

    if (qrCodeConfig) {
      const configQRCode = [qrCodeConfig];
      // Passo 3: Enviar os dados do QR Code (configuracao_qrcode)
      formData.append('configuracao_qrcode', JSON.stringify(configQRCode));
      console.info(`[BryClient] configuracao_qrcode enviado: ${JSON.stringify(configQRCode)}`);
    }

    const token = await bryAuthService.getAccessToken();
    const url = `${this.getHubUrl()}/fw/v1/pdf/kms/lote/assinaturas`;

    console.info(`[BryClient] Request URL: ${url}`);
    console.info(`[BryClient] Auth token: ${token.substring(0, 20)}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'kms_type': kmsType,
        'kms_data': JSON.stringify(kmsDataObject),
        'accept': 'application/json',
      },
      body: formData,
    });

    console.info(`[BryClient] Response Status: ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    console.info(`[BryClient] Content-Type: ${contentType}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BryClient] Erro na assinatura: ${errorText}`);
      throw new Error(`Falha ao assinar PDF: ${response.status} - ${errorText}`);
    }

    let arrayBuffer: ArrayBuffer;

    if (contentType.includes('application/json')) {
      const jsonResponse = await response.json();
      console.info(`[BryClient] Resposta JSON completa:`, JSON.stringify(jsonResponse));
      
      const document = jsonResponse.documentos?.[0];
      if (document?.links?.[0]?.href) {
        const downloadUrl = document.links[0].href;
        console.info(`[BryClient] Baixando PDF de: ${downloadUrl}`);
        
        const downloadResponse = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!downloadResponse.ok) {
          throw new Error(`Falha ao baixar PDF assinado: ${downloadResponse.status}`);
        }
        
        arrayBuffer = await downloadResponse.arrayBuffer();
      } else if (jsonResponse.conteudo || jsonResponse.pdf || jsonResponse.documento) {
        const base64Data = jsonResponse.conteudo || jsonResponse.pdf || jsonResponse.documento;
        const buffer = Buffer.from(base64Data, 'base64');
        arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } else {
        throw new Error('Resposta JSON não contém link de download');
      }
    } else {
      arrayBuffer = await response.arrayBuffer();
    }

    console.info(`[BryClient] PDF assinado com sucesso, tamanho: ${arrayBuffer.byteLength} bytes`);

    return arrayBuffer;
  }

  buildBrykmsData(params: {
    uuid_cert?: string;
    user?: string;
    pin?: string;
    token?: string;
  }): string {
    const kmsData: Record<string, string> = {};
    
    if (params.uuid_cert) {
      kmsData.uuid_cert = params.uuid_cert;
    }
    if (params.user) {
      kmsData.user = params.user;
    }
    if (params.pin) {
      kmsData.pin = Buffer.from(params.pin).toString('base64');
    }
    if (params.token) {
      kmsData.token = params.token;
    }
    
    return JSON.stringify(kmsData);
  }

  getCallbackUrl(state: string): string {
    return `${this.getAppUrl()}/api/bry/callback?state=${state}`;
  }

    /**
   * Valida assinatura PDF/PAdES usando o BRy HUB Signer
   * 
   * ESTRUTURA CORRETA DA API BRY (CONFIRMADA PELA DOCUMENTAÇÃO OFICIAL):
   * A API usa mapeamento Spring Boot de multipart/form-data para List<SignatureData>.
   * Usa notação de array INDEXADO para suportar múltiplas assinaturas.
   * 
   * FormData correto:
   * - nonce: string do BigInteger (nonce geral da requisição)
   * - signatures[0][nonce]: string do BigInteger (nonce da primeira assinatura)
   * - signatures[0][content]: arquivo PDF (binary)
   * - contentsReturn: 'true' (opcional, para retornar dados do carimbo)
   * 
   * NOTA: O índice [0] indica a primeira assinatura. Para verificar múltiplas
   * assinaturas, usar signatures[1][nonce], signatures[2][nonce], etc.
   * 
   * ENDPOINT: https://hub2.bry.com.br/api/pdf-verification-service/v1/signatures/verify
   * MÉTODO: POST multipart/form-data
   */
  async verifyPdf(pdfBuffer: ArrayBuffer, fileName: string): Promise<unknown> {
    // URL padrão do serviço SaaS da BRy
    const URL_VERIFICACAO_HUB = process.env.BRY_URL_VERIFICACAO_PDF || 
      'https://hub2.bry.com.br/api/pdf-verification-service/v1/signatures/verify';

    try {
      console.info('Starting PDF signature validation', { 
        fileName,
        url: URL_VERIFICACAO_HUB.replace(/https?:\/\/[^\/]+/, '***'),
        endpoint: '/api/pdf-verification-service/v1/signatures/verify'
      });

      const tokenBry = await bryAuthService.getAccessToken();

      // 1. GERAR NONCE como STRING de BigInteger (15 dígitos)
      // CRÍTICO: Deve ser STRING para evitar arredondamento do JavaScript
      // e para compatibilidade com o mapeamento Spring Boot
      const nonceValue = Math.floor(Math.random() * 1_000_000_000_000_000).toString();

      // 2. CRIAR FORMDATA com estrutura EXATA da documentação
      // A API usa notação de array INDEXADO: signatures[0][nonce], signatures[0][content]
      const formData = new FormData();
      
      // Parâmetro: nonce (Nonce geral da requisição)
      formData.append('nonce', nonceValue);
      
      // Parâmetro: signatures[0][nonce] (Nonce da PRIMEIRA assinatura - índice 0)
      // IMPORTANTE: Usar índice [0] para indicar primeira assinatura
      formData.append('signatures[0][nonce]', nonceValue);
      
      // Parâmetro: signatures[0][content] (Arquivo PDF - índice 0)
      // IMPORTANTE: Usar mesmo índice [0] para o conteúdo
      const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
      formData.append('signatures[0][content]', pdfBlob, fileName || 'documento.pdf');
      
      // Parâmetro opcional: contentsReturn (Retornar dados do carimbo)
      formData.append('contentsReturn', 'true');

      console.info('Validation request prepared', {
        hasToken: !!tokenBry,
        fileName: fileName || 'documento.pdf',
        fileSize: pdfBuffer.byteLength,
        nonceValue: nonceValue,
        nonceType: 'string (BigInteger)',
        formDataKeys: ['nonce', 'signatures[0][nonce]', 'signatures[0][content]', 'contentsReturn'],
        endpoint: '/api/pdf-verification-service/v1/signatures/verify'
      });

      // 3. REQUISIÇÃO COM AXIOS
      // Headers: apenas Authorization
      // Axios automaticamente define Content-Type como multipart/form-data com boundary
      const response = await axios.post(URL_VERIFICACAO_HUB, formData, {
        headers: {
          'Authorization': `Bearer ${tokenBry}`,
          // NÃO definir Content-Type manualmente
          // Axios gerencia automaticamente para FormData
        },
        timeout: 45000, // 45 segundos para processamento
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      console.info('PDF signature validated successfully', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      });

      return response.data;

    } catch (error: unknown) {
      // Tratamento de erros específicos da API BRy
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { 
          response?: { 
            status?: number; 
            data?: BryErrorResponse;
            statusText?: string;
          };
          message?: string;
        };
        
        const status = axiosError.response?.status;
        const errorData = axiosError.response?.data;
        
        // ERRO 400 - Bad Request
        if (status === 400) {
          const errorKey = errorData?.chave;
          const errorMessage = errorData?.message || 'Requisição inválida';
          
          console.error('Bad Request - Validation error', {
            status,
            chave: errorKey,
            message: errorMessage
          });
          
          // Erros comuns da API BRy
          if (errorKey === 'excecao.hub.requisicao.nonce') {
            throw new Error(
              'ERRO DE NONCE: Estrutura do campo signatures incorreta.\n' +
              'Campo FormData: "signatures" (JSON array)\n' +
              'Estrutura correta: [{"nonce": 123456789}]\n' +
              'IMPORTANTE: nonce deve ser NUMBER (não string) para BigInteger\n' +
              'Exemplo correto: JSON.stringify([{ nonce: 123456789 }])\n' +
              'Exemplo ERRADO: JSON.stringify([{ nonce: "123456789" }])\n' +
              'Erro da API: ' + errorMessage
            );
          }
          
          if (errorKey === 'excecao.hub.documento.invalido') {
            throw new Error(
              'ERRO: Documento PDF inválido ou corrompido.\n' +
              'Erro da API: ' + errorMessage
            );
          }
          
          throw new Error(
            `ERRO 400: ${errorMessage}\n` +
            (errorKey ? `Código: ${errorKey}\n` : '') +
            'Verifique o formato do documento e dos parâmetros enviados.'
          );
        }
        
        // ERRO 401 - Unauthorized
        if (status === 401) {
          console.error('Authentication error', {
            status,
            message: 'Token inválido ou expirado'
          });
          
          throw new Error(
            'ERRO 401: Token de autenticação inválido ou expirado.\n' +
            'Verifique as credenciais BRY_CLIENT_ID e BRY_CLIENT_SECRET.'
          );
        }
        
        // ERRO 404 - Not Found
        if (status === 404) {
          console.error('URL verification error - 404 Not Found', {
            url: URL_VERIFICACAO_HUB
          });
          
          throw new Error(
            'ERRO 404: Endpoint não encontrado.\n' +
            'URL configurada: ' + URL_VERIFICACAO_HUB + '\n' +
            'URL correta: https://hub2.bry.com.br/api/pdf-verification-service/v1/signatures/verify\n' +
            'Verifique a variável BRY_URL_VERIFICACAO_PDF no .env'
          );
        }
        
        // ERRO 415 - Unsupported Media Type
        if (status === 415) {
          console.error('Unsupported Media Type error', {
            status,
            message: 'Content-Type incorreto'
          });
          
          throw new Error(
            'ERRO 415: Content-Type não suportado.\n' +
            'A requisição deve usar multipart/form-data.\n' +
            'Não defina Content-Type manualmente - deixe o Axios gerenciar.'
          );
        }
        
        // ERRO 500/502/503 - Server Error
        if (status && status >= 500) {
          console.error('Server error', {
            status,
            statusText: axiosError.response?.statusText
          });
          
          throw new Error(
            `ERRO ${status}: Erro no servidor BRy.\n` +
            'O serviço pode estar temporariamente indisponível.\n' +
            'Tente novamente em alguns minutos.'
          );
        }
        
        // Outros erros HTTP
        const errorMessage = errorData?.message || 
          axiosError.response?.statusText || 
          'Erro desconhecido';
          
        console.error('HTTP error', {
          status,
          message: errorMessage,
          data: errorData
        });
        
        throw new Error(
          `ERRO ${status || 'HTTP'}: ${errorMessage}\n` +
          'Detalhes: ' + JSON.stringify(errorData || {}).substring(0, 200)
        );
      }

      // Erros de rede ou timeout
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          console.error('Timeout error', {
            message: error.message
          });
          
          throw new Error(
            'ERRO DE TIMEOUT: A requisição demorou muito para responder.\n' +
            'O documento pode ser muito grande ou o servidor está lento.\n' +
            'Tente novamente ou reduza o tamanho do PDF.'
          );
        }
        
        if (error.message.includes('Network Error')) {
          console.error('Network error', {
            message: error.message
          });
          
          throw new Error(
            'ERRO DE REDE: Não foi possível conectar ao servidor BRy.\n' +
            'Verifique sua conexão com a internet e o firewall.'
          );
        }
        
        console.error('Unknown error', {
          message: error.message
        });
        
        throw new Error(`Erro ao verificar PDF: ${error.message}`);
      }

      // Erro completamente desconhecido
      console.error('Unexpected error type', {
        error: String(error)
      });
      
      throw new Error(
        'Erro inesperado ao verificar PDF.\n' +
        'Erro: ' + String(error).substring(0, 200)
      );
    }
  }
}

export const bryClient = new BryClient();
