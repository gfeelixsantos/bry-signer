import { NextRequest, NextResponse } from 'next/server';

const BRY_VALIDATE_BASE_URL = 'https://easysign.hom.bry.com.br/validate';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid || uuid.trim() === '') {
      return NextResponse.json(
        { error: 'UUID do documento não informado' },
        { status: 400 }
      );
    }

    const validationUrl = `${BRY_VALIDATE_BASE_URL}/${uuid}`;

    return NextResponse.json({
      url: validationUrl,
    });
  } catch (error: unknown) {
    console.error('Erro ao gerar URL de validação:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      { error: errorMessage || 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
