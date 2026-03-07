import { bryClient } from '@/services/bryClient';

export async function signPdf(
  pdfBase64: string,
  fileName: string,
  kmsToken: string
): Promise<ArrayBuffer> {
  console.info(`[SignPdfService] Iniciando assinatura do arquivo: ${fileName}`);

  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  );

  const signedPdf = await bryClient.signPdf(
    arrayBuffer,
    fileName,
    kmsToken
  );

  console.info(`[SignPdfService] Assinatura concluída com sucesso`);
  return signedPdf;
}
