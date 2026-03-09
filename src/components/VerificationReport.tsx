'use client';

import React from 'react';

interface VerificationReportProps {
  data: {
    status: 'VALIDO' | 'INVALIDO';
    isValid: boolean;
    resumo: string;
    mensagem: string;
    icone: string;
    cor: string;
    detalhes: {
      statusGeral: string;
      formatoAssinatura: string;
      dataVerificacao: string;
      erros?: string[];
    };
    assinatura: {
      dataHora: string;
      algoritmoHash: string;
      algoritmoAssinatura: string;
      nomeArquivo: string;
    };
    certificado: {
      nome: string;
      cpf: string;
      email: string;
      tipo: string;
      emissor: string;
      validade: {
        inicio: string;
        fim: string;
      };
      status: string;
    } | null;
    cadeia: {
      status: string;
      quantidadeCertificados: number;
      statusCadeia?: string;
      statusRevogacao?: string;
    };
    metadados: {
      hashOriginal: string;
      referenciaVerificacao: string;
      tipoReferencia: string;
      metadadosAdicionais: Record<string, string>;
    };
  };
}

const VerificationReport: React.FC<VerificationReportProps> = ({ data }) => {
  const formatDateTime = (dateString: string) => {
    if (!dateString) return "Não informado";
    try {
      return new Date(dateString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string, isValid: boolean) => {
    const baseClasses = "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium";
    if (isValid) {
      return `${baseClasses} bg-green-100 text-green-800 border border-green-200`;
    }
    return `${baseClasses} bg-red-100 text-red-800 border border-red-200`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header com Status */}
      <div className={`rounded-lg border-l-4 p-6 ${data.isValid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{data.icone}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {data.isValid ? 'Documento Válido' : 'Documento Inválido'}
              </h1>
              <p className="text-gray-600 mt-1">{data.resumo}</p>
            </div>
          </div>
          <div className={getStatusBadge(data.status, data.isValid)}>
            {data.status}
          </div>
        </div>
        
        {!data.isValid && data.detalhes.erros && data.detalhes.erros.length > 0 && (
          <div className="mt-4 p-4 bg-red-100 border border-red-200 rounded-md">
            <h3 className="font-semibold text-red-800 mb-2">Erros Identificados:</h3>
            <ul className="list-disc list-inside text-red-700 space-y-1">
              {data.detalhes.erros.map((erro, index) => (
                <li key={index}>{erro}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Cards em Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card de Informações da Assinatura */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Informações da Assinatura
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Data e Hora:</span>
                <span className="font-medium text-gray-900">{data.assinatura.dataHora}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Algoritmo de Hash:</span>
                <span className="font-medium text-gray-900">{data.assinatura.algoritmoHash}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Algoritmo de Assinatura:</span>
                <span className="font-medium text-gray-900">{data.assinatura.algoritmoAssinatura}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Nome do Arquivo:</span>
                <span className="font-medium text-gray-900 text-right max-w-xs truncate">{data.assinatura.nomeArquivo}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card de Informações do Certificado */}
        {data.certificado && (
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Informações do Certificado
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Nome do Titular:</span>
                  <span className="font-medium text-gray-900 text-right max-w-xs truncate">{data.certificado.nome}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">CPF:</span>
                  <span className="font-medium text-gray-900">{data.certificado.cpf}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900 text-right max-w-xs truncate">{data.certificado.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium text-gray-900">{data.certificado.tipo}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Emissor:</span>
                  <span className="font-medium text-gray-900 text-right max-w-xs truncate">{data.certificado.emissor}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Validade:</span>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{data.certificado.validade.inicio}</div>
                    <div className="text-sm text-gray-600">até {data.certificado.validade.fim}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card de Cadeia de Certificação */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              Cadeia de Certificação
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Status da Cadeia:</span>
                <span className={`font-medium ${data.cadeia.status === 'VALID' ? 'text-green-600' : 'text-red-600'}`}>
                  {data.cadeia.status}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Quantidade de Certificados:</span>
                <span className="font-medium text-gray-900">{data.cadeia.quantidadeCertificados}</span>
              </div>
              {data.cadeia.statusRevogacao && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Status de Revogação:</span>
                  <span className={`font-medium ${data.cadeia.statusRevogacao === 'VÁLIDO' ? 'text-green-600' : 'text-red-600'}`}>
                    {data.cadeia.statusRevogacao}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card de Metadados do Documento */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
              Metadados do Documento
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Formato da Assinatura:</span>
                <span className="font-medium text-gray-900">{data.detalhes.formatoAssinatura}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Hash Original:</span>
                <span className="font-medium text-gray-900 text-right max-w-xs truncate font-mono text-xs">
                  {data.metadados.hashOriginal}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Referência de Verificação:</span>
                <span className="font-medium text-gray-900 text-right max-w-xs truncate">
                  {data.metadados.referenciaVerificacao}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Data da Verificação:</span>
                <span className="font-medium text-gray-900">{formatDateTime(data.detalhes.dataVerificacao)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé informativo */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Verificação realizada em:</span> {formatDateTime(data.detalhes.dataVerificacao)}
          </div>
          <div className="text-sm text-gray-500">
            Sistema de Validação de Assinaturas Digitais BRy
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationReport;
