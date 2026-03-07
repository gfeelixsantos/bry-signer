'use server';

import { bryEasySignService } from '@/services/bryEasySignService';

export async function createSignatureRequest(
  documentBase64: string,
  fileName: string,
  signerName: string,
  signerEmail: string,
  personalIdentifier: string,
  personalIdentifierType: string
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
    console.info(`[EasySignAction] CPF: ${personalIdentifier}`);

    const result = await bryEasySignService.createSignatureRequest(
      documentBase64,
      fileName,
      signerName,
      signerEmail,
      personalIdentifier,
      personalIdentifierType
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

export async function checkSignatureStatus(
  requestId: string
): Promise<{
  success: boolean;
  status?: string;
  signerStatus?: string;
  isComplete?: boolean;
  error?: string;
}> {
  try {
    const result = await bryEasySignService.getSignatureStatus(requestId);
    
    const isComplete = 
      result.status === 'FINISHED' && 
      (result.signerStatus === 'SIGNED' || result.signerStatus === 'CONCLUDED');

    return {
      success: true,
      status: result.status,
      signerStatus: result.signerStatus,
      isComplete,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[EasySignAction] Erro ao verificar status: ${message}`);
    return { success: false, error: message };
  }
}


