'use server';

import { bryClient } from '@/services/bryClient';
import { createSession } from '@/services/sessionManager';
import { pscSessionService } from '@/services/psc-session-service';

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
  pscName: string,
  existingMedicoId?: string
): Promise<{ success: boolean; url?: string; state?: string; medicoId?: string; error?: string }> {
  try {
    console.info(`[ServerAction] Gerando link de integração para PSC: ${pscName}`);

    if (existingMedicoId) {
      console.info(`[ServerAction] Removendo sessão anterior para medico: ${existingMedicoId}`);
      await pscSessionService.removeSession(existingMedicoId);
    }

    const state = generateUUID();
    const medicoId = `medico_${state}`;
    createSession(state, pscName, medicoId);

    const result = await bryClient.generateIntegrationLink(pscName, state);

    const pscLifetime = parseInt(process.env.BRY_PSC_LIFETIME || '86400', 10);
    console.info(`[ServerAction] Lifetime PSC configurado: ${pscLifetime} segundos`);

    await pscSessionService.saveSession(medicoId, {
      state,
      pscName,
      medicoId,
      signature_session: result.token,
      is_authorized: false,
      expires_in: pscLifetime,
    });

    console.info(`[ServerAction] Token salvo com sucesso para medico: ${medicoId}`);

    return {
      success: true,
      url: result.url,
      state,
      medicoId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[ServerAction] Erro ao gerar link: ${message}`);
    return { success: false, error: message };
  }
}

export async function checkSavedPscToken(medicoId?: string): Promise<{ success: boolean; hasValidSession?: boolean; medicoId?: string; error?: string }> {
  try {
    console.info('[ServerAction] Verificando se existe sessão PSC válida...');
    
    if (medicoId) {
      const session = await pscSessionService.getSessionByMedicoId(medicoId);
      if (session && session.is_authorized) {
        return { success: true, hasValidSession: true, medicoId };
      }
    }
    
    const allSessions = await pscSessionService.listAllSessions();
    const firstMedicoId = Object.keys(allSessions)[0];
    
    if (firstMedicoId) {
      const session = allSessions[firstMedicoId];
      if (session.is_authorized) {
        return { success: true, hasValidSession: true, medicoId: firstMedicoId };
      }
    }

    return { success: true, hasValidSession: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[ServerAction] Erro ao buscar token: ${message}`);
    return { success: false, error: message };
  }
}
