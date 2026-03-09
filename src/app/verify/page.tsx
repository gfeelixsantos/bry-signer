'use client';

import { useState } from 'react';
import type { SignatureResponse, SignerInfo, FinalCertificate } from '@/app/api/bry/verify/route';

interface VerificationResult {
  success: boolean;
  bryResponse: SignatureResponse | SignatureResponse[] | null;
}

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState('');
  const [verificationDate] = useState(() => new Date().toISOString());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleVerify = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo PDF.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/bry/verify', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao verificar documento');
      }

      setResult(data);
    } catch (err: unknown) {
      console.error('Erro na verificação:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro ao processar a verificação.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper para extrair a primeira assinatura da resposta (array ou objeto)
  const getFirstSignature = (response: VerificationResult | null): SignatureResponse | null => {
    if (!response?.bryResponse) return null;
    if (Array.isArray(response.bryResponse)) {
      return response.bryResponse[0] ?? null;
    }
    return response.bryResponse;
  };

  // Helper para determinar se o documento é válido
  const isDocumentValid = (response: VerificationResult | null): boolean => {
    const sig = getFirstSignature(response);
    return sig?.generalStatus === 'VALID';
  };

  // Helper para formatar data
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Não informado';
    try {
      return new Date(dateString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Helper para formatar CPF
  const formatCPF = (cpf?: string): string => {
    if (!cpf) return '';
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return cpf;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
  };

  // Helper para formatar CNPJ
  const formatCNPJ = (cnpj?: string): string => {
    if (!cnpj) return '';
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return cnpj;
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
  };

  const firstSignature = getFirstSignature(result);
  const documentValid = isDocumentValid(result);
  const signatureStatus = firstSignature?.signatureStatus;
  const chainStatus = signatureStatus?.chainStatus;
  const certificateList = chainStatus?.certificateStatusList ?? [];
  const finalCertificate = certificateList.find(cert => cert['@type'] === 'FinalCertificate') as FinalCertificate | undefined;
  const certificateInfo = finalCertificate?.certificateInfo;
  const timeStamp = firstSignature?.timeStamp;
  const certificateStatus = firstSignature?.certificateStatus;
  const signersList = firstSignature?.signatures ?? [];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Verificador de Documentos Assinados
          </h1>
          <p className="text-gray-600">
            Visualizador de relatório de verificação da BRy
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden mb-8">
          <div className="p-8">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione o arquivo PDF
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-500 transition-colors">
                <div className="space-y-1 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload de arquivo</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept=".pdf"
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="pl-1">ou arraste e solte</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF até 10MB</p>
                </div>
              </div>
              {file && (
                <div className="mt-2 flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  <span className="font-medium mr-2">Arquivo selecionado:</span>
                  {file.name}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleVerify}
                disabled={!file || loading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                  (!file || loading) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verificando...
                  </span>
                ) : (
                  'Verificar Documento'
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Result Section */}
        {result && firstSignature && (
          <div className="space-y-6">
            {/* Header Status */}
            <div className={`bg-white shadow-xl rounded-lg overflow-hidden border-t-8 ${documentValid ? 'border-green-500' : 'border-red-500'}`}>
              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className={`text-5xl ${documentValid ? 'text-green-500' : 'text-red-500'}`}>
                    {documentValid ? '✅' : '❌'}
                  </div>
                </div>
                <div className="text-center">
                  <h2 className={`text-2xl font-bold ${documentValid ? 'text-green-600' : 'text-red-600'} mb-2`}>
                    {documentValid ? 'Documento válido' : 'Documento inválido'}
                  </h2>
                  <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">
                    Status BRy: {firstSignature?.generalStatus}
                  </p>
                </div>
              </div>
            </div>

            {documentValid && (
              <>
                {/* 1️⃣ STATUS DO DOCUMENTO */}
                <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">1️⃣ Status do Documento</h3>
                  </div>
                  <div className="p-6">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Status da Verificação</dt>
                        <dd className="mt-1 text-sm font-semibold text-green-600">
                          {firstSignature?.generalStatus === 'VALID' ? 'Válido' : firstSignature?.generalStatus}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Nome do Documento</dt>
                        <dd className="mt-1 text-sm text-gray-900">{signatureStatus?.fileName ?? 'Não informado'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Data da Verificação</dt>
                        <dd className="mt-1 text-sm text-gray-900">{formatDate(verificationDate)}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Hash do Documento</dt>
                        <dd className="mt-1 text-xs text-gray-600 font-mono break-all bg-gray-100 p-2 rounded">
                          {signatureStatus?.originalFileBase64Hash ?? 'Não informado'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* 2️⃣ INTEGRIDADE */}
                <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">2️⃣ Integridade</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                        <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Documento não alterado</p>
                          <p className="text-xs text-gray-500">{signatureStatus?.chainStatus?.status === 'VALID' ? 'Hash verificado' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                        <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Certificados válidos</p>
                          <p className="text-xs text-gray-500">{certificateStatus?.status ?? chainStatus?.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                        <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Identidade reconhecida</p>
                          <p className="text-xs text-gray-500">{finalCertificate?.cpf ? `CPF: ${formatCPF(finalCertificate.cpf)}` : 'CNPJ ou outro'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3️⃣ LISTA DE ASSINANTES */}
                <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">3️⃣ Lista de Assinantes</h3>
                  </div>
                  <div className="p-6">
                    {signersList.length > 0 ? (
                      <div className="space-y-4">
                        {signersList.map((signer: SignerInfo, index: number) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <dt className="text-xs font-medium text-gray-500 uppercase">Nome do Assinante</dt>
                                <dd className="mt-1 text-sm font-semibold text-gray-900">{signer.name ?? 'Não informado'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-medium text-gray-500 uppercase">CPF/CNPJ</dt>
                                <dd className="mt-1 text-sm text-gray-900">
                                  {signer.cpf ? formatCPF(signer.cpf) : signer.cnpj ? formatCNPJ(signer.cnpj) : 'Não informado'}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs font-medium text-gray-500 uppercase">Data da Assinatura</dt>
                                <dd className="mt-1 text-sm text-gray-900">{formatDate(signer.signingTime)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-medium text-gray-500 uppercase">Tipo de Assinatura</dt>
                                <dd className="mt-1 text-sm text-gray-900">{signer.signatureType ?? 'Não informado'}</dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-medium text-gray-500 uppercase">Nome do Signatário</dt>
                            <dd className="mt-1 text-sm font-semibold text-gray-900">
                              {certificateInfo?.subjectDN?.formattedCn ?? certificateInfo?.subjectDN?.cn ?? 'Não informado'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-gray-500 uppercase">CPF/CNPJ</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {finalCertificate?.cpf ? formatCPF(finalCertificate.cpf) : 'Não informado'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-gray-500 uppercase">Data da Assinatura</dt>
                            <dd className="mt-1 text-sm text-gray-900">{formatDate(signatureStatus?.signingTime)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-gray-500 uppercase">Tipo de Assinatura</dt>
                            <dd className="mt-1 text-sm text-gray-900">{firstSignature?.signatureFormat ?? 'Não informado'}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4️⃣ CERTIFICADO DO ASSINANTE */}
                <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">4️⃣ Certificado do Assinante</h3>
                  </div>
                  <div className="p-6">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Tipo do Certificado</dt>
                        <dd className="mt-1 text-sm text-gray-900">{finalCertificate?.certificateType ?? 'Não informado'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Autoridade Certificadora</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {certificateInfo?.issuerDN?.formattedCn ?? certificateInfo?.issuerDN?.cn ?? 'Não informado'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Número de Série</dt>
                        <dd className="mt-1 text-sm font-mono text-gray-900">{certificateInfo?.serial ?? 'Não informado'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Validade</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          <div>Início: {formatDate(certificateInfo?.validity?.notBefore)}</div>
                          <div>Fim: {formatDate(certificateInfo?.validity?.notAfter)}</div>
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Status da Cadeia</dt>
                        <dd className="mt-1 text-sm text-gray-900">{chainStatus?.status ?? 'Não informado'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* 5️⃣ CARIMBO DO TEMPO */}
                {timeStamp && (
                  <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-800">5️⃣ Carimbo do Tempo</h3>
                    </div>
                    <div className="p-6">
                      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Autoridade do Carimbo</dt>
                          <dd className="mt-1 text-sm text-gray-900">{timeStamp?.issuerName ?? 'Não informado'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Data e Hora</dt>
                          <dd className="mt-1 text-sm text-gray-900">{formatDate(timeStamp?.genTime)}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-gray-500">Número de Série</dt>
                          <dd className="mt-1 text-sm font-mono text-gray-900">{timeStamp?.serialNumber ?? 'Não informado'}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Documento Inválido */}
            {!documentValid && (
              <div className="bg-red-50 rounded-lg p-6 border border-red-200 text-center">
                <p className="text-red-700">
                  O documento não possui uma assinatura digital válida conforme validação da BRy.
                </p>
                <p className="text-red-600 mt-2 text-sm">
                  Status: {firstSignature?.generalStatus}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
