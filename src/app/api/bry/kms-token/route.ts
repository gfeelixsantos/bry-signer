import { NextResponse } from 'next/server';
import { bryClient } from '@/services/bryClient';

export async function POST() {
  try {
    console.info('[KmsTokenAPI] Preparando dados BRYKMS...');
    
    const uuidCert = process.env.BRYKMS_UUID_CERT;
    const user = process.env.BRYKMS_USER;
    const pin = process.env.BRYKMS_PIN;
    const token = process.env.BRYKMS_TOKEN;

    if (!uuidCert && !user) {
      throw new Error('BRYKMS_UUID_CERT ou BRYKMS_USER deve ser configurado');
    }

    if (!pin && !token) {
      throw new Error('BRYKMS_PIN ou BRYKMS_TOKEN deve ser configurado');
    }

    const kmsData = bryClient.buildBrykmsData({
      uuid_cert: uuidCert,
      user: user,
      pin: pin,
      token: token,
    });
    
    console.info('[KmsTokenAPI] Dados BRYKMS preparados com sucesso');
    console.info(`[KmsTokenAPI] KMS Data: ${kmsData}`);
    
    return NextResponse.json({ 
      token: kmsData,
      kmsType: 'BRYKMS'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[KmsTokenAPI] Erro ao preparar dados: ${message}`);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
