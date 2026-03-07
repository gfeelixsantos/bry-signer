interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

class BryAuthService {
  private tokenCache: TokenCache | null = null;

  private getAuthUrl(): string {
    const url = process.env.BRY_AUTH_URL;
    if (!url) {
      throw new Error('BRY_AUTH_URL não configurada');
    }
    return url;
  }

  private getClientId(): string {
    const clientId = process.env.BRY_CLIENT_ID;
    if (!clientId) {
      throw new Error('BRY_CLIENT_ID não configurado');
    }
    return clientId;
  }

  private getClientSecret(): string {
    const clientSecret = process.env.BRY_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('BRY_CLIENT_SECRET não configurado');
    }
    return clientSecret;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.tokenCache && this.tokenCache.expiresAt > now) {
      console.info('[BryAuthService] Token em cache, retornando token existente');
      return this.tokenCache.accessToken;
    }

    console.info('[BryAuthService] Gerando novo token de acesso...');
    console.info(`[BryAuthService] Request URL: ${this.getAuthUrl()}`);

    const bodyParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
    });

    try {
      const response = await fetch(this.getAuthUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      const responseText = await response.text();
      console.info(`[BryAuthService] Response Status: ${response.status}`);

      if (!response.ok) {
        console.error(`[BryAuthService] Erro na autenticação: ${responseText}`);
        throw new Error(`Falha na autenticação: ${response.status}`);
      }

      const data = JSON.parse(responseText);
      console.info('[BryAuthService] Token gerado com sucesso');

      const expiresIn = data.expires_in || 3600;
      this.tokenCache = {
        accessToken: data.access_token,
        expiresAt: now + (expiresIn * 1000) - 60000,
      };

      return this.tokenCache.accessToken;
    } catch (error) {
      console.error('[BryAuthService] Erro ao gerar token:', error);
      throw error;
    }
  }

  clearCache(): void {
    this.tokenCache = null;
    console.info('[BryAuthService] Cache de token limpo');
  }
}

export const bryAuthService = new BryAuthService();
