import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PscSessionData } from '@/types/pscSession';
import { SecureLogger } from './securityLogger';

/**
 * Serviço de armazenamento seguro para tokens PSC
 * Implementa criptografia AES-256-GCM para proteção de dados sensíveis
 */
export class SecureStorage {
  private static readonly STORAGE_FILE = path.join(process.cwd(), '.psc_session_encrypted');
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  
  /**
   * Obtém ou gera a chave de criptografia
   * Em produção, considere usar variáveis de ambiente ou KMS
   */
  private static getEncryptionKey(): Buffer {
    // Em ambiente de produção, use uma chave mais segura (ex: AWS KMS, Azure Key Vault)
    const envKey = process.env.PSC_ENCRYPTION_KEY;
    
    if (envKey) {
      // Se existe chave no ambiente, usa ela
      return Buffer.from(envKey, 'hex');
    }
    
    // Fallback para desenvolvimento: usa chave fixa para simplificar
    // EM PRODUÇÃO: NÃO USE ESTA ABORDAGEM! Use KMS ou variáveis de ambiente.
    const fallbackKey = '12345678901234567890123456789012'; // 32 bytes para AES-256
    return Buffer.from(fallbackKey, 'utf-8');
  }
  
  /**
   * Criptografa dados da sessão PSC
   */
  private static encrypt(data: PscSessionData): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from('PSC_SESSION_V1'));
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combina IV + tag + encrypted data
      const combined = Buffer.concat([
        iv,
        tag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      const result = combined.toString('base64');
      
      SecureLogger.info('Session data encrypted successfully', {
        dataSize: JSON.stringify(data).length,
        provider: data.provider,
        state: data.medico_state
      });
      
      return result;
    } catch (error) {
      SecureLogger.error('Failed to encrypt session data', error);
      throw new Error('Encryption failed');
    }
  }
  
  /**
   * Descriptografa dados da sessão PSC
   */
  private static decrypt(encryptedData: string): PscSessionData {
    try {
      const key = this.getEncryptionKey();
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extrai IV, tag e encrypted data
      const iv = combined.slice(0, this.IV_LENGTH);
      const tag = combined.slice(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH);
      const encrypted = combined.slice(this.IV_LENGTH + this.TAG_LENGTH);
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from('PSC_SESSION_V1'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const sessionData = JSON.parse(decrypted) as PscSessionData;
      
      SecureLogger.info('Session data decrypted successfully', {
        provider: sessionData.provider,
        state: sessionData.medico_state
      });
      
      return sessionData;
    } catch (error) {
      SecureLogger.error('Failed to decrypt session data', error);
      throw new Error('Decryption failed - data may be corrupted');
    }
  }
  
  /**
   * Salva dados da sessão de forma criptografada
   */
  static async saveSession(sessionData: PscSessionData): Promise<void> {
    try {
      const encrypted = this.encrypt(sessionData);
      await fs.writeFile(this.STORAGE_FILE, encrypted, 'utf-8');
      
      SecureLogger.info('Session saved securely', {
        state: sessionData.medico_state,
        provider: sessionData.provider,
        expiresIn: sessionData.expires_in
      });
    } catch (error) {
      SecureLogger.error('Failed to save session', error);
      throw error;
    }
  }
  
  /**
   * Carrega dados da sessão de forma descriptografada
   */
  static async loadSession(): Promise<PscSessionData | null> {
    try {
      const fileExists = await fs.access(this.STORAGE_FILE).then(() => true).catch(() => false);
      
      if (!fileExists) {
        SecureLogger.info('No encrypted session file found');
        return null;
      }
      
      const encryptedData = await fs.readFile(this.STORAGE_FILE, 'utf-8');
      const sessionData = this.decrypt(encryptedData);
      
      SecureLogger.info('Session loaded successfully', {
        state: sessionData.medico_state,
        provider: sessionData.provider
      });
      
      return sessionData;
    } catch (error) {
      SecureLogger.error('Failed to load session', error);
      // Se falhar na descriptografia, remove arquivo corrompido
      try {
        await fs.unlink(this.STORAGE_FILE);
        SecureLogger.warn('Corrupted session file removed');
      } catch {
        // Ignora erro ao remover
      }
      return null;
    }
  }
  
  /**
   * Remove arquivo de sessão de forma segura
   */
  static async clearSession(): Promise<void> {
    try {
      await fs.unlink(this.STORAGE_FILE);
      SecureLogger.info('Session cleared securely');
    } catch (error) {
      // Arquivo pode não existir, não é erro
      SecureLogger.info('Session file not found or already cleared');
    }
  }
  
  /**
   * Verifica se existe sessão armazenada
   */
  static async hasSession(): Promise<boolean> {
    try {
      await fs.access(this.STORAGE_FILE);
      return true;
    } catch {
      return false;
    }
  }
}
