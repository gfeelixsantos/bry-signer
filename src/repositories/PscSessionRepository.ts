import { supabase } from '@/services/supabaseClient';

export interface PscSessionRecord {
  id?: string;
  user_codigo: string;
  user_cpf?: string;
  user_nome?: string;
  user_perfil?: string;
  conselho?: string;
  ufconselho?: string;
  state: string;
  psc_name: string;
  signature_session: string;
  integra_url?: string;
  is_authorized: boolean;
  created_at?: string;
  updated_at?: string;
  expires_in: number;
  expires_at: string;
  consumed_at?: string;
  invalid_reason?: string;
}

export class PscSessionRepository {
  /**
   * Cria ou substitui uma sessão PSC para um usuário.
   * Se já existir uma sessão ativa para o mesmo user_codigo, ela será invalidada ou substituída.
   */
  async createOrReplaceSession(session: PscSessionRecord): Promise<void> {
    // Primeiro, invalida sessões anteriores deste usuário para garantir regra de sessão única
    await this.invalidateByUserCodigo(session.user_codigo, 'replaced_by_new_session');

    const { error } = await supabase
      .from('psc_sessions')
      .insert(session);

    if (error) {
      console.error('[PscSessionRepository] Erro ao criar sessão:', error);
      throw new Error(`Erro ao salvar sessão no Supabase: ${error.message}`);
    }
  }

  async findByState(state: string): Promise<PscSessionRecord | null> {
    const { data, error } = await supabase
      .from('psc_sessions')
      .select('*')
      .eq('state', state)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Não encontrado
      console.error('[PscSessionRepository] Erro ao buscar sessão por state:', error);
      return null;
    }

    return data as PscSessionRecord;
  }

  async findValidAuthorizedSessionByUserCodigo(userCodigo: string): Promise<PscSessionRecord | null> {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('psc_sessions')
      .select('*')
      .eq('user_codigo', userCodigo)
      .eq('is_authorized', true)
      .gt('expires_at', now)
      .is('consumed_at', null)
      .is('invalid_reason', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[PscSessionRepository] Erro ao buscar sessão válida:', error);
      return null;
    }

    return data as PscSessionRecord;
  }

  async authorizeByState(state: string): Promise<void> {
    const { error } = await supabase
      .from('psc_sessions')
      .update({ is_authorized: true, updated_at: new Date().toISOString() })
      .eq('state', state);

    if (error) {
      console.error('[PscSessionRepository] Erro ao autorizar sessão:', error);
      throw new Error(`Erro ao autorizar sessão: ${error.message}`);
    }
  }

  async invalidateByUserCodigo(userCodigo: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('psc_sessions')
      .update({ 
        invalid_reason: reason, 
        consumed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_codigo', userCodigo)
      .is('invalid_reason', null);

    if (error) {
      console.error('[PscSessionRepository] Erro ao invalidar sessões:', error);
    }
  }

  async markConsumedOrInvalid(state: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('psc_sessions')
      .update({ 
        invalid_reason: reason, 
        consumed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('state', state);

    if (error) {
      console.error('[PscSessionRepository] Erro ao marcar como consumida/inválida:', error);
    }
  }
  
  async deleteByUserCodigo(userCodigo: string): Promise<void> {
      const { error } = await supabase
        .from('psc_sessions')
        .delete()
        .eq('user_codigo', userCodigo);
        
      if (error) {
        console.error('[PscSessionRepository] Erro ao deletar sessão:', error);
      }
  }

  async findAllValidAuthorizedSessions(limit: number = 50): Promise<PscSessionRecord[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('psc_sessions')
      .select('*')
      .eq('is_authorized', true)
      .gt('expires_at', now)
      .is('consumed_at', null)
      .is('invalid_reason', null)
      .limit(limit);

    if (error) {
      console.error('[PscSessionRepository] Erro ao buscar sessões válidas:', error);
      return [];
    }

    return data as PscSessionRecord[];
  }
}

export const pscSessionRepository = new PscSessionRepository();
