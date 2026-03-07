import { NextResponse } from 'next/server';
import { bryAuthService } from '@/services/bryAuthService';

export async function GET(request: Request) {
    // 1. Pega os parâmetros da URL que o frontend vai enviar
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    const documentNonce = searchParams.get('documentNonce');

    if (!requestId || !documentNonce) {
        return NextResponse.json({ error: "Parâmetros ausentes" }, { status: 400 });
    }

    try {
        // 2. RECUPERE O TOKEN AQUI. 
        const accessToken = await bryAuthService.getAccessToken();

        // DIAGNÓSTICO CRÍTICO: Imprime o token para garantir que ele existe antes da chamada
        console.log("Token para Download:", accessToken ? "Presente" : "Vazio/Undefined");

        // 3. Monta a chamada para a BRy
        const bryUrl = `https://easysign.bry.com.br/api/service/sign/v1/signatures/${requestId}/documents/${documentNonce}/signed?returnType=BINARY`;

        const response = await fetch(bryUrl, {
            method: 'GET',
            headers: {
                // ESTE É O CABEÇALHO QUE ESTÁ FALTANDO!
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/octet-stream'
            }
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Erro na BRy:", err);
            return NextResponse.json({ error: err }, { status: response.status });
        }

        // 4. Recebe o binário do PDF e repassa para o Front-end
        const pdfBlob = await response.blob();
        return new NextResponse(pdfBlob, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="documento_assinado.pdf"`
            }
        });

    } catch (error) {
        console.error("Erro interno:", error);
        return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
    }
}
