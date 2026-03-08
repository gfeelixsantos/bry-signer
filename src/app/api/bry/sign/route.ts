import { NextRequest, NextResponse } from 'next/server';
import { signPdf } from '@/services/signPdfService';
import { KmsType } from '@/services/bryClient';

export async function POST(request: NextRequest) {
  try {
    console.info('[SignAPI] Recebendo requisição de assinatura...');

    const formData = await request.formData();
    const pdfBase64 = formData.get('pdfBase64') as string;
    const fileName = formData.get('fileName') as string;
    const kmsToken = formData.get('kmsToken') as string;
    const kmsType = (formData.get('kmsType') as KmsType) || 'PSC';

    console.info(`[SignAPI] Recebido - pdfBase64: ${!!pdfBase64}, fileName: ${fileName}, kmsToken: ${kmsToken?.substring(0, 30)}..., kmsType: ${kmsType}`);

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

    const signedPdf = await signPdf(pdfBase64, fileName, kmsToken, kmsType);

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
