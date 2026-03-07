import { NextRequest, NextResponse } from 'next/server';
import { isSessionValidated } from '@/services/sessionManager';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state');

  console.info(`[Status] Verificando status para state: ${state}`);

  if (!state) {
    console.error('[Status] State não fornecido');
    return NextResponse.json(
      { error: 'State não fornecido' },
      { status: 400 }
    );
  }

  const validated = isSessionValidated(state);

  console.info(`[Status] State ${state} validado: ${validated}`);

  return NextResponse.json({ validated });
}
