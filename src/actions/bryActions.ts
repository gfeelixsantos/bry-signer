'use server';

import { bryClient } from '@/services/bryClient';
import { createSession } from '@/services/sessionManager';
import { pscSessionService } from '@/services/PscSessionService';

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
): Promise<{ success: boolean; url?: string; token?: string; state?: string; medicoId?: string; error?: string }> {
  try {
    console.info(`[ServerAction] Gerando link de integração para PSC: ${pscName}`);

    const state = generateUUID();
    const medicoId = `medico_${state}`;
    createSession(state, pscName, medicoId);

    const result = await bryClient.generateIntegrationLink(pscName, state);

    return {
      success: true,
      url: result.url,
      token: result.token,
      state,
      medicoId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[ServerAction] Erro ao gerar link: ${message}`);
    return { success: false, error: message };
  }
}

export async function checkSavedPscToken(medicoId?: string): Promise<{ success: boolean; token?: string; isValid?: boolean; medicoId?: string; error?: string }> {
  try {
    console.info('[ServerAction] Verificando se existe token PSC salvo...');
    
    if (medicoId) {
      const session = await pscSessionService.getSession(medicoId);
      if (session) {
        return { success: true, token: session.signature_session, isValid: true, medicoId };
      }
    }
    
    const allSessions = await pscSessionService.listAllSessions();
    const firstMedicoId = Object.keys(allSessions)[0];
    
    if (firstMedicoId) {
      const session = allSessions[firstMedicoId];
      return { success: true, token: session.signature_session, isValid: true, medicoId: firstMedicoId };
    }

    return { success: true, token: undefined, isValid: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[ServerAction] Erro ao buscar token: ${message}`);
    return { success: false, error: message };
  }
}
