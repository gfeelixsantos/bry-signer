'use client';

import { useState } from 'react';

interface VerificationResult {
  status: 'VALIDO' | 'INVALIDO';
  icone: string;
  resumo: string;
  detalhes?: {
    medico: string;
    cpf: string;
    emissor: string;
    dataAssinatura: string;
    integridade: string;
  };
  mensagem?: string;
}

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState('');

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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Verificador de Documentos Assinados
          </h1>
          <p className="text-gray-600">
            Valide a autenticidade de atestados e receitas médicas assinadas digitalmente.
          </p>
        </div>

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
                  'Verificar Autenticidade'
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

        {result && (
          <div className={`bg-white shadow-xl rounded-lg overflow-hidden border-t-8 ${result.status === 'VALIDO' ? 'border-green-500' : 'border-red-500'}`}>
            <div className="p-8">
              <div className="flex items-center justify-center mb-6">
                <div className={`text-6xl ${result.status === 'VALIDO' ? 'text-green-500' : 'text-red-500'}`}>
                  {result.icone}
                </div>
              </div>
              
              <div className="text-center mb-8">
                <h2 className={`text-2xl font-bold ${result.status === 'VALIDO' ? 'text-green-600' : 'text-red-600'} mb-2`}>
                  {result.resumo}
                </h2>
                <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">
                  Assinatura verificada em conformidade com o Padrão ICP-Brasil (PAdES)
                </p>
              </div>

              {result.detalhes && (
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Detalhes da Assinatura</h3>
                  
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Médico Responsável</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-semibold">{result.detalhes.medico}</dd>
                    </div>
                    
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">CPF do Signatário</dt>
                      <dd className="mt-1 text-sm text-gray-900">{result.detalhes.cpf}</dd>
                    </div>
                    
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Emissor do Certificado</dt>
                      <dd className="mt-1 text-sm text-gray-900">{result.detalhes.emissor}</dd>
                    </div>
                    
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Data da Assinatura</dt>
                      <dd className="mt-1 text-sm text-gray-900">{new Date(result.detalhes.dataAssinatura).toLocaleString('pt-BR')}</dd>
                    </div>
                    
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Integridade do Documento</dt>
                      <dd className="mt-1 text-sm flex items-center">
                        {result.detalhes.integridade.includes('não foi alterado') ? (
                          <span className="text-green-600 flex items-center font-medium">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {result.detalhes.integridade}
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center font-medium">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {result.detalhes.integridade}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              
              {!result.detalhes && result.mensagem && (
                 <div className="bg-red-50 rounded-lg p-6 border border-red-200 text-center">
                    <p className="text-red-700">{result.mensagem}</p>
                 </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
