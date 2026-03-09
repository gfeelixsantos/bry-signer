import { bryClient, KmsType, SignatureImageConfig, SignatureTextConfig, SignatureQRCodeConfig } from '@/services/bryClient';
import fs from 'fs';
import path from 'path';

export async function signPdf(
  pdfBase64: string,
  fileName: string,
  kmsToken: string,
  kmsType: KmsType = 'PSC',
  imageConfig?: SignatureImageConfig,
  textConfig?: SignatureTextConfig,
  imageBase64?: string,
  qrCodeConfig?: SignatureQRCodeConfig
): Promise<ArrayBuffer> {
  console.info(`[SignPdfService] Iniciando assinatura do arquivo: ${fileName}`);
  console.info(`[SignPdfService] KMS Type: ${kmsType}`);

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
    kmsType,
    imageConfig,
    textConfig,
    imageBase64,
    qrCodeConfig
  );

  console.info(`[SignPdfService] Assinatura concluída com sucesso`);
  return signedPdf;
}

export async function loadImageAsBase64(imagePath: string): Promise<string> {
  const absolutePath = path.resolve(imagePath);
  const imageBuffer = fs.readFileSync(absolutePath);
  return imageBuffer.toString('base64');
}

export function createSignatureImageConfig(
  options?: {
    x?: number;
    y?: number;
    largura?: number;
    altura?: number;
    pagina?: number | 'TODAS' | 'PRIMEIRA' | 'ULTIMA';
    posicao?: 'INFERIOR_DIREITO' | 'INFERIOR_ESQUERDO' | 'SUPERIOR_DIREITO' | 'SUPERIOR_ESQUERDO';
  }
): SignatureImageConfig {
  return {
    coordenadaX: options?.x || 30,
    coordenadaY: options?.y || 30,
    largura: options?.largura || 40,
    altura: options?.altura || 20,
    pagina: options?.pagina || 'PRIMEIRA',
    posicao: options?.posicao || 'INFERIOR_DIREITO'
  };
}

export function createSignatureTextConfig(
  texto: string,
  options?: {
    x?: number;
    y?: number;
    fonte?: string;
    tamanho?: number;
    pagina?: number | 'TODAS' | 'PRIMEIRA' | 'ULTIMA';
  }
): SignatureTextConfig {
  return {
    texto: texto,
    coordenadaX: options?.x || 75,
    coordenadaY: options?.y || 35,
    fonte: options?.fonte || 'HELVETICA',
    tamanhoFonte: options?.tamanho || 10,
    pagina: options?.pagina || 'PRIMEIRA'
  };
}

export function createSignatureQRCodeConfig(
  texto: string,
  options?: {
    x?: number;
    y?: number;
    largura?: number;
    altura?: number;
    pagina?: number | 'TODAS' | 'PRIMEIRA' | 'ULTIMA';
    posicao?: 'INFERIOR_DIREITO' | 'INFERIOR_ESQUERDO' | 'SUPERIOR_DIREITO' | 'SUPERIOR_ESQUERDO';
  }
): SignatureQRCodeConfig {
  return {
    texto: texto,
    coordenadaX: options?.x || -25,
    coordenadaY: options?.y || 10,
    largura: options?.largura || 15,
    altura: options?.altura || 15,
    pagina: options?.pagina || 'PRIMEIRA',
    posicao: options?.posicao || 'INFERIOR_DIREITO',
    dimensao: 1
  };
}
