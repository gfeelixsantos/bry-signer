'use server';

import { bryEasySignService } from '@/services/bryEasySignService';

export async function createSignatureRequest(
  documentBase64: string,
  fileName: string,
  signerName: string,
  signerEmail: string
): Promise<{
  success: boolean;
  requestId?: string;
  documentNonce?: string;
  signatureLink?: string;
  error?: string;
}> {
  try {
    console.info('[EasySignAction] Criando requisição de assinatura facial...');
    console.info(`[EasySignAction] Arquivo: ${fileName}`);
    console.info(`[EasySignAction] Signer: ${signerName} <${signerEmail}>`);

    const result = await bryEasySignService.createSignatureRequest(
      documentBase64,
      fileName,
      signerName,
      signerEmail
    );

    return {
      success: true,
      requestId: result.requestId,
      documentNonce: result.documentNonce,
      signatureLink: result.signatureLink,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[EasySignAction] Erro ao criar requisição: ${message}`);
    return { success: false, error: message };
  }
}


