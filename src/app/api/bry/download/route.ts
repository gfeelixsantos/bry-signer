import { NextResponse } from 'next/server';
import { bryAuthService } from '@/services/bryAuthService';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    const documentNonce = searchParams.get('documentNonce');
    const type = searchParams.get('type');

    if (!requestId || !documentNonce) {
        return NextResponse.json({ error: "Parâmetros ausentes" }, { status: 400 });
    }

    try {
        const accessToken = await bryAuthService.getAccessToken();

        const bryEasySignUrl = process.env.BRY_EASYSIGN_URL;
        if (!bryEasySignUrl) {
            throw new Error('BRY_EASYSIGN_URL não configurada no ambiente');
        }

        const endpoint = type === 'report' ? 'report' : 'signed';
        const filename = type === 'report' ? 'relatorio_evidencias.pdf' : 'documento_assinado.pdf';
        
        const bryUrl = `${bryEasySignUrl}/signatures/${requestId}/documents/${documentNonce}/${endpoint}?returnType=BINARY`;

        console.log(`[Download] URL: ${bryUrl}`);

        const response = await fetch(bryUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/octet-stream'
            }
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Erro na BRy:", err);
            return NextResponse.json({ error: err }, { status: response.status });
        }

        const pdfBlob = await response.blob();
        return new NextResponse(pdfBlob, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (error) {
        console.error("Erro interno:", error);
        return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
    }
}
