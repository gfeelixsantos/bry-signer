'use client';

import { useState } from 'react';

export default function ValidateDocumentPage() {
  const [uuid, setUuid] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationUrl, setValidationUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showIframe, setShowIframe] = useState(false);

  const handleValidate = async () => {
    if (!uuid.trim()) {
      setError('Por favor, informe o UUID do documento.');
      return;
    }

    setLoading(true);
    setError('');
    setValidationUrl(null);
    setShowIframe(false);

    try {
      const response = await fetch(`/api/bry/validate?uuid=${encodeURIComponent(uuid.trim())}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao validar documento');
      }

      if (!data.url || typeof data.url !== 'string') {
        throw new Error('Resposta da API inválida');
      }

      setValidationUrl(data.url);
    } catch (err: unknown) {
      console.error('Erro na validação:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro ao processar a validação.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (validationUrl) {
      window.open(validationUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-(family-name:--font-geist-sans)">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Validador de Documentos BRy
          </h1>
          <p className="text-gray-600">
            Valide documentos através do UUID
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden mb-8">
          <div className="p-8">
            <div className="mb-6">
              <label htmlFor="uuid-input" className="block text-sm font-medium text-gray-700 mb-2">
                UUID do documento
              </label>
              <input
                id="uuid-input"
                type="text"
                value={uuid}
                onChange={(e) => setUuid(e.target.value)}
                placeholder="Informe o UUID do documento"
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleValidate}
                disabled={loading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Validando...
                  </span>
                ) : (
                  'Validar documento'
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
        {validationUrl && (
          <div className="bg-white shadow-xl rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Resultado da Validação</h3>
            </div>
            <div className="p-6">
              {/* Options */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <button
                  onClick={handleOpenInNewTab}
                  className="flex-1 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                >
                  Abrir página de validação
                </button>
                <button
                  onClick={() => setShowIframe(!showIframe)}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  {showIframe ? 'Ocultar visualização' : 'Visualizar no embed'}
                </button>
              </div>

              {/* URL Display */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 mb-1">URL de validação:</p>
                <p className="text-sm text-gray-900 break-all font-mono">{validationUrl}</p>
              </div>

              {/* Iframe */}
              {showIframe && (
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <iframe
                    src={validationUrl}
                    className="w-full h-[800px]"
                    title="Página de validação BRy"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
