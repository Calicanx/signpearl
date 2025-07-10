import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

type Document = Database['public']['Tables']['documents']['Row'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type DocumentUpdate = Database['public']['Tables']['documents']['Update'];
type Recipient = Database['public']['Tables']['recipients']['Row'];
type RecipientInsert = Database['public']['Tables']['recipients']['Insert'];
type SignatureField = Database['public']['Tables']['signature_fields']['Row'];
type SignatureFieldInsert = Database['public']['Tables']['signature_fields']['Insert'];
type AccessLog = Database['public']['Tables']['access_logs']['Insert'];

export class DocumentService {
  // Document operations
  static async createDocument(document: DocumentInsert): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .insert(document)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getDocuments(userId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getDocument(documentId: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  static async updateDocument(documentId: string, updates: DocumentUpdate): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteDocument(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  }

  // File upload to Supabase Storage
  static async uploadDocumentFile(documentId: string, file: File): Promise<string> {
    try {
      // Corrected file path: relative to the 'documents' bucket
      const filePath = `${documentId}/${uuidv4()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('documents') // Bucket name
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to generate public URL for the uploaded file');
      }

      // Update the document with the file_url
      const { error: updateError } = await supabase
        .from('documents')
        .update({ file_url: urlData.publicUrl })
        .eq('id', documentId);

      if (updateError) {
        console.error('Error updating document with file_url:', updateError);
        throw new Error(`Failed to update document with file_url: ${updateError.message}`);
      }

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error in uploadDocumentFile:', error);
      throw error;
    }
  }

  // Recipient operations
  static async addRecipients(recipients: RecipientInsert[]): Promise<Recipient[]> {
    const { data, error } = await supabase
      .from('recipients')
      .insert(recipients)
      .select();

    if (error) throw error;
    return data || [];
  }

  static async getRecipients(documentId: string): Promise<Recipient[]> {
    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .eq('document_id', documentId);

    if (error) throw error;
    return data || [];
  }

  static async getRecipientByToken(token: string): Promise<Recipient | null> {
    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .eq('signing_url_token', token)
      .gt('token_expiry', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  static async updateRecipientStatus(recipientId: string, status: 'pending' | 'viewed' | 'signed'): Promise<void> {
    const { error } = await supabase
      .from('recipients')
      .update({ status })
      .eq('id', recipientId);

    if (error) throw error;
  }

  // Signature field operations
  static async saveSignatureFields(fields: SignatureFieldInsert[]): Promise<SignatureField[]> {
    const { data, error } = await supabase
      .from('signature_fields')
      .insert(fields)
      .select();

    if (error) throw error;
    return data || [];
  }

  static async getSignatureFields(documentId: string): Promise<SignatureField[]> {
    const { data, error } = await supabase
      .from('signature_fields')
      .select('*')
      .eq('document_id', documentId);

    if (error) throw error;
    return data || [];
  }

  // Signature operations
  static async saveSignature(signature: {
    document_id: string;
    recipient_id: string;
    signature_data: string;
    ip_address?: string;
    user_agent?: string;
    location?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('signatures')
      .insert({
        ...signature,
        signed_at: new Date().toISOString(),
      });

    if (error) throw error;
  }

  // Access logging
  static async logAccess(log: AccessLog): Promise<void> {
    const { error } = await supabase
      .from('access_logs')
      .insert({
        ...log,
        timestamp: new Date().toISOString(),
      });

    if (error) throw error;
  }

  static async getAccessLogs(documentId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('access_logs')
      .select(`
        *,
        recipients (
          email,
          name
        )
      `)
      .eq('document_id', documentId)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get documents with recipients and signatures for dashboard
  static async getDocumentsWithDetails(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        recipients (
          id,
          email,
          name,
          status,
          signing_url_token,
          signatures (
            id,
            recipient_id,
            signed_at
          )
        )
      `)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get document for signing (public access via token)
  static async getDocumentForSigning(documentId: string, token: string): Promise<{
    document: Document;
    recipient: Recipient;
    fields: SignatureField[];
  } | null> {
    try {
      const recipient = await this.getRecipientByToken(token);
      if (!recipient || recipient.document_id !== documentId) {
        return null;
      }

      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError) {
        console.error('Error fetching document:', docError);
        return null;
      }

      const fields = await this.getSignatureFields(documentId);

      return {
        document,
        recipient,
        fields,
      };
    } catch (error) {
      console.error('Error in getDocumentForSigning:', error);
      return null;
    }
  }
}