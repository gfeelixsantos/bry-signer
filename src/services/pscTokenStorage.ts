import fs from 'fs/promises';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), 'medico_session.json');

interface PscTokenData {
  medico_state: string;
  psc_token: string;
  created_at: string;
  expires_in_seconds: number;
}

export async function savePscToken(state: string, token: string): Promise<void> {
  try {
    const data: PscTokenData = {
      medico_state: state,
      psc_token: token,
      created_at: new Date().toISOString(),
      expires_in_seconds: 604800,
    };

    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.info(`[PscTokenStorage] Token do PSC salvo para o state: ${state}`);
  } catch (error) {
    console.error('[PscTokenStorage] Erro ao salvar token do PSC:', error);
  }
}

export async function getPscToken(): Promise<{ token: string; isValid: boolean } | null> {
  try {
    const fileExists = await fs.access(STORAGE_FILE).then(() => true).catch(() => false);

    if (!fileExists) {
      console.info('[PscTokenStorage] Arquivo de sessão não existe');
      return null;
    }

    const content = await fs.readFile(STORAGE_FILE, 'utf-8');
    const data = JSON.parse(content) as PscTokenData;

    const createdAt = new Date(data.created_at).getTime();
    const now = Date.now();
    const expiresInMs = data.expires_in_seconds * 1000;
    const isValid = (now - createdAt) < expiresInMs;

    console.info(`[PscTokenStorage] Token carregado, válido: ${isValid}, criado em: ${data.created_at}`);

    if (isValid) {
      return { token: data.psc_token, isValid: true };
    }

    console.info('[PscTokenStorage] Token expirado');
    return { token: data.psc_token, isValid: false };
  } catch (error) {
    console.error('[PscTokenStorage] Erro ao carregar token do PSC:', error);
    return null;
  }
}
