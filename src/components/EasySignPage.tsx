'use client';

import { useState } from 'react';
import { createSignatureRequest } from '@/actions/easySignActions';

type Step = 'form' | 'camera' | 'downloading' | 'complete';

export default function EasySignPage() {
  const [step, setStep] = useState<Step>('form');
  const [signerName, setSignerName] = useState('Gabriel Teste Facial');
  const [signerEmail, setSignerEmail] = useState('eocial@cmsocupacional.com.br');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState('');
  const [requestId, setRequestId] = useState('');
  const [documentNonce, setDocumentNonce] = useState('');
  const [signatureLink, setSignatureLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError('');

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setPdfBase64(base64);
      };
      reader.readAsDataURL(file);
    } else {
      setError('Por favor, selecione um arquivo PDF válido');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signerName || !signerEmail || !pdfFile) {
      setError('Preencha todos os campos e faça upload do PDF');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await createSignatureRequest(
        pdfBase64,
        pdfFile.name,
        signerName,
        signerEmail
      );

      if (result.success && result.requestId && result.documentNonce && result.signatureLink) {
        setRequestId(result.requestId);
        setDocumentNonce(result.documentNonce);
        setSignatureLink(result.signatureLink);
        setStep('camera');
      } else {
        setError(result.error || 'Erro ao criar requisição de assinatura');
      }
    } catch {
      setError('Erro ao criar requisição de assinatura');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSignature = () => {
    if (!requestId || !documentNonce) {
      setError('Dados da assinatura incompletos');
      return;
    }

    // O navegador chama nossa rota interna passando os IDs. 
    // Nossa rota fará a requisição autenticada e devolverá o arquivo pronto!
    const urlInterna = `/api/bry/download?requestId=${requestId}&documentNonce=${documentNonce}`;

    // Isso força o download automático na tela do usuário
    window.location.href = urlInterna;

    setStep('complete');
  };

  const resetFlow = () => {
    setStep('form');
    setSignerName('');
    setSignerEmail('');
    setPdfFile(null);
    setPdfBase64('');
    setRequestId('');
    setDocumentNonce('');
    setSignatureLink('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-teal-600 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Assinatura com Selfie</h1>
          <p className="text-emerald-200">Assinatura Eletrônica BRy com Captura Facial</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Funcionário
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-black"
                  placeholder="Digite o nome completo"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail do Funcionário
                </label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-black"
                  placeholder="funcionario@empresa.com.br"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arquivo PDF
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload-easy"
                    disabled={loading}
                  />
                  <label htmlFor="pdf-upload-easy" className="cursor-pointer">
                    {pdfFile ? (
                      <div>
                        <p className="text-green-600 font-medium">{pdfFile.name}</p>
                        <p className="text-gray-500 text-sm">{(pdfFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-600">Clique para selecionar um arquivo PDF</p>
                        <p className="text-gray-400 text-sm mt-1">ou arraste e solte aqui</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !signerName || !signerEmail || !pdfFile}
                className="w-full bg-emerald-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Enviando...' : 'Iniciar Assinatura com Selfie'}
              </button>
            </form>
          )}

          {step === 'camera' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-800">
                  Assinatura com Captura Facial
                </h2>
                <p className="text-gray-600">
                  Permita o acesso à câmera para realizar a captura facial
                </p>
              </div>

              <iframe
                src={signatureLink}
                width="100%"
                height="600px"
                allow="camera; microphone"
                frameBorder="0"
                className="rounded-lg border border-gray-300"
              />

              <div className="border-t border-gray-200 pt-6">
                <p className="text-gray-600 mb-4 text-center">
                  Já realizou a assinatura?
                </p>
                <button
                  onClick={handleCheckSignature}
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Baixando...' : 'Já tirei a Selfie e Assinei! (Baixar PDF)'}
                </button>
              </div>
            </div>
          )}

          {step === 'downloading' && (
            <div className="text-center space-y-6 py-8">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent mx-auto"></div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Baixando documento assinado...
              </h2>
              <p className="text-gray-600">
                O download começará automaticamente
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center space-y-6 py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Documento Assinado com Sucesso!
              </h2>
              <p className="text-gray-600">
                O PDF assinado foi baixado automaticamente
              </p>
              <button
                onClick={resetFlow}
                className="bg-emerald-600 text-white py-3 px-8 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                Assinar Novo Documento
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-emerald-200 text-sm">
          Powered by BRy Tecnologia - Easy Sign
        </div>
      </div>
    </div>
  );
}
