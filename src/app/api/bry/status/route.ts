import { NextRequest, NextResponse } from 'next/server';
import { pscSessionService } from '@/services/psc-session-service';

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

  const session = await pscSessionService.findSessionByState(state);

  if (!session) {
    console.info(`[Status] Sessão não encontrada para state: ${state}`);
    return NextResponse.json({ authorized: false });
  }

  const authorized = session.is_authorized;

  console.info(`[Status] State ${state} autorizado: ${authorized}`);

  return NextResponse.json({ authorized });
}
