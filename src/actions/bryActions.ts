'use server';

import { bryClient } from '@/services/bryClient';
import { createSession } from '@/services/sessionManager';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function listPSCs(): Promise<{ success: boolean; pscs?: Array<{ name: string; id?: string }>; error?: string }> {
  try {
    console.info('[ServerAction] Listando PSCs...');
    const pscs = await bryClient.listPSCs();
    return { success: true, pscs };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[ServerAction] Erro ao listar PSCs: ${message}`);
    return { success: false, error: message };
  }
}

export async function generateIntegrationLink(
  pscName: string
): Promise<{ success: boolean; url?: string; token?: string; state?: string; error?: string }> {
  try {
    console.info(`[ServerAction] Gerando link de integração para PSC: ${pscName}`);

    const state = generateUUID();
    createSession(state);

    const result = await bryClient.generateIntegrationLink(pscName, state);

    return {
      success: true,
      url: result.url,
      token: result.token,
      state,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[ServerAction] Erro ao gerar link: ${message}`);
    return { success: false, error: message };
  }
}
