import { 
  PscSessionData, 
  PscSessionValidationResult, 
  PscRefreshResult, 
  PscTokenResponse,
  TOKEN_EXPIRY_MARGIN 
} from '@/types/pscSession';
import { SecureStorage } from './secureStorage';
import { SecureLogger } from './securityLogger';

/**
 * Serviço principal de gerenciamento de sessão PSC (Cloud PKI)
 * Implementa verificação de validade, refresh automático e armazenamento seguro
 */
export class PscSessionService {
  private static instance: PscSessionService;
  private sessionCache: PscSessionData | null = null;
  private lastValidation: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 segundos

  private constructor() {}

  static getInstance(): PscSessionService {
    if (!PscSessionService.instance) {
      PscSessionService.instance = new PscSessionService();
    }
    return PscSessionService.instance;
  }

  /**
   * Salva dados da sessão PSC após autenticação bem-sucedida
   */
  async saveSession(
    medicoState: string,
    tokenResponse: PscTokenResponse,
    provider: string
  ): Promise<void> {
    try {
      const sessionData: PscSessionData = {
        access_token: tokenResponse.access_token,
        expires_in: tokenResponse.expires_in || 86400, // 24h default
        refresh_token: tokenResponse.refresh_token,
        provider,
        created_at: Date.now(),
        medico_state: medicoState,
        kms_type: 'PSC'
      };

      // Salva de forma criptografada
      await SecureStorage.saveSession(sessionData);
      
      // Atualiza cache
      this.sessionCache = sessionData;
      this.lastValidation = Date.now();

      SecureLogger.tokenOperation('session_saved', tokenResponse.access_token.length, provider);
      SecureLogger.info('PSC session saved successfully', {
        state: medicoState,
        provider,
        expiresIn: sessionData.expires_in
      });
    } catch (error) {
      SecureLogger.error('Failed to save PSC session', error);
      throw new Error('Failed to save session data');
    }
  }

  /**
   * Verifica validade da sessão atual (pre-flight check)
   * Implementa margem de segurança de 60 segundos
   */
  async checkSessionValidity(): Promise<PscSessionValidationResult> {
    try {
      // Usa cache se recente
      const now = Date.now();
      if (this.sessionCache && (now - this.lastValidation) < this.CACHE_DURATION) {
        const isValid = this.isSessionValid(this.sessionCache);
        return {
          isValid,
          sessionData: isValid ? this.sessionCache : undefined,
          reason: isValid ? undefined : 'expired',
          canRefresh: !isValid && !!this.sessionCache.refresh_token,
          remainingTime: isValid ? this.calculateRemainingTime(this.sessionCache) : undefined
        };
      }

      // Carrega do armazenamento
      const sessionData = await SecureStorage.loadSession();
      
      if (!sessionData) {
        SecureLogger.sessionValidation('unknown', false, 'not_found');
        return {
          isValid: false,
          reason: 'not_found',
          canRefresh: false
        };
      }

      // Atualiza cache
      this.sessionCache = sessionData;
      this.lastValidation = now;

      const isValid = this.isSessionValid(sessionData);
      const remainingTime = isValid ? this.calculateRemainingTime(sessionData) : undefined;

      SecureLogger.sessionValidation(
        sessionData.medico_state, 
        isValid, 
        isValid ? undefined : 'expired',
        remainingTime
      );

      return {
        isValid,
        sessionData: isValid ? sessionData : undefined,
        reason: isValid ? undefined : 'expired',
        canRefresh: !isValid && !!sessionData.refresh_token,
        remainingTime
      };
    } catch (error) {
      SecureLogger.error('Failed to check session validity', error);
      return {
        isValid: false,
        reason: 'corrupted',
        canRefresh: false
      };
    }
  }

  /**
   * Obtém token de acesso válido, com refresh automático se necessário
   */
  async getValidAccessToken(): Promise<string | null> {
    const validation = await this.checkSessionValidity();

    if (validation.isValid && validation.sessionData) {
      return validation.sessionData.access_token;
    }

    // Tenta refresh se possível
    if (validation.canRefresh && this.sessionCache?.refresh_token) {
      const refreshResult = await this.refreshSession(this.sessionCache.refresh_token);
      
      if (refreshResult.success && refreshResult.sessionData) {
        return refreshResult.sessionData.access_token;
      }
    }

    return null;
  }

  /**
   * Renova automaticamente o token usando refresh_token
   */
  async refreshSession(refreshToken: string): Promise<PscRefreshResult> {
    try {
      SecureLogger.tokenOperation('refresh_attempt', refreshToken.length);

      // Implementação do refresh OAuth2
      const refreshResponse = await this.performTokenRefresh(refreshToken);
      
      if (!this.sessionCache) {
        throw new Error('No session data available for refresh');
      }

      // Atualiza dados da sessão
      const updatedSession: PscSessionData = {
        ...this.sessionCache,
        access_token: refreshResponse.access_token,
        expires_in: refreshResponse.expires_in || this.sessionCache.expires_in,
        refresh_token: refreshResponse.refresh_token || this.sessionCache.refresh_token,
        created_at: Date.now()
      };

      // Salva dados atualizados
      await SecureStorage.saveSession(updatedSession);
      this.sessionCache = updatedSession;
      this.lastValidation = Date.now();

      SecureLogger.refreshOperation(this.sessionCache.medico_state, true);
      SecureLogger.tokenOperation('refresh_success', refreshResponse.access_token.length);

      return {
        success: true,
        sessionData: updatedSession
      };
    } catch (error) {
      SecureLogger.refreshOperation(this.sessionCache?.medico_state || 'unknown', false, 
        error instanceof Error ? error.message : 'Unknown error');
      
      // Se refresh falhar, limpa sessão
      await this.clearSession();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed',
        requiresReauth: true
      };
    }
  }

  /**
   * Executa o refresh de token com a API do PSC
   */
  private async performTokenRefresh(refreshToken: string): Promise<PscTokenResponse> {
    // NOTA: Implementar conforme documentação específica do PSC
    // Exemplo genérico OAuth2:
    
    const tokenUrl = `${process.env.BRY_AUTH_URL}/oauth/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.BRY_CLIENT_ID || '',
        client_secret: process.env.BRY_CLIENT_SECRET || '',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    
    return {
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      scope: tokenData.scope
    };
  }

  /**
   * Limpa sessão atual (logout)
   */
  async clearSession(): Promise<void> {
    try {
      await SecureStorage.clearSession();
      this.sessionCache = null;
      this.lastValidation = 0;
      
      SecureLogger.info('Session cleared successfully');
    } catch (error) {
      SecureLogger.error('Failed to clear session', error);
      throw error;
    }
  }

  /**
   * Verifica se existe sessão ativa
   */
  async hasActiveSession(): Promise<boolean> {
    const validation = await this.checkSessionValidity();
    return validation.isValid;
  }

  /**
   * Obtém dados da sessão atual se válida
   */
  async getCurrentSession(): Promise<PscSessionData | null> {
    const validation = await this.checkSessionValidity();
    return validation.sessionData || null;
  }

  /**
   * Verifica validade interna da sessão
   */
  private isSessionValid(session: PscSessionData): boolean {
    const now = Date.now();
    const expiryTime = session.created_at + (session.expires_in * 1000);
    const isValid = now < (expiryTime - (TOKEN_EXPIRY_MARGIN * 1000));
    
    return isValid;
  }

  /**
   * Calcula tempo restante em segundos
   */
  private calculateRemainingTime(session: PscSessionData): number {
    const now = Date.now();
    const expiryTime = session.created_at + (session.expires_in * 1000);
    const remainingMs = expiryTime - now;
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Middleware para verificação pré-assinatura
   * Intercepta requisições e injeta token válido
   */
  async preSignatureCheck(): Promise<{ 
    canProceed: boolean; 
    token?: string; 
    error?: string;
    requiresReauth?: boolean;
  }> {
    const validation = await this.checkSessionValidity();

    if (validation.isValid && validation.sessionData) {
      SecureLogger.info('Pre-signature check: VALID session');
      return {
        canProceed: true,
        token: validation.sessionData.access_token
      };
    }

    // Tenta refresh automático
    if (validation.canRefresh && this.sessionCache?.refresh_token) {
      SecureLogger.info('Pre-signature check: Attempting automatic refresh');
      const refreshResult = await this.refreshSession(this.sessionCache.refresh_token);
      
      if (refreshResult.success && refreshResult.sessionData) {
        return {
          canProceed: true,
          token: refreshResult.sessionData.access_token
        };
      }
    }

    // Sessão inválida e não pode ser renovada
    SecureLogger.warn('Pre-signature check: INVALID session, reauth required');
    return {
      canProceed: false,
      error: validation.reason === 'not_found' 
        ? 'Nenhuma sessão ativa encontrada' 
        : 'Sua sessão de assinatura expirou por segurança',
      requiresReauth: true
    };
  }
}

// Export singleton instance
export const pscSessionService = PscSessionService.getInstance();
