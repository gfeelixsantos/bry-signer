import fs from 'fs/promises';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), 'session_psc.json');

interface PscTokenData {
    medico_id: string;
    token_psc: string;
    saved_at: string;
}

export async function savePscToken(state: string, token: string): Promise<void> {
    try {
        const data: PscTokenData = {
            medico_id: state,
            token_psc: token,
            saved_at: new Date().toISOString(),
        };

        await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
        console.info(`[PscTokenStorage] Token do PSC salvo para o state: ${state}`);
    } catch (error) {
        console.error('[PscTokenStorage] Erro ao salvar token do PSC:', error);
    }
}

export async function getPscToken(): Promise<PscTokenData | null> {
    try {
        const fileExists = await fs.access(STORAGE_FILE).then(() => true).catch(() => false);

        if (!fileExists) {
            return null;
        }

        const content = await fs.readFile(STORAGE_FILE, 'utf-8');
        const data = JSON.parse(content) as PscTokenData;
        console.info(`[PscTokenStorage] Token carregado com sucesso, salvo em: ${data.saved_at}`);

        return data;
    } catch (error) {
        console.error('[PscTokenStorage] Erro ao carregar token do PSC:', error);
        return null;
    }
}
