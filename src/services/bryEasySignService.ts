import { bryAuthService } from './bryAuthService';
import * as fs from 'fs';
import * as path from 'path';

interface EasySignImage {
  nonce: string;
  image: string;
}

interface EasySignDocument {
  name: string;
  base64Document: string;
  signaturePositions?: Array<{
    signerNonce: string;
    imageNonce: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

interface EasySignSigner {
  nonce?: string;
  name: string;
  email: string;
  authentications?: string[];
  authenticationOptions?: string[];
  typeMessaging?: string[];
  positioningMode?: string;
  signatureConfig?: {
    mode: string;
  };
}

interface EasySignRequest {
  name: string;
  clientName: string;
  images?: EasySignImage[];
  signersData: EasySignSigner[];
  documents: EasySignDocument[];
}

interface EasySignResponse {
  uuid: string;
  status?: string;
  documents: Array<{
    documentNonce: string;
    documentUuid?: string;
  }>;
  signers: Array<{
    status?: string;
    link?: {
      url: string;
    };
    iframe?: {
      url: string;
      href: string;
    };
  }>;
}

export class BryEasySignService {
  private getEasySignUrl(): string {
    const url = process.env.BRY_EASYSIGN_URL;
    if (!url) {
      throw new Error('BRY_EASYSIGN_URL não configurada');
    }
    return url;
  }

  private async generateStampImage(signerName: string): Promise<string> {
    try {
      console.info(`[BryEasySignService] Carregando imagem do carimbo para: ${signerName}`);

      const imagePath = path.join(process.cwd(), 'src', 'services', 'logo-cmso.png');
      const imageBuffer = fs.readFileSync(imagePath);
      const logoBase64 = imageBuffer.toString('base64');

      console.info(`[BryEasySignService] Logo base64 length: ${logoBase64.length}`);
      console.info(`[BryEasySignService] Imagem do carimbo carregada com sucesso`);

      return logoBase64;
    } catch (error) {
      console.error(`[BryEasySignService] Erro ao carregar imagem do carimbo:`, error);
      throw new Error('Falha ao carregar imagem do carimbo');
    }
  }

  private async makeAuthenticatedRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<unknown> {
    const token = await bryAuthService.getAccessToken();
    const url = `${this.getEasySignUrl()}${endpoint}`;

    console.info(`[BryEasySignService] Request: ${options.method || 'GET'} ${url}`);
    console.info(`[BryEasySignService] Headers: Authorization: Bearer ${token.substring(0, 20)}...`);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      console.info(`[BryEasySignService] Response Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BryEasySignService] Erro na requisição: ${errorText}`);
        throw new Error(`Erro na API EasySign: ${response.status} - ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const jsonData = await response.json();
        console.info(`[BryEasySignService] Response JSON:`, JSON.stringify(jsonData).substring(0, 500));
        return jsonData;
      }

      return null;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[BryEasySignService] Erro: ${error.message}`);
        throw error;
      }
      console.error(`[BryEasySignService] Erro desconhecido:`, error);
      throw new Error('Falha na comunicação com a API EasySign');
    }
  }

  async createSignatureRequest(
    documentBase64: string,
    documentName: string,
    signerName: string,
    signerEmail: string
  ): Promise<{ requestId: string; documentNonce: string; signatureLink: string }> {
    console.info(`[BryEasySignService] Criando requisição de assinatura para: ${documentName}`);
    console.info(`[BryEasySignService] Signer: ${signerName} (${signerEmail})`);
    console.info(`[BryEasySignService] Base64 length: ${documentBase64.length}`);

    const stampImageBase64 = await this.generateStampImage(signerName);

const payload: EasySignRequest = {
      name: 'Assinatura Facial do Funcionario',
      clientName: 'Sistema Interno',
      images: [
        {
          nonce: 'logo-empresa',
          image: stampImageBase64,
        }
      ],
      signersData: [
        {
          nonce: 'funcionario-01',
          name: signerName.toUpperCase(),
          email: signerEmail.toLowerCase(),
          authenticationOptions: ['SELFIE'],
          typeMessaging: ['LINK'],
          positioningMode: 'CREATOR',
          signatureConfig: {
            mode: 'SIMPLE'
          },
        },
      ],
      documents: [
        {
          name: documentName,
          base64Document: documentBase64,
          signaturePositions: [
            {
              signerNonce: 'funcionario-01',
              imageNonce: 'logo-empresa',
              page: 1,
              x: 50,
              y: 650,
              width: 200,
              height: 80,
            }
          ],
        },
      ],
    };

    console.info(`[BryEasySignService] Verificando estrutura do payload antes de enviar...`);
    console.log('[BryEasySignService] Stamp image length:', stampImageBase64.length);
    console.log('[BryEasySignService] Stamp image prefix:', stampImageBase64.substring(0, 50));
    
    const payloadStr = JSON.stringify(payload);
    console.log('[BryEasySignService] Payload signersData:', JSON.stringify(payload.signersData));

    const response = await this.makeAuthenticatedRequest('/signatures', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }) as EasySignResponse;

    const requestId = response.uuid;
    const documentNonce = response.documents?.[0]?.documentNonce || response.documents?.[0]?.documentUuid;
    const signatureLink = response.signers?.[0]?.iframe?.href;

    if (!signatureLink) {
      console.error('[BryEasySignService] Payload do signers retornado:', JSON.stringify(response.signers));
      throw new Error('Link de assinatura não retornado. Verifique o typeMessaging.');
    }

    if (!documentNonce) {
      console.error('[BryEasySignService] Payload do documents retornado:', JSON.stringify(response.documents));
      throw new Error('ID do documento não retornado.');
    }

    console.info(`[BryEasySignService] Request ID: ${requestId}`);
    console.info(`[BryEasySignService] Document ID: ${documentNonce}`);
    console.info(`[BryEasySignService] Signature Link: ${signatureLink}`);

    return {
      requestId,
      documentNonce,
      signatureLink,
    };
  }

async getSignedDocument(requestId: string, documentNonce: string): Promise<ArrayBuffer> {
    console.info(`[BryEasySignService] Resgatando documento assinado`);
    console.info(`[BryEasySignService] Request ID: ${requestId}, Document Nonce: ${documentNonce}`);

    const token = await bryAuthService.getAccessToken();
    const url = `${this.getEasySignUrl()}/signatures/${requestId}/documents/${documentNonce}/signed?returnType=BINARY`;

    console.info(`[BryEasySignService] Request URL: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/octet-stream'
      },
    });

    console.info(`[BryEasySignService] Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BryEasySignService] Erro ao buscar documento assinado: ${errorText}`);
      throw new Error(`Falha ao obter documento assinado: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.info(`[BryEasySignService] Documento assinado recebido, tamanho: ${arrayBuffer.byteLength} bytes`);

    return arrayBuffer;
  }

  async getEvidenceReport(requestId: string, documentNonce: string): Promise<ArrayBuffer> {
    console.info(`[BryEasySignService] Resgatando relatório de evidências`);
    console.info(`[BryEasySignService] Request ID: ${requestId}, Document Nonce: ${documentNonce}`);

    const token = await bryAuthService.getAccessToken();
    const url = `${this.getEasySignUrl()}/signatures/${requestId}/documents/${documentNonce}/report?returnType=BINARY`;

    console.info(`[BryEasySignService] Request URL: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/octet-stream'
      },
    });

    console.info(`[BryEasySignService] Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BryEasySignService] Erro ao buscar relatório: ${errorText}`);
      throw new Error(`Falha ao obter relatório de evidências: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.info(`[BryEasySignService] Relatório recebido, tamanho: ${arrayBuffer.byteLength} bytes`);

    return arrayBuffer;
  }

  async getSignatureStatus(requestId: string): Promise<{ status: string; signerStatus: string }> {
    console.info(`[BryEasySignService] Verificando status da assinatura: ${requestId}`);

    const token = await bryAuthService.getAccessToken();
    const url = `${this.getEasySignUrl()}/signatures/${requestId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BryEasySignService] Erro ao verificar status: ${errorText}`);
      throw new Error(`Falha ao verificar status: ${response.status}`);
    }

    const data = await response.json() as EasySignResponse;
    const envelopeStatus = data.status || 'UNKNOWN';
    const signerStatus = data.signers?.[0]?.status || 'UNKNOWN';

    console.info(`[BryEasySignService] Status: envelope=${envelopeStatus}, signer=${signerStatus}`);

    return { status: envelopeStatus, signerStatus };
  }
}

export const bryEasySignService = new BryEasySignService();
