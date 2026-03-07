import { NextRequest, NextResponse } from 'next/server';
import { signPdf } from '@/services/signPdfService';

export async function POST(request: NextRequest) {
  try {
    console.info('[SignAPI] Recebendo requisição de assinatura...');

    const formData = await request.formData();
    const pdfBase64 = formData.get('pdfBase64') as string;
    const fileName = formData.get('fileName') as string;
    const kmsToken = formData.get('kmsToken') as string;

    if (!pdfBase64 || !fileName || !kmsToken) {
      console.error('[SignAPI] Parâmetros faltando');
      return NextResponse.json(
        { error: 'Parâmetros incompletos: pdfBase64, fileName e kmsToken são obrigatórios' },
        { status: 400 }
      );
    }

    console.info(`[SignAPI] Assinando arquivo: ${fileName}`);

    const signedPdf = await signPdf(pdfBase64, fileName, kmsToken);

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
