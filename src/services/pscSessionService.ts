import fs from 'fs/promises';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), 'storage', 'psc-sessions.json');

export interface PscSession {
  pscName: string;
  signature_session: string;
  created_at: string;
  expires_in: number;
}

export interface PscSessionsStorage {
  [medicoId: string]: PscSession;
}

class PscSessionService {
  private async readStorage(): Promise<PscSessionsStorage> {
    try {
      const content = await fs.readFile(STORAGE_FILE, 'utf-8');
      return JSON.parse(content) as PscSessionsStorage;
    } catch (error) {
      console.info('[PscSessionService] Storage file not found or empty, returning empty object');
      return {};
    }
  }

  private async writeStorage(data: PscSessionsStorage): Promise<void> {
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  async saveSession(medicoId: string, session: Omit<PscSession, 'created_at'>): Promise<void> {
    const storage = await this.readStorage();
    
    storage[medicoId] = {
      ...session,
      created_at: new Date().toISOString(),
    };

    await this.writeStorage(storage);
    console.info(`[PscSessionService] Session saved for medico: ${medicoId}, PSC: ${session.pscName}`);
  }

  async getSession(medicoId: string): Promise<PscSession | null> {
    const storage = await this.readStorage();
    const session = storage[medicoId];

    if (!session) {
      console.info(`[PscSessionService] No session found for medico: ${medicoId}`);
      return null;
    }

    if (this.isExpired(session)) {
      console.info(`[PscSessionService] Session expired for medico: ${medicoId}`);
      return null;
    }

    console.info(`[PscSessionService] Valid session found for medico: ${medicoId}`);
    return session;
  }

  async removeSession(medicoId: string): Promise<void> {
    const storage = await this.readStorage();
    
    if (storage[medicoId]) {
      delete storage[medicoId];
      await this.writeStorage(storage);
      console.info(`[PscSessionService] Session removed for medico: ${medicoId}`);
    }
  }

  isExpired(session: PscSession): boolean {
    const created = new Date(session.created_at).getTime();
    const expiresAt = created + (session.expires_in * 1000);
    
    return Date.now() >= expiresAt;
  }

  async getValidToken(medicoId: string): Promise<string | null> {
    const session = await this.getSession(medicoId);
    
    if (!session) {
      return null;
    }
    
    if (this.isExpired(session)) {
      console.info(`[PscSessionService] Session expired for medico: ${medicoId}, removing...`);
      await this.removeSession(medicoId);
      return null;
    }
    
    return session.signature_session;
  }

  async listAllSessions(): Promise<PscSessionsStorage> {
    const storage = await this.readStorage();
    const validSessions: PscSessionsStorage = {};

    for (const [medicoId, session] of Object.entries(storage)) {
      if (!this.isExpired(session)) {
        validSessions[medicoId] = session;
      }
    }

    return validSessions;
  }
}

export const pscSessionService = new PscSessionService();
