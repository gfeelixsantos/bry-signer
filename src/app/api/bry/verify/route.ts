import { NextRequest, NextResponse } from 'next/server';
import { bryClient } from '@/services/bryClient';

interface BryVerificationResponse {
  assinaturas?: Array<{
    valida: boolean;
    dataHora?: string;
    integridadeDocumento?: boolean;
    certificado?: {
      nomeTitular?: string;
      cpf?: string;
      emissor?: string;
    };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const result = await bryClient.verifyPdf(buffer, file.name);

    // Map result to friendly format
    const friendlyResult = compilarRelatorioAmigavel(result as BryVerificationResponse);

    return NextResponse.json(friendlyResult);
  } catch (error: unknown) {
    console.error('Erro na verificação:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: errorMessage || 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

// Função auxiliar para traduzir o JSON complexo da BRy para a nossa UI
function compilarRelatorioAmigavel(relatorioBRy: BryVerificationResponse) {
  // A estrutura exata dependerá do JSON retornado pela API, mas a lógica geral é:
  const assinaturas = relatorioBRy.assinaturas || [];

  if (assinaturas.length === 0) {
    return {
      status: "INVALIDO",
      mensagem: "O documento não possui assinaturas digitais.",
      icone: "❌",
      resumo: "Documento sem assinaturas identificadas."
    };
  }

  // Pega a assinatura principal (ou itera sobre todas - aqui pegamos a primeira para simplificar conforme pedido)
  const assinatura = assinaturas[0];

  // Verifica se a assinatura é válida
  // A propriedade pode variar, mas geralmente é 'valida' ou verifica-se o status da validação
  const isValid = assinatura.valida === true;

  return {
    status: isValid ? "VALIDO" : "INVALIDO",
    icone: isValid ? "✅" : "❌",
    resumo: isValid
      ? "Documento autêntico e com validade jurídica."
      : "Assinatura corrompida ou inválida.",
    detalhes: {
      medico: assinatura.certificado?.nomeTitular || "Desconhecido", // Nome do Médico
      cpf: assinatura.certificado?.cpf || "Não informado", // Para exibir formatado (ex: ***.123.456-**)
      emissor: assinatura.certificado?.emissor || "Desconhecido", // Quem emitiu o certificado (Ex: Soluti, Serpro)
      dataAssinatura: assinatura.dataHora || "Data desconhecida", // Data exata da assinatura criptográfica
      integridade: assinatura.integridadeDocumento
        ? "O documento não foi alterado."
        : "O documento foi modificado após a assinatura!",
    },
    // Retornamos também o relatório original caso o frontend precise de mais detalhes
    originalReport: relatorioBRy
  };
}
