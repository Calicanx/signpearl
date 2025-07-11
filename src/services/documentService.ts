import { supabase, getAuthenticatedClient } from '../lib/supabase';
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
    const authSupabase = await getAuthenticatedClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated to create a document');
    }
    const documentWithOwner = { ...document, owner_id: user.id };

    const { data, error } = await authSupabase
      .from('documents')
      .insert(documentWithOwner)
      .select()
      .single();

    if (error) {
      console.error('Create document error:', JSON.stringify(error, null, 2));
      throw error;
    }
    return data;
  }

  static async getDocuments(userId: string): Promise<Document[]> {
    const authSupabase = await getAuthenticatedClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || user.id !== userId) {
      throw new Error('User does not have permission to view these documents');
    }

    const { data, error } = await authSupabase
      .from('documents')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get documents error:', JSON.stringify(error, null, 2));
      throw error;
    }
    return data || [];
  }

  static async getDocument(documentId: string): Promise<Document | null> {
    const authSupabase = await getAuthenticatedClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated to view this document');
    }

    const { data, error } = await authSupabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('owner_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Get document error:', JSON.stringify(error, null, 2));
      throw error;
    }
    return data;
  }

  static async updateDocument(documentId: string, updates: DocumentUpdate): Promise<Document> {
    const authSupabase = await getAuthenticatedClient();
    const { data: document, error: docError } = await authSupabase
      .from('documents')
      .select('owner_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document validation error:', JSON.stringify(docError, null, 2));
      throw new Error('Document not found');
    }

    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || document.owner_id !== user.id) {
      throw new Error('User does not have permission to update this document');
    }

    const { data, error } = await authSupabase
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      console.error('Update document error:', JSON.stringify(error, null, 2));
      throw error;
    }
    return data;
  }

  static async deleteDocument(documentId: string): Promise<void> {
    const authSupabase = await getAuthenticatedClient();
    const { data: document, error: docError } = await authSupabase
      .from('documents')
      .select('owner_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document validation error:', JSON.stringify(docError, null, 2));
      throw new Error('Document not found');
    }

    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || document.owner_id !== user.id) {
      throw new Error('User does not have permission to delete this document');
    }

    const { error } = await authSupabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      console.error('Delete document error:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  // File upload to Supabase Storage
  static async uploadDocumentFile(documentId: string, file: File): Promise<string> {
    try {
      // Validate documentId format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(documentId)) {
        throw new Error('Invalid document ID format');
      }

      // Validate file
      if (!file || file.size === 0 || file.type !== 'application/pdf') {
        throw new Error('Invalid file: Must be a non-empty PDF');
      }

      // Verify PDF header
      const reader = new FileReader();
      reader.readAsArrayBuffer(file.slice(0, 10));
      await new Promise(resolve => {
        reader.onload = () => {
          const bytes = new Uint8Array(reader.result as ArrayBuffer);
          console.log('File start bytes:', bytes);
          const pdfHeader = String.fromCharCode(...bytes.slice(0, 4));
          if (pdfHeader !== '%PDF') {
            throw new Error('File is not a valid PDF');
          }
          resolve(null);
        };
      });

      // Get authenticated client
      const authSupabase = await getAuthenticatedClient();

      // Verify document exists and user has permission
      const { data: document, error: docError } = await authSupabase
        .from('documents')
        .select('owner_id')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        console.error('Document validation error:', JSON.stringify(docError, null, 2));
        throw new Error('Document not found');
      }

      const { data: { user } } = await authSupabase.auth.getUser();
      console.log('Authenticated user ID:', user?.id);
      if (!user || document.owner_id !== user.id) {
        throw new Error('User does not have permission to upload to this document');
      }

      // FIX: New storage path structure
      const filePath = `${user.id}/documents/${documentId}/${uuidv4()}.pdf`;
      console.log('Uploading to path:', filePath);

      const { error: uploadError, data } = await authSupabase.storage
        .from('documents')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: false, // Important: set to false for new uploads
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      console.log('Upload response:', JSON.stringify(data, null, 2));

      const { data: urlData } = authSupabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to generate public URL for the uploaded file');
      }

      // Update the document with the file_url
      const { error: updateError } = await authSupabase
        .from('documents')
        .update({ file_url: urlData.publicUrl })
        .eq('id', documentId);

      if (updateError) {
        console.error('Error updating document with file_url:', JSON.stringify(updateError, null, 2));
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
    const authSupabase = await getAuthenticatedClient();
    const documentIds = [...new Set(recipients.map(r => r.document_id))];
    for (const documentId of documentIds) {
      const { data: document, error: docError } = await authSupabase
        .from('documents')
        .select('owner_id')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        console.error('Document validation error:', JSON.stringify(docError, null, 2));
        throw new Error(`Document ${documentId} not found`);
      }

      const { data: { user } } = await authSupabase.auth.getUser();
      if (!user || document.owner_id !== user.id) {
        throw new Error(`User does not have permission to add recipients to document ${documentId}`);
      }
    }

    const { data, error } = await authSupabase
      .from('recipients')
      .insert(recipients)
      .select();

    if (error) {
      console.error('Add recipients error:', JSON.stringify(error, null, 2));
      throw error;
    }
    return data || [];
  }

  static async getRecipients(documentId: string): Promise<Recipient[]> {
    const authSupabase = await getAuthenticatedClient();
    const { data: document, error: docError } = await authSupabase
      .from('documents')
      .select('owner_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document validation error:', JSON.stringify(docError, null, 2));
      throw new Error('Document not found');
    }

    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || document.owner_id !== user.id) {
      throw new Error('User does not have permission to view recipients for this document');
    }

    const { data, error } = await authSupabase
      .from('recipients')
      .select('*')
      .eq('document_id', documentId);

    if (error) {
      console.error('Get recipients error:', JSON.stringify(error, null, 2));
      throw error;
    }
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
      console.error('Get recipient by token error:', JSON.stringify(error, null, 2));
      throw error;
    }
    return data;
  }

  static async updateRecipientStatus(recipientId: string, status: 'pending' | 'viewed' | 'signed'): Promise<void> {
    const authSupabase = await getAuthenticatedClient();
    const { data: recipient, error: recError } = await authSupabase
      .from('recipients')
      .select('document_id')
      .eq('id', recipientId)
      .single();

    if (recError || !recipient) {
      console.error('Recipient validation error:', JSON.stringify(recError, null, 2));
      throw new Error('Recipient not found');
    }

    const { data: document, error: docError } = await authSupabase
      .from('documents')
      .select('owner_id')
      .eq('id', recipient.document_id)
      .single();

    if (docError || !document) {
      console.error('Document validation error:', JSON.stringify(docError, null, 2));
      throw new Error('Document not found');
    }

    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || document.owner_id !== user.id) {
      throw new Error('User does not have permission to update this recipient');
    }

    const { error } = await authSupabase
      .from('recipients')
      .update({ status })
      .eq('id', recipientId);

    if (error) {
      console.error('Update recipient status error:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  // Signature field operations
static async saveSignatureFields(fields: SignatureFieldInsert[]): Promise<SignatureField[]> {
    try {
        const authSupabase = await getAuthenticatedClient();
        const documentIds = [...new Set(fields.map(f => f.document_id))];

        // Validate document ownership for all document IDs
        for (const documentId of documentIds) {
            const { data: document, error: docError } = await authSupabase
                .from('documents')
                .select('owner_id')
                .eq('id', documentId)
                .single();

            if (docError || !document) {
                console.error('Document validation error:', JSON.stringify(docError, null, 2));
                throw new Error(`Document ${documentId} not found: ${docError?.message || 'Unknown error'}`);
            }

            const { data: { user } } = await authSupabase.auth.getUser();
            if (!user || document.owner_id !== user.id) {
                throw new Error(`User does not have permission to add signature fields to document ${documentId}`);
            }
        }

        // Insert signature fields
        const { data, error } = await authSupabase
            .from('signature_fields')
            .insert(fields)
            .select();

        if (error) {
            console.error('Save signature fields error:', JSON.stringify(error, null, 2));
            throw new Error(`Failed to save signature fields: ${error.message}`);
        }

        return data || [];
    } catch (error: any) {
        console.error('Unexpected error in saveSignatureFields:', error);
        throw new Error(`Failed to save signature fields: ${error.message || 'Unknown error'}`);
    }
}

  static async getSignatureFields(documentId: string): Promise<SignatureField[]> {
    const authSupabase = await getAuthenticatedClient();
    const { data: document, error: docError } = await authSupabase
      .from('documents')
      .select('owner_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document validation error:', JSON.stringify(docError, null, 2));
      throw new Error('Document not found');
    }

    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || document.owner_id !== user.id) {
      throw new Error('User does not have permission to view signature fields for this document');
    }

    const { data, error } = await authSupabase
      .from('signature_fields')
      .select('*')
      .eq('document_id', documentId);

    if (error) {
      console.error('Get signature fields error:', JSON.stringify(error, null, 2));
      throw error;
    }
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
    const authSupabase = await getAuthenticatedClient();
    const { data: document, error: docError } = await authSupabase
      .from('documents')
      .select('owner_id')
      .eq('id', signature.document_id)
      .single();

    if (docError || !document) {
      console.error('Document validation error:', JSON.stringify(docError, null, 2));
      throw new Error('Document not found');
    }

    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || document.owner_id !== user.id) {
      throw new Error('User does not have permission to save signatures for this document');
    }

    const { error } = await authSupabase
      .from('signatures')
      .insert({
        ...signature,
        signed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Save signature error:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  // Access logging
  static async logAccess(log: AccessLog): Promise<void> {
    const authSupabase = await getAuthenticatedClient();
    const { data: document, error: docError } = await authSupabase
      .from('documents')
      .select('owner_id')
      .eq('id', log.document_id)
      .single();

    if (docError || !document) {
      console.error('Document validation error:', JSON.stringify(docError, null, 2));
      throw new Error('Document not found');
    }

    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || document.owner_id !== user.id) {
      throw new Error('User does not have permission to log access for this document');
    }

    const { error } = await authSupabase
      .from('access_logs')
      .insert({
        ...log,
        timestamp: new Date().toISOString(),
      });

    if (error) {
      console.error('Log access error:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  static async getAccessLogs(documentId: string): Promise<any[]> {
    const authSupabase = await getAuthenticatedClient();
    const { data: document, error: docError } = await authSupabase
      .from('documents')
      .select('owner_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document validation error:', JSON.stringify(docError, null, 2));
      throw new Error('Document not found');
    }

    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || document.owner_id !== user.id) {
      throw new Error('User does not have permission to view access logs for this document');
    }

    const { data, error } = await authSupabase
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

    if (error) {
      console.error('Get access logs error:', JSON.stringify(error, null, 2));
      throw error;
    }
    return data || [];
  }

  // Get documents with recipients and signatures for dashboard
  static async getDocumentsWithDetails(userId: string): Promise<any[]> {
    const authSupabase = await getAuthenticatedClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || user.id !== userId) {
      throw new Error('User does not have permission to view these documents');
    }

    const { data, error } = await authSupabase
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

    if (error) {
      console.error('Get documents with details error:', JSON.stringify(error, null, 2));
      throw error;
    }
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
        console.error('Error fetching document:', JSON.stringify(docError, null, 2));
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