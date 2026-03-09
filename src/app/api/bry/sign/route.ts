import { NextRequest, NextResponse } from 'next/server';
import { signPdf, loadImageAsBase64, createSignatureImageConfig, createSignatureTextConfig, createSignatureQRCodeConfig } from '@/services/signPdfService';
import { KmsType, SignatureImageConfig, SignatureTextConfig, SignatureQRCodeConfig } from '@/services/bryClient';
import { pscSessionService } from '@/services/psc-session-service';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  let medicoId: string | null = null;
  let kmsType: KmsType = 'PSC';
  
  try {
    console.info('[SignAPI] Recebendo requisição de assinatura...');

    const formData = await request.formData();
    const pdfBase64 = formData.get('pdfBase64') as string;
    const fileName = formData.get('fileName') as string;
    medicoId = formData.get('medicoId') as string | null;
    kmsType = (formData.get('kmsType') as KmsType) || 'PSC';
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

      const session = await pscSessionService.getSessionByMedicoId(medicoId);
      
      if (!session) {
        console.error(`[SignAPI] Nenhuma sessão encontrada para medico: ${medicoId}`);
        return NextResponse.json(
          { error: 'Sessão PSC não encontrada ou expirada. Autentique-se novamente.' },
          { status: 401 }
        );
      }
      
      if (!session.is_authorized) {
        console.error(`[SignAPI] Sessão não autorizada para medico: ${medicoId}`);
        return NextResponse.json(
          { error: 'Sessão PSC não autorizada. Complete a autenticação no celular.' },
          { status: 401 }
        );
      }
      
      if (!session.signature_session || typeof session.signature_session !== 'string' || !session.signature_session.trim()) {
        console.error(`[SignAPI] Token inválido para medico: ${medicoId}`);
        return NextResponse.json(
          { error: 'Token de assinatura inválido. Autentique-se novamente.' },
          { status: 401 }
        );
      }
      
      kmsToken = session.signature_session;
      
      const integraUrl = process.env.BRY_INTEGRA_URL || 'não configurada';
      const sessionAgeSeconds = Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000);
      
      console.info(`[SignAPI] ===== DIAGNÓSTICO TOKEN PSC =====`);
      console.info(`[SignAPI] medicoId: ${medicoId}`);
      console.info(`[SignAPI] created_at: ${session.created_at}`);
      console.info(`[SignAPI] expires_in: ${session.expires_in} segundos`);
      console.info(`[SignAPI] idade da sessão: ${sessionAgeSeconds} segundos`);
      console.info(`[SignAPI] token length: ${kmsToken.length}`);
      console.info(`[SignAPI] integra url: ${integraUrl}`);
      console.info(`[SignAPI] is_authorized: ${session.is_authorized}`);
      console.info(`[SignAPI] ===============================`);
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
    let signatureImageBuffer: ArrayBuffer | undefined;

    const logoPath = path.join(process.cwd(), 'logo-cmso.png');
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      signatureImageBuffer = logoBuffer.buffer.slice(
        logoBuffer.byteOffset,
        logoBuffer.byteOffset + logoBuffer.byteLength
      );
      console.info('[SignAPI] LogoCMSO carregado com sucesso');
    } catch (err) {
      console.warn('[SignAPI] LogoCMSO não encontrado, continuando sem logo');
    }

    const now = new Date();
    const dataHora = now.toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const dataHoraAssinatura = now.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const assinaturaTexto = `Documento assinado digitalmente
Certificado Digital ICP-Brasil

Dr. Gustavo Casanova Pinho
CRM-SP 258136

Data: ${dataHoraAssinatura}`;

    if (useSignatureImage) {
      console.info('[SignAPI] Configurando assinatura com QR Code dinâmico...');

      imageConfig = createSignatureImageConfig({
        altura: 22,
        largura: 100,
        x: 1,
        y: 15,
        posicao: 'INFERIOR_ESQUERDO',
        pagina: 'ULTIMA'
      });
      console.info('[SignAPI] Configuração de Imagem (Posição QR Code):', JSON.stringify(imageConfig));

      qrCodeConfig = {
        texto: `https://validar.iti.gov.br/`,
        dimensao: 10,
        margem: 0,
        nivelCorrecaoErro: 'M',
      };
      console.info('[SignAPI] Configuração de Conteúdo QR Code:', JSON.stringify(qrCodeConfig));

      textConfig = createSignatureTextConfig(
        `Assinado eletronicamente via Certificado Digital ICP-Brasil\nData: ${dataHora}\nScaneie o QR Code para validação.`,
        {
          pagina: 'ULTIMA',
          fonte: 'HELVETICA',
          tamanho: 8,
          x: 1,  
          y: 1   
        }
      );
      console.info('[SignAPI] Configuração de Texto:', JSON.stringify(textConfig));

      imageBase64 = undefined;
    } else {
      console.info('[SignAPI] Configurando assinatura visual com logo CMSO...');

      const configuracaoImagem = [{
        altura: 20,
        largura: 70,
        coordenadaX: 10,
        coordenadaY: 10,
        posicao: 'INFERIOR_ESQUERDO' as const,
        pagina: 'ULTIMA' as const
      }];

      imageConfig = configuracaoImagem[0];
      console.info('[SignAPI] Configuração de Imagem:', JSON.stringify(imageConfig));

      const configuracaoTexto = [{
        texto: assinaturaTexto,
        tamanhoFonte: 9,
        fonte: 'HELVETICA' as const,
        coordenadaX: 10,
        coordenadaY: 10,
        pagina: 'ULTIMA' as const
      }];

      textConfig = configuracaoTexto[0];
      console.info('[SignAPI] Configuração de Texto:', JSON.stringify(textConfig));
    }

    const signedPdf = await signPdf(
      pdfBase64, 
      fileName, 
      kmsToken, 
      kmsType, 
      imageConfig, 
      textConfig, 
      imageBase64, 
      qrCodeConfig,
      signatureImageBuffer
    );

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
    const errorLower = message.toLowerCase();
    
    console.error(`[SignAPI] Erro ao assinar: ${message}`);
    
    const isPscSessionInvalid = 
      message.includes('TOKEN_EXPIRED_OR_CONSUMED') ||
      errorLower.includes('expired') ||
      errorLower.includes('completed') ||
      errorLower.includes('operation for id not found');
    
    if (isPscSessionInvalid && kmsType === 'PSC' && medicoId) {
      console.error(`[SignAPI] Sessão PSC inválida (expired/completed/not found), removendo sessão do médico: ${medicoId}`);
      await pscSessionService.removeSession(medicoId);
      console.info(`[SignAPI] Sessão removida para forçar nova autenticação PSC`);
      
      return NextResponse.json(
        { 
          code: 'PSC_SESSION_INVALID',
          message: 'Sessão PSC expirada, consumida ou encerrada. Autentique-se novamente.' 
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
