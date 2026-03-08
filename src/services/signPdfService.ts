import { bryClient, KmsType } from '@/services/bryClient';

export async function signPdf(
  pdfBase64: string,
  fileName: string,
  kmsToken: string,
  kmsType: KmsType = 'PSC'
): Promise<ArrayBuffer> {
  console.info(`[SignPdfService] Iniciando assinatura do arquivo: ${fileName}`);
  console.info(`[SignPdfService] KMS Type: ${kmsType}`);
  console.info(`[SignPdfService] KMS Token: ${kmsToken?.substring(0, 50)}...`);

  if (!kmsToken) {
    throw new Error('kmsToken está vazio ou nulo');
  }

  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  );

  const signedPdf = await bryClient.signPdf(
    arrayBuffer,
    fileName,
    kmsToken,
    kmsType
  );

  console.info(`[SignPdfService] Assinatura concluída com sucesso`);
  return signedPdf;
}
