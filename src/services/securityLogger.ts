/**
 * Utilitário de logging seguro para dados sensíveis de PSC
 * REQUISITO CRÍTICO DE SEGURANÇA: NUNCA expor tokens em logs
 */

/**
 * Mascara valores sensíveis para logs
 * @param sensitiveData Dado sensível a ser mascarado
 * @param visibleChars Número de caracteres visíveis no início
 * @returns String mascarada
 */
export function maskSensitiveData(sensitiveData: string, visibleChars: number = 8): string {
  if (!sensitiveData || typeof sensitiveData !== 'string') {
    return '[NULL_OR_INVALID]';
  }
  
  if (sensitiveData.length <= visibleChars + 4) {
    return sensitiveData.substring(0, Math.min(3, sensitiveData.length)) + '****';
  }
  
  return sensitiveData.substring(0, visibleChars) + '...****';
}

/**
 * Interface para dados de log seguros
 */
export interface SafeLogData {
  [key: string]: any;
}

/**
 * Remove campos sensíveis de objetos para logging seguro
 * @param data Objeto que pode conter dados sensíveis
 * @returns Objeto seguro para logging
 */
export function sanitizeForLogging(data: SafeLogData): SafeLogData {
  const sensitiveFields = [
    'access_token',
    'refresh_token', 
    'token',
    'pin',
    'password',
    'secret',
    'authorization'
  ];
  
  const sanitized: SafeLogData = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Verifica se é um campo sensível
    const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));
    
    if (isSensitive && typeof value === 'string') {
      // Mascara valores sensíveis
      sanitized[key] = maskSensitiveData(value);
    } else if (typeof value === 'object' && value !== null) {
      // Recursivamente sanitiza objetos aninhados
      sanitized[key] = sanitizeForLogging(value);
    } else {
      // Mantém valores não sensíveis
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Logger seguro para operações PSC
 */
export class SecureLogger {
  private static log(level: 'info' | 'error' | 'warn', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data: sanitizeForLogging(data) })
    };
    
    // Usa console nativo com dados sanitizados
    switch (level) {
      case 'info':
        console.info(`[PSC-Session] ${message}`, data ? sanitizeForLogging(data) : '');
        break;
      case 'error':
        console.error(`[PSC-Session] ${message}`, data ? sanitizeForLogging(data) : '');
        break;
      case 'warn':
        console.warn(`[PSC-Session] ${message}`, data ? sanitizeForLogging(data) : '');
        break;
    }
  }
  
  static info(message: string, data?: any): void {
    this.log('info', message, data);
  }
  
  static error(message: string, data?: any): void {
    this.log('error', message, data);
  }
  
  static warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }
  
  /**
   * Log específico para operações de token (não expõe o token)
   */
  static tokenOperation(operation: string, tokenLength?: number, provider?: string): void {
    this.info(`Token operation: ${operation}`, {
      tokenLength: tokenLength || 'unknown',
      provider: provider || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Log para validação de sessão
   */
  static sessionValidation(state: string, isValid: boolean, reason?: string, remainingTime?: number): void {
    this.info(`Session validation: ${isValid ? 'VALID' : 'INVALID'}`, {
      state,
      reason,
      remainingTime: remainingTime ? `${remainingTime}s` : undefined,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Log para operações de refresh
   */
  static refreshOperation(state: string, success: boolean, error?: string): void {
    this.info(`Token refresh: ${success ? 'SUCCESS' : 'FAILED'}`, {
      state,
      error: error ? maskSensitiveData(error, 20) : undefined,
      timestamp: new Date().toISOString()
    });
  }
}
