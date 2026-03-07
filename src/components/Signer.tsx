'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { listPSCs, generateIntegrationLink, checkSavedPscToken } from '@/actions/bryActions';

interface PSC {
  name: string;
  id?: string;
}

type Step = 'upload' | 'link' | 'signing' | 'complete';

export default function Signer() {
  const [step, setStep] = useState<Step>('upload');
  const [pscs, setPscs] = useState<PSC[]>([]);
  const [selectedPsc, setSelectedPsc] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [kmsToken, setKmsToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [hasPersistedToken, setHasPersistedToken] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      const tokenResult = await checkSavedPscToken();

      if (tokenResult.success && tokenResult.token) {
        setKmsToken(tokenResult.token);
        setHasPersistedToken(true);
        setLoading(false);
      } else {
        await loadPSCs();
      }
    } catch (err) {
      console.error('Erro na inicialização:', err);
      await loadPSCs();
    }
  };

  const loadPSCs = async () => {
    setError('');
    try {
      const result = await listPSCs();
      if (result.success && result.pscs) {
        setPscs(result.pscs);
      } else {
        setError(result.error || 'Erro ao carregar PSCs');
      }
    } catch {
      setError('Erro ao carregar PSCs');
    } finally {
      setLoading(false);
    }
  };

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

  const handleGenerateLink = async () => {
    if (!selectedPsc || !pdfFile) {
      setError('Selecione um PSC e faça upload de um PDF');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await generateIntegrationLink(selectedPsc);
      if (result.success && result.url && result.token && result.state) {
        setQrCodeUrl(result.url);
        setKmsToken(result.token);
        setStep('link');
        startPolling(result.state);
      } else {
        setError(result.error || 'Erro ao gerar link de integração');
      }
    } catch {
      setError('Erro ao gerar link de integração');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (state: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/bry/status?state=${state}`);
        const data = await response.json();

        if (data.validated) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          setStep('signing');
          await performSignature();
        }
      } catch (err) {
        console.error('Erro no polling:', err);
      }
    }, 3000);
  };

  const performSignature = async () => {
    if (!pdfBase64 || !pdfFile || !kmsToken) {
      setError('Dados da assinatura incompletos');
      setStep('upload');
      return;
    }

    setStep('signing');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('pdfBase64', pdfBase64);
      formData.append('fileName', pdfFile.name);
      formData.append('kmsToken', kmsToken);

      const response = await fetch('/api/bry/sign', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao assinar PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed_${pdfFile.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStep('complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao assinar PDF';
      setError(message);
      setStep('upload');
    } finally {
      setLoading(false);
    }
  };

  const handleSignDirectly = async () => {
    if (!pdfFile || !pdfBase64) {
      setError('Faça upload de um PDF primeiro');
      return;
    }
    await performSignature();
  };

  const resetFlow = () => {
    setStep('upload');
    setPdfFile(null);
    setPdfBase64('');
    setQrCodeUrl('');
    setError('');
    // Notice we do NOT clear the kmsToken here if hasPersistedToken is true, 
    // so the persisted token can be utilized for consecutive signatures without refreshing.
    if (!hasPersistedToken) {
      setKmsToken('');
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      {hasPersistedToken ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path></svg>
            <div>
              <h3 className="text-sm font-medium text-indigo-800">Sessão Ativa</h3>
              <p className="text-sm text-indigo-600 mt-1">
                Uma autorização prévia já foi salva. Você pode assinar diretamente.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecione o Provedor de Certificado (PSC)
          </label>
          <select
            value={selectedPsc}
            onChange={(e) => setSelectedPsc(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
            disabled={loading}
          >
            <option value="">Selecione um PSC...</option>
            {pscs.map((psc) => (
              <option key={psc.name} value={psc.name}>
                {psc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload do Documento PDF
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
            id="pdf-upload"
            disabled={loading}
          />
          <label htmlFor="pdf-upload" className="cursor-pointer">
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

      {hasPersistedToken ? (
        <button
          onClick={handleSignDirectly}
          disabled={loading || !pdfFile}
          className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Assinando...' : 'Assinar Documento Diretamente'}
        </button>
      ) : (
        <button
          onClick={handleGenerateLink}
          disabled={loading || !selectedPsc || !pdfFile}
          className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Carregando...' : 'Gerar Link de Integração'}
        </button>
      )}

      <div className="border-t border-gray-200 pt-6">
        <p className="text-center text-gray-600 mb-4">
          Ou utilize outro método de assinatura
        </p>
        <Link
          href="/easysign"
          className="block w-full bg-teal-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-teal-700 transition-colors text-center"
        >
          Assinatura com Selfie (Easy Sign)
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Assinatura Digital BRy</h1>
          <p className="text-indigo-200">Assine seus documentos PDF com certificado em nuvem</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {step === 'upload' && renderUploadStep()}

          {step === 'link' && (
            <div className="text-center space-y-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Escaneie o QR Code com seu celular
              </h2>
              <p className="text-gray-600">
                Você será redirecionado para autenticar no provedor de certificado
              </p>

              <div className="flex justify-center p-4 bg-white border-2 border-indigo-100 rounded-xl inline-block">
                <QRCodeSVG value={qrCodeUrl} size={250} level="M" />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Ou abra diretamente no celular:
                </p>
                <a
                  href={qrCodeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline text-sm break-all"
                >
                  {qrCodeUrl}
                </a>
              </div>

              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                <span className="text-gray-600">Aguardando autenticação...</span>
              </div>
            </div>
          )}

          {step === 'signing' && (
            <div className="text-center space-y-6 py-8">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Assinando documento...
              </h2>
              <p className="text-gray-600">
                Por favor, aguarde enquanto assinamos seu PDF
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
                className="bg-indigo-600 text-white py-3 px-8 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Assinar Novo Documento
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-indigo-200 text-sm">
          Powered by BRy Tecnologia
        </div>
      </div>
    </div>
  );
}
