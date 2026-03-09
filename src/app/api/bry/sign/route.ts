import { NextRequest, NextResponse } from 'next/server';
import { signPdf, loadImageAsBase64, createSignatureImageConfig, createSignatureTextConfig, createSignatureQRCodeConfig } from '@/services/signPdfService';
import { KmsType, SignatureImageConfig, SignatureTextConfig, SignatureQRCodeConfig } from '@/services/bryClient';
import { pscSessionService } from '@/services/PscSessionService';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.info('[SignAPI] Recebendo requisição de assinatura...');

    const formData = await request.formData();
    const pdfBase64 = formData.get('pdfBase64') as string;
    const fileName = formData.get('fileName') as string;
    const medicoId = formData.get('medicoId') as string;
    const kmsType = (formData.get('kmsType') as KmsType) || 'PSC';
    const useSignatureImage = formData.get('useSignatureImage') === 'true';

    console.info(`[SignAPI] Recebido - pdfBase64: ${!!pdfBase64}, fileName: ${fileName}, medicoId: ${medicoId}, kmsType: ${kmsType}, useSignatureImage: ${useSignatureImage}`);

    if (!pdfBase64 || !fileName) {
      console.error('[SignAPI] Parâmetros faltando');
      return NextResponse.json(
        { error: 'Parâmetros incompletos: pdfBase64 e fileName são obrigatórios' },
        { status: 400 }
      );
    }

    let kmsToken: string | null = null;

    if (kmsType === 'PSC') {
      if (!medicoId) {
        console.error('[SignAPI] medicoId obrigatório para PSC');
        return NextResponse.json(
          { error: 'medicoId é obrigatório para assinatura PSC' },
          { status: 400 }
        );
      }

      kmsToken = await pscSessionService.getValidToken(medicoId);
      
      if (!kmsToken) {
        console.error(`[SignAPI] Nenhuma sessão válida encontrada para medico: ${medicoId}`);
        return NextResponse.json(
          { error: 'Sessão PSC não encontrada ou expirada. Autentique-se novamente.' },
          { status: 401 }
        );
      }
      
      console.info(`[SignAPI] Token PSC recuperado do storage para medico: ${medicoId}`);
    } else {
      console.error('[SignAPI] BRYKMS não suportado nesta rota');
      return NextResponse.json(
        { error: 'Use a rota /api/bry/kms-token para BRYKMS' },
        { status: 400 }
      );
    }

    let imageConfig: SignatureImageConfig | undefined;
    let textConfig: SignatureTextConfig | undefined;
    let qrCodeConfig: SignatureQRCodeConfig | undefined;
    let imageBase64: string | undefined;

    if (useSignatureImage) {
      console.info('[SignAPI] Configurando assinatura com QR Code dinâmico...');
      
      const now = new Date();
      const dataHora = now.toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Passo 2: Definir as dimensões e posição do QR Code (configuracao_imagem)
      // A API utiliza o array configuracao_imagem para definir onde o QR Code vai ficar
      imageConfig = createSignatureImageConfig({
        altura: 22,
        largura: 100, // Mantemos para o texto não quebrar
        x: 1, // AUMENTE AQUI: Isso empurra todo o bloco (QR + Texto) para o lado direito da página
        y: 15,
        posicao: 'INFERIOR_ESQUERDO', // layout interno ficar perfeito
        pagina: 'PRIMEIRA'
      });
      console.info('[SignAPI] Configuração de Imagem (Posição QR Code):', JSON.stringify(imageConfig));

      // Passo 3: Enviar os dados do QR Code (configuracao_qrcode)
      // Apenas o texto/URL é necessário aqui
      qrCodeConfig = {
        texto: `https://validar.iti.gov.br/`,
        dimensao: 10,
        margem: 0,
        nivelCorrecaoErro: 'M',
      };
      console.info('[SignAPI] Configuração de Conteúdo QR Code:', JSON.stringify(qrCodeConfig));

      // Passo 4: Manter o texto ao lado (configuracao_texto)
      textConfig = createSignatureTextConfig(
        `Assinado digitalmente por: \nMédico Exemplo \nCRM: 999.999 / SP \nData: ${dataHora} \nCentro Médico de Saúde Ocupacional \nScaneie o QR Code para validação.`,
        {
          pagina: 'PRIMEIRA',
          fonte: 'HELVETICA',
          tamanho: 8,
          x: 1,  
          y: 1   
        }
      );
      console.info('[SignAPI] Configuração de Texto:', JSON.stringify(textConfig));

      // Garantir que não enviamos imagem física
      imageBase64 = undefined;
    } else {
      console.info('[SignAPI] Assinatura sem imagem (useSignatureImage = false)');
    }

    const signedPdf = await signPdf(pdfBase64, fileName, kmsToken, kmsType, imageConfig, textConfig, imageBase64, qrCodeConfig);

    console.info(`[SignAPI] PDF assinado com sucesso para medico: ${medicoId}, retornando arquivo...`);

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
