import { bryAuthService } from './bryAuthService';

interface BryError {
  message: string;
  status: number;
  details?: unknown;
}

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
      scope: 'single_signature',
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
    kmsToken: string
  ): Promise<ArrayBuffer> {
    console.info(`[BryClient] Enviando PDF para assinatura: ${fileName}`);
    console.info(`[BryClient] KMS Token: ${kmsToken.substring(0, 20)}...`);

    const dadosAssinatura = {
      signatureType: 'PKCS7',
      signatureAlgorithm: 'RSA-SHA256',
    };

    const formData = new FormData();
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('documento', pdfBlob, fileName);
    formData.append('kms_data', kmsToken);
    formData.append('dados_assinatura', JSON.stringify(dadosAssinatura));

    const token = await bryAuthService.getAccessToken();
    const url = `${this.getHubUrl()}/fw/v1/pdf/kms/lote/assinaturas`;

    console.info(`[BryClient] Request URL: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'kms_type': 'PSC',
      },
      body: formData,
    });

    console.info(`[BryClient] Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BryClient] Erro na assinatura: ${errorText}`);
      throw new Error(`Falha ao assinar PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.info(`[BryClient] PDF assinado com sucesso, tamanho: ${arrayBuffer.byteLength} bytes`);

    return arrayBuffer;
  }

  getCallbackUrl(state: string): string {
    return `${this.getAppUrl()}/api/bry/callback?state=${state}`;
  }
}

export const bryClient = new BryClient();
