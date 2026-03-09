'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { listPSCs, generateIntegrationLink, checkSavedPscToken } from '@/actions/bryActions';
import { KmsType } from '@/services/bryClient';

interface PSC {
  name: string;
  id?: string;
}

type Step = 'upload' | 'link' | 'signing' | 'complete';
type SignatureMethod = 'BRYKMS' | 'PSC';

export default function Signer() {
  const [step, setStep] = useState<Step>('upload');
  const [pscs, setPscs] = useState<PSC[]>([]);
  const [selectedPsc, setSelectedPsc] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [medicoId, setMedicoId] = useState<string>('');
  const [kmsType, setKmsType] = useState<KmsType>('PSC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [hasPersistedToken, setHasPersistedToken] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState<SignatureMethod>('PSC');
  const [useSignatureImage, setUseSignatureImage] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    init();
  }, [signatureMethod]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Effect to automatically open authentication window when link is generated
  useEffect(() => {
    if (step === 'link' && qrCodeUrl) {
      const width = 800;
      const height = 600;
      const left = window.screen.width ? (window.screen.width - width) / 2 : 0;
      const top = window.screen.height ? (window.screen.height - height) / 2 : 0;
      
      const newWindow = window.open(
        qrCodeUrl,
        '_blank',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      );

      // Focus the new window if it was created
      if (newWindow) {
        newWindow.focus();
      }
    }
  }, [step, qrCodeUrl]);

  const init = async () => {
    setLoading(true);
    setError('');
    try {
      if (signatureMethod === 'BRYKMS') {
        setKmsType('BRYKMS');
        setHasPersistedToken(false);
        setMedicoId('');
        setLoading(false);
        return;
      }
      
      const tokenResult = await checkSavedPscToken();

      if (tokenResult.success && tokenResult.hasValidSession && tokenResult.medicoId) {
        setMedicoId(tokenResult.medicoId);
        setHasPersistedToken(true);
        setLoading(false);
      } else {
        await loadPSCs();
      }
    } catch (err) {
      console.error('Erro na inicialização:', err);
      if (signatureMethod === 'PSC') {
        await loadPSCs();
      } else {
        setLoading(false);
      }
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

    if (hasPersistedToken && medicoId) {
      setStep('signing');
      await performSignature();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await generateIntegrationLink(selectedPsc);
      if (result.success && result.url && result.state && result.medicoId) {
        setQrCodeUrl(result.url);
        setMedicoId(result.medicoId);
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

        if (data.authorized) {
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
    if (!pdfBase64 || !pdfFile || !medicoId) {
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
      formData.append('medicoId', medicoId);
      formData.append('kmsType', kmsType);

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

  const handleMethodChange = (method: SignatureMethod) => {
    setSignatureMethod(method);
    setSelectedPsc('');
    setHasPersistedToken(false);
    setMedicoId('');
    setError('');
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  };

  const handleSignWithBrykms = async () => {
    if (!pdfFile || !pdfBase64) {
      setError('Faça upload de um PDF primeiro');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/bry/kms-token', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Erro ao obter token BRYKMS');
      }
      
      console.info('[Signer] Token BRYKMS obtido, iniciando assinatura...');
      console.info(`[Signer] KMS Type: ${data.kmsType}`);
      console.info(`[Signer] Use Signature Image: ${useSignatureImage}`);
      
      setKmsType('BRYKMS');
      setStep('signing');
      
      const formData = new FormData();
      formData.append('pdfBase64', pdfBase64);
      formData.append('fileName', pdfFile.name);
      formData.append('kmsToken', data.token);
      formData.append('kmsType', 'BRYKMS');
      formData.append('useSignatureImage', useSignatureImage.toString());

      const signResponse = await fetch('/api/bry/sign', {
        method: 'POST',
        body: formData,
      });

      if (!signResponse.ok) {
        const errorData = await signResponse.json();
        throw new Error(errorData.error || 'Erro ao assinar PDF');
      }

      const blob = await signResponse.blob();
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
      const message = err instanceof Error ? err.message : 'Erro ao obter token BRYKMS';
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
    // Notice we do NOT clear the medicoId here if hasPersistedToken is true, 
    // so the persisted session can be utilized for consecutive signatures without refreshing.
    if (!hasPersistedToken) {
      setMedicoId('');
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Escolha o método de assinatura
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleMethodChange('BRYKMS')}
            disabled={loading}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              signatureMethod === 'BRYKMS'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                signatureMethod === 'BRYKMS' ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
              }`}>
                {signatureMethod === 'BRYKMS' && (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              <span className="font-medium text-gray-900">Certificado de Teste</span>
            </div>
            <p className="text-sm text-gray-500 ml-7">
              BRYKMS - Cofre interno da BRy para testes
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleMethodChange('PSC')}
            disabled={loading}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              signatureMethod === 'PSC'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                signatureMethod === 'PSC' ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
              }`}>
                {signatureMethod === 'PSC' && (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              <span className="font-medium text-gray-900">Meu Certificado em Nuvem</span>
            </div>
            <p className="text-sm text-gray-500 ml-7">
              BirdID, SerproID, etc - Provedores externos
            </p>
          </button>
        </div>
      </div>

      {signatureMethod === 'PSC' && (
        <>
          {hasPersistedToken ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
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
        </>
      )}

      {signatureMethod === 'BRYKMS' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-amber-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <div>
              <h3 className="text-sm font-medium text-amber-800">Ambiente de Teste</h3>
              <p className="text-sm text-amber-600 mt-1">
                Este modo utiliza o certificado de teste BRYKMS. Utilize apenas para homologação e testes.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center">
        <input
          type="checkbox"
          id="useSignatureImage"
          checked={useSignatureImage}
          onChange={(e) => setUseSignatureImage(e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <label htmlFor="useSignatureImage" className="ml-2 text-sm text-gray-700">
          Adicionar imagem/carimbo visual de assinatura
        </label>
      </div>

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

      {signatureMethod === 'BRYKMS' ? (
        <button
          onClick={handleSignWithBrykms}
          disabled={loading || !pdfFile}
          className="w-full bg-amber-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Assinando...' : 'Assinar com BRYKMS'}
        </button>
      ) : hasPersistedToken ? (
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
        <div className="space-y-3">
          <Link
            href="/easysign"
            className="block w-full bg-teal-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-teal-700 transition-colors text-center"
          >
            Assinatura com Selfie (Easy Sign)
          </Link>
          <Link
            href="/verify"
            className="block w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 transition-colors text-center"
          >
            Verificar Documento PDF
          </Link>
          <Link
            href="/validate-document"
            className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
          >
            Validar Documento por UUID
          </Link>
        </div>
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
                Autenticação Necessária
              </h2>
              <p className="text-gray-600">
                Uma nova janela foi aberta para você autenticar no provedor de certificado.
                <br />
                Caso não tenha aberto, clique no link abaixo ou escaneie o QR Code.
              </p>

              <div className="flex justify-center p-4 bg-white border-2 border-indigo-100 rounded-xl inline-block">
                <QRCodeSVG value={qrCodeUrl} size={250} level="M" />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Link de autenticação manual:
                </p>
                <a
                  href={qrCodeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline text-sm break-all font-medium"
                >
                  Clique aqui para autenticar
                </a>
                <p className="text-xs text-gray-400 break-all mt-1">
                  {qrCodeUrl}
                </p>
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
