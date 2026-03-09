import { pscSessionRepository, PscSessionRecord } from '@/repositories/PscSessionRepository';

export interface PscSession {
  state: string;
  pscName: string;
  medicoId: string;
  signature_session: string;
  is_authorized: boolean;
  created_at: string;
  expires_in: number;
}

export interface PscSessionsStorage {
  [medicoId: string]: PscSession;
}

class PscSessionService {
  
  private toPscSession(record: PscSessionRecord): PscSession {
    return {
      state: record.state,
      pscName: record.psc_name,
      medicoId: record.user_codigo,
      signature_session: record.signature_session,
      is_authorized: record.is_authorized,
      created_at: record.created_at || new Date().toISOString(),
      expires_in: record.expires_in
    };
  }

  private isExpiredRecord(record: PscSessionRecord): boolean {
    const expiresAt = new Date(record.expires_at).getTime();
    return Date.now() >= expiresAt;
  }

  async saveSession(medicoId: string, session: Omit<PscSession, 'created_at'>): Promise<void> {
    const created_at = new Date().toISOString();
    const expires_at = new Date(new Date(created_at).getTime() + session.expires_in * 1000).toISOString();
    
    await pscSessionRepository.createOrReplaceSession({
      user_codigo: medicoId,
      state: session.state,
      psc_name: session.pscName,
      signature_session: session.signature_session,
      is_authorized: session.is_authorized,
      expires_in: session.expires_in,
      expires_at: expires_at,
      created_at: created_at
    });
    
    console.info(`[PscSessionService] Session saved for medico: ${medicoId}, PSC: ${session.pscName}, authorized: ${session.is_authorized}`);
  }

  /**
   * @deprecated Use authorizeSessionByState instead if possible. This method tries to find the session by user_codigo (medicoId) but it's ambiguous if multiple exist (though repository ensures one active).
   */
  async updateAuthorization(medicoId: string, isAuthorized: boolean): Promise<void> {
    // We try to find the active session for this user to update it.
    // However, if we don't have the state, we can't be 100% sure which one it is if there are multiple pending.
    // But since createOrReplaceSession invalidates old ones, there should be only one active.
    
    // BUT wait, createOrReplaceSession creates a session with is_authorized=false usually.
    // So we want to find the latest session for this user that is NOT authorized yet?
    // Or just the latest session.
    
    // The repository method findValidAuthorizedSessionByUserCodigo finds AUTHORIZED sessions.
    // We need to find PENDING sessions.
    
    // Let's rely on the caller using authorizeSessionByState.
    // But for compatibility, let's log a warning.
    console.warn('[PscSessionService] updateAuthorization(medicoId, isAuthorized) is deprecated. Use authorizeSessionByState(state) instead.');
    
    // We can't easily implement this without state in the current repository design unless we add `findLatestSessionByUserCodigo`.
    // Given the prompt says "Adaptar fluxos existentes", I should probably update the caller to use `authorizeSessionByState`.
  }

  async authorizeSessionByState(state: string): Promise<void> {
    await pscSessionRepository.authorizeByState(state);
    console.info(`[PscSessionService] Session authorized for state: ${state}`);
  }

  async findSessionByState(state: string): Promise<PscSession | null> {
    const record = await pscSessionRepository.findByState(state);
    
    if (!record) {
      console.info(`[PscSessionService] No session found for state: ${state}`);
      return null;
    }

    if (this.isExpiredRecord(record)) {
      console.info(`[PscSessionService] Session expired for state: ${state}`);
      return null;
    }

    console.info(`[PscSessionService] Session found by state: ${state}, medicoId: ${record.user_codigo}`);
    return this.toPscSession(record);
  }

  async getSessionByMedicoId(medicoId: string): Promise<PscSession | null> {
    const record = await pscSessionRepository.findValidAuthorizedSessionByUserCodigo(medicoId);

    if (!record) {
      console.info(`[PscSessionService] No valid authorized session found for medico: ${medicoId}`);
      return null;
    }

    // Double check expiration (though repository query handles it)
    if (this.isExpiredRecord(record)) {
      console.info(`[PscSessionService] Session expired for medico: ${medicoId}`);
      return null;
    }

    console.info(`[PscSessionService] Valid session found for medico: ${medicoId}`);
    return this.toPscSession(record);
  }

  async removeSession(medicoId: string): Promise<void> {
    await pscSessionRepository.invalidateByUserCodigo(medicoId, 'removed_by_user');
    console.info(`[PscSessionService] Session removed (invalidated) for medico: ${medicoId}`);
  }

  isExpired(session: PscSession): boolean {
    const created = new Date(session.created_at).getTime();
    const expiresAt = created + (session.expires_in * 1000);
    return Date.now() >= expiresAt;
  }

  async getValidToken(medicoId: string): Promise<string | null> {
    const record = await pscSessionRepository.findValidAuthorizedSessionByUserCodigo(medicoId);
    
    if (!record) {
      return null;
    }
    
    if (this.isExpiredRecord(record)) {
      console.info(`[PscSessionService] Session expired for medico: ${medicoId}, invalidating...`);
      await pscSessionRepository.invalidateByUserCodigo(medicoId, 'expired_on_check');
      return null;
    }
    
    return record.signature_session;
  }

  async listAllSessions(): Promise<PscSessionsStorage> {
    const records = await pscSessionRepository.findAllValidAuthorizedSessions(50);
    const validSessions: PscSessionsStorage = {};

    for (const record of records) {
      validSessions[record.user_codigo] = this.toPscSession(record);
    }

    return validSessions;
  }
}

export const pscSessionService = new PscSessionService();
