export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Document {
  id: string;
  title: string;
  status: 'draft' | 'pending' | 'signed' | 'completed';
  createdAt: string;
  recipients: string[];
  templateId?: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  usage: number;
}

export interface SignatureField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  type: 'signature' | 'text' | 'date';
  label: string;
  required: boolean;
  assignedTo?: string;
}

export interface SentDocument {
  id: string;
  title: string;
  status: 'sent' | 'viewed' | 'signed' | 'completed';
  sentAt: string;
  recipients: Array<{
    email: string;
    name: string;
    status: 'pending' | 'viewed' | 'signed';
    signedAt?: string;
  }>;
  fields: SignatureField[];
}

export type Page = 'landing' | 'signin' | 'signup' | 'dashboard';