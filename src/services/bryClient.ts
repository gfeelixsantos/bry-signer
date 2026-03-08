import { bryAuthService } from './bryAuthService';

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
}

export const bryClient = new BryClient();
