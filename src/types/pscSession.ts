/**
 * Interface para dados de sessão PSC (Cloud PKI)
 * Segue rigorosamente os requisitos de segurança e campos obrigatórios
 */

export interface PscSessionData {
  /** Token de acesso OAuth2 do PSC - NUNCA expor em logs */
  access_token: string;
  
  /** Tempo de vida útil do token em segundos */
  expires_in: number;
  
  /** Token de renovação silenciosa - NUNCA expor em logs */
  refresh_token?: string;
  
  /** Identificador do provedor de nuvem (ex: BirdID, SerproID, BRYKMS) */
  provider: string;
  
  /** Timestamp de criação do token em milissegundos */
  created_at: number;
  
  /** Identificador único da sessão do médico */
  medico_state: string;
  
  /** Tipo de KMS (sempre 'PSC' para Cloud PKI) */
  kms_type: 'PSC';
}

export interface PscSessionValidationResult {
  /** Indica se a sessão é válida e pode ser usada */
  isValid: boolean;
  
  /** Dados da sessão se válida */
  sessionData?: PscSessionData;
  
  /** Razão da invalidade (se aplicável) */
  reason?: 'expired' | 'not_found' | 'corrupted' | 'missing_token';
  
  /** Indica se é possível tentar refresh */
  canRefresh?: boolean;
  
  /** Tempo restante em segundos (se válido) */
  remainingTime?: number;
}

export interface PscRefreshResult {
  /** Indica se o refresh foi bem-sucedido */
  success: boolean;
  
  /** Novos dados da sessão se sucesso */
  sessionData?: PscSessionData;
  
  /** Mensagem de erro se falha */
  error?: string;
  
  /** Indica se nova autenticação é necessária */
  requiresReauth?: boolean;
}

export interface PscTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
}

export interface PscCallbackData {
  state: string;
  token?: string;
  error?: string;
  error_description?: string;
}

/** Margem de segurança em segundos para evitar race conditions */
export const TOKEN_EXPIRY_MARGIN = 60;

/** Tempo padrão de vida da sessão em segundos (24 horas) */
export const DEFAULT_SESSION_LIFETIME = 86400;
