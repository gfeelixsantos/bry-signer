interface SessionState {
  state: string;
  validated: boolean;
  createdAt: number;
  pscName?: string;
  medicoId?: string;
}

const sessionMap = new Map<string, SessionState>();

const SESSION_TIMEOUT = 10 * 60 * 1000;

export function setSessionValidated(state: string): void {
  const session = sessionMap.get(state);
  if (session) {
    session.validated = true;
    sessionMap.set(state, session);
    console.info(`[SessionManager] Session ${state} marcada como validada`);
  } else {
    sessionMap.set(state, {
      state,
      validated: true,
      createdAt: Date.now(),
    });
    console.info(`[SessionManager] Session ${state} criada e validada`);
  }

  cleanupOldSessions();
}

export function isSessionValidated(state: string): boolean {
  const session = sessionMap.get(state);
  return session?.validated ?? false;
}

export function createSession(state: string, pscName?: string, medicoId?: string): void {
  sessionMap.set(state, {
    state,
    validated: false,
    createdAt: Date.now(),
    pscName,
    medicoId,
  });
  console.info(`[SessionManager] Session ${state} criada${pscName ? ` para PSC: ${pscName}` : ''}${medicoId ? ` medico: ${medicoId}` : ''}`);
}

function cleanupOldSessions(): void {
  const now = Date.now();
  for (const [key, session] of sessionMap.entries()) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      sessionMap.delete(key);
      console.info(`[SessionManager] Session ${key} expirada e removida`);
    }
  }
}

setInterval(cleanupOldSessions, SESSION_TIMEOUT);

export function getSessionData(state: string): SessionState | undefined {
  return sessionMap.get(state);
}
