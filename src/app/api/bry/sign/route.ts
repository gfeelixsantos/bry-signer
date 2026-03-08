import { NextRequest, NextResponse } from 'next/server';
import { signPdf, loadImageAsBase64, createSignatureImageConfig, createSignatureTextConfig } from '@/services/signPdfService';
import { KmsType, SignatureImageConfig, SignatureTextConfig } from '@/services/bryClient';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.info('[SignAPI] Recebendo requisição de assinatura...');

    const formData = await request.formData();
    const pdfBase64 = formData.get('pdfBase64') as string;
    const fileName = formData.get('fileName') as string;
    const kmsToken = formData.get('kmsToken') as string;
    const kmsType = (formData.get('kmsType') as KmsType) || 'PSC';
    const useSignatureImage = formData.get('useSignatureImage') === 'true';

    console.info(`[SignAPI] Recebido - pdfBase64: ${!!pdfBase64}, fileName: ${fileName}, kmsToken: ${kmsToken?.substring(0, 30)}..., kmsType: ${kmsType}, useSignatureImage: ${useSignatureImage}`);

    if (!pdfBase64 || !fileName || !kmsToken) {
      console.error('[SignAPI] Parâmetros faltando');
      return NextResponse.json(
        { error: 'Parâmetros incompletos: pdfBase64, fileName e kmsToken são obrigatórios' },
        { status: 400 }
      );
    }

    console.info(`[SignAPI] Assinando arquivo: ${fileName}`);
    console.info(`[SignAPI] KMS Type: ${kmsType}`);
    console.info(`[SignAPI] KMS Token: ${kmsToken.substring(0, 50)}...`);

    let imageConfig: SignatureImageConfig | undefined;
    let textConfig: SignatureTextConfig | undefined;
    let imageBase64: string | undefined;

    if (useSignatureImage) {
      console.info('[SignAPI] Carregando imagem de assinatura...');
      const logoPath = path.join(process.cwd(), 'src', 'services', 'logo-cmso.png');
      
      console.info(`[SignAPI] Caminho do logo: ${logoPath}`);
      console.info(`[SignAPI] Logo existe: ${fs.existsSync(logoPath)}`);
      
      if (fs.existsSync(logoPath)) {
        imageBase64 = await loadImageAsBase64(logoPath);
        console.info(`[SignAPI] Logo carregado, tamanho base64: ${imageBase64.length} caracteres`);
        
        imageConfig = createSignatureImageConfig({
          x: -35,
          y: 10,
          largura: 28,
          altura: 14,
          pagina: 'PRIMEIRA',
          posicao: 'INFERIOR_DIREITO'
        });
        
        textConfig = createSignatureTextConfig(
          'Assinado digitalmente por Centro Médico de Saúde',
          {
            x: -35,
            y: 26,
            fonte: 'HELVETICA',
            tamanho: 6,
            pagina: 'PRIMEIRA'
          }
        );
        
        console.info('[SignAPI] Configuração de imagem:', JSON.stringify(imageConfig));
        console.info('[SignAPI] Configuração de texto:', JSON.stringify(textConfig));
      } else {
        console.warn('[SignAPI] Arquivo de logo não encontrado, continuando sem imagem');
      }
    } else {
      console.info('[SignAPI] Assinatura sem imagem (useSignatureImage = false)');
    }

    const signedPdf = await signPdf(pdfBase64, fileName, kmsToken, kmsType, imageConfig, textConfig, imageBase64);

    console.info(`[SignAPI] PDF assinado com sucesso, retornando arquivo...`);

    return new NextResponse(signedPdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="signed_${fileName}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[SignAPI] Erro ao assinar: ${message}`);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
