import { NextRequest, NextResponse } from 'next/server';
import { bryClient } from '@/services/bryClient';

export type SignatureResponse = {
  nonce: number
  generalStatus: string
  signatureStatus: SignatureStatus
  signatureFormat: string
  timeStamp?: TimeStamp
  certificateStatus?: CertificateStatusInfo
  signatures?: SignerInfo[]
}

export type TimeStamp = {
  issuerName: string
  genTime: string
  serialNumber: string
  hashAlgorithm: string
}

export type CertificateStatusInfo = {
  status: string
  infoStatus: Status
  alertStatus: Status
  errorStatus: Status
}

export type SignerInfo = {
  name: string
  cpf?: string
  cnpj?: string
  signingTime: string
  signatureType: string
  certificate?: SignerCertificate
}

export type SignerCertificate = {
  certificateType: string
  issuerName: string
  serialNumber: string
  notBefore: string
  notAfter: string
}

export type SignatureStatus = {
  chainStatus: ChainStatus
  signingTime: string
  verificationReference: string
  verificationReferenceType: string
  hashAlgorithm: string
  signatureAlgorithm: string
  originalFileBase64Hash: string
  fileName: string
  metadata: Record<string, string>
}

export type ChainStatus = {
  "@type": "Chain"
  status: string
  infoStatus: Status
  alertStatus: Status
  errorStatus: Status
  certificateStatusList: CertificateStatus[]
}

export type Status = {
  keyDescriptionList: KeyDescription[]
  statusType: string
}

export type KeyDescription = {
  args: Record<string, unknown>[]
  description: string
  key: string
}

export type CertificateStatus = ChainCertificate | FinalCertificate

export type BaseCertificate = {
  "@type": string
  status: string
  infoStatus: Status
  alertStatus: Status
  errorStatus: Status
  content: string
  pkiBrazil: boolean
  verificationReference: string
  verificationReferenceType: string
  certificateInfo: CertificateInfo
  statusType: string
}

export type ChainCertificate = BaseCertificate & {
  "@type": "ChainCertificate"
}

export type FinalCertificate = BaseCertificate & {
  "@type": "FinalCertificate"
  revocationStatus?: RevocationStatus
  certificateType: string
  keyInfo: KeyInfo
  cpf?: string
  email?: string
  extensions: CertificateExtensions
  extensionPki: ExtensionPki
  crlinfo: CrlInfo
}

export type RevocationStatus = {
  date: string
  reason: string
}

export type CertificateInfo = {
  hash: string
  serial: string
  issuerDN: DN
  subjectDN: DN
  validity: Validity
}

export type DN = {
  c: string
  cn: string
  dn: string
  e: string
  email: string
  formattedCn: string
  l: string
  o: string
  ou: string[]
  st: string
}

export type Validity = {
  notAfter: string
  notBefore: string
}

export type KeyInfo = {
  extendedKeyUsages: string[]
  hash: string
  keyUsages: string[]
  signatureAlgorithm: string
  size: number
}

export type CertificateExtensions = {
  authorityInformationAccess: string
  authorityKeyIdentifier: string
  caCertificate: boolean
  certificatePolicies: CertificatePolicy[]
  crlDistributionPoints: string[]
  subjectKeyIdentifier: string
}

export type CertificatePolicy = {
  name: string
  oid: string
}

export type ExtensionPki = {
  typ: string
  birthDate: string
  nis: string
  rg: string
  rgIssuer: string
  rgIssuerFederativeUnit: string
  cei: string
  voterId: VoterId
}

export type VoterId = {
  inscriptionNumber: string
  city: string
  section: string
  federativeUnity: string
  zone: string
}

export type CrlInfo = {
  authorityKeyIdentifier: string
  certificateIssuer: DN
  nextUpdate: string
  number: number
  thisUpdate: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()
    const rawResult = await bryClient.verifyPdf(buffer, file.name)

    // Extrair a resposta da BRy (pode vir como array ou objeto)
    const bryResponse = extractBryResponse(rawResult)

    // Retornar apenas os dados relevantes da BRy, sem processamento adicional
    return NextResponse.json({
      success: true,
      bryResponse
    })

  } catch (error: unknown) {
    console.error('Erro na verificação:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido'

    return NextResponse.json(
      { error: errorMessage || 'Erro interno no servidor' },
      { status: 500 }
    )
  }
}

function extractBryResponse(data: unknown): SignatureResponse | SignatureResponse[] | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  // Se for array, retornar o array completo
  if (Array.isArray(data)) {
    return data.length > 0 ? data : null
  }

  const obj = data as Record<string, unknown>

  // Se for objeto indexado (ex: { "0": SignatureResponse })
  if ('0' in obj) {
    return obj['0'] as SignatureResponse
  }

  // Se tiver propriedade 'data' com array
  if ('data' in obj && Array.isArray(obj.data)) {
    return obj.data.length > 0 ? obj.data : null
  }

  // Verificar se já é um SignatureResponse válido
  if ('signatureStatus' in obj && 'generalStatus' in obj) {
    return obj as SignatureResponse
  }

  return null
}