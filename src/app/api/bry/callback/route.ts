import { NextRequest, NextResponse } from 'next/server';
import { setSessionValidated } from '@/services/sessionManager';
import { savePscToken } from '@/services/pscTokenStorage';

const HTML_RESPONSE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autenticação Concluída</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .checkmark {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #4CAF50;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .checkmark::after {
      content: '✓';
      font-size: 40px;
      color: white;
    }
    h1 {
      color: #333;
      margin: 0 0 10px;
    }
    p {
      color: #666;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark"></div>
    <h1>Autenticação Concluída</h1>
    <p>Retorne ao computador para continuar.</p>
  </div>
</body>
</html>`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state');
  const token = searchParams.get('token');

  console.info(`[Callback] Recebido callback com state: ${state} e token presente: ${!!token}`);

  if (!state) {
    console.error('[Callback] State não fornecido');
    return new NextResponse(
      '<html><body><h1>Erro</h1><p>Parâmetro state não fornecido.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (token) {
    await savePscToken(state, token);
  } else {
    console.warn('[Callback] Token não foi retornado pelo PSC na URL.');
  }

  setSessionValidated(state);

  return new NextResponse(HTML_RESPONSE, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}
