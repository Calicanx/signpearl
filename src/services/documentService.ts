import { supabase, getAuthenticatedClient } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, rgb } from 'pdf-lib';

type Document = Database['public']['Tables']['documents']['Row'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type DocumentUpdate = Database['public']['Tables']['documents']['Update'];
type Recipient = Database['public']['Tables']['recipients']['Row'];
type RecipientInsert = Database['public']['Tables']['recipients']['Insert'];
type SignatureField = Database['public']['Tables']['signature_fields']['Row'] & {
  signature_data: string | null;
};
type SignatureFieldInsert = Database['public']['Tables']['signature_fields']['Insert'];
type AccessLog = Database['public']['Tables']['access_logs']['Insert'];

const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export class DocumentService {
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
      throw new Error(`Failed to create document: ${error.message}`);
    }
    return data;
  }

  static async getDocuments(userId: string): Promise<Document[]> {
    if (!isValidUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

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
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }
    return data || [];
  }

  static async getSentDocuments(userId: string): Promise<Document[]> {
    if (!isValidUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    const authSupabase = await getAuthenticatedClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user || user.id !== userId) {
      throw new Error('User does not have permission to view sent documents');
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
          signatures (*)
        )
      `)
      .eq('owner_id', userId)
      .in('status', ['sent', 'signed', 'completed'])
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Get sent documents error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to fetch sent documents: ${error.message}`);
    }
    return data || [];
  }

  static async getDocument(documentId: string): Promise<Document | null> {
    if (!isValidUUID(documentId)) {
      console.error('Invalid document ID format:', documentId);
      return null;
    }

    const authSupabase = await getAuthenticatedClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      throw new Error('User must be authenticated to view this document');
    }

    const { data, error } = await authSupabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('owner_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.warn('Document not found for ID:', documentId);
        return null;
      }
      console.error('Get document error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to fetch document: ${error.message}`);
    }
    return data;
  }

  static async updateDocument(documentId: string, updates: DocumentUpdate): Promise<Document> {
    if (!isValidUUID(documentId)) {
      throw new Error('Invalid document ID format');
    }

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
      throw new Error(`Failed to update document: ${error.message}`);
    }
    return data;
  }

  static async deleteDocument(documentId: string): Promise<void> {
    if (!isValidUUID(documentId)) {
      throw new Error('Invalid document ID format');
    }

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
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  static async uploadDocumentFile(documentId: string, file: File): Promise<string> {
    try {
      if (!isValidUUID(documentId)) {
        throw new Error('Invalid document ID format');
      }

      if (!file || file.size === 0 || file.type !== 'application/pdf') {
        throw new Error('Invalid file: Must be a non-empty PDF');
      }

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
        throw new Error('User does not have permission to upload to this document');
      }

      const filePath = `${user.id}/documents/${documentId}/${uuidv4()}.pdf`;

      const { error: uploadError } = await authSupabase.storage
        .from('documents')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      const { data: urlData } = authSupabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to generate public URL for the uploaded file');
      }

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
      console.error('Error in uploadDocumentFile:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to upload document file: ${error.message}`);
    }
  }

  static async generateAndUploadUpdatedPDF(
    documentId: string,
    originalFileUrl: string,
    fields: SignatureField[],
    fieldValues: Record<string, string>,
    token?: string
  ): Promise<string> {
    try {
      const authSupabase = token ? supabase : await getAuthenticatedClient();
      if (!isValidUUID(documentId)) {
        throw new Error('Invalid document ID format');
      }

      let ownerId: string | null = null;
      if (token) {
        const recipient = await this.getRecipientByToken(token);
        if (!recipient || recipient.document_id !== documentId) {
          throw new Error('Invalid or expired signing token');
        }
        const { data: document } = await authSupabase
          .from('documents')
          .select('owner_id')
          .eq('id', documentId)
          .single();
        if (!document) throw new Error('Document not found');
        ownerId = document.owner_id;
      } else {
        const { data: document } = await authSupabase
          .from('documents')
          .select('owner_id')
          .eq('id', documentId)
          .single();
        if (!document) throw new Error('Document not found');
        const { data: { user } } = await authSupabase.auth.getUser();
        if (!user || document.owner_id !== user.id) {
          throw new Error('User does not have permission to update this document');
        }
        ownerId = user.id;
      }

      const response = await fetch(originalFileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }
      const pdfBytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      for (const field of fields) {
        const value = fieldValues[field.id];
        if (!value) continue;

        const page = pages[field.page_number - 1];
        if (!page) continue;
        const { width: pageWidth, height: pageHeight } = page.getSize();

        if (field.field_type === 'signature') {
          const imgBytes = await fetch(value).then((res) => {
            if (!res.ok) throw new Error(`Failed to fetch signature image: ${res.statusText}`);
            return res.arrayBuffer();
          });
          let img;
          try {
            img = await pdfDoc.embedPng(imgBytes);
          } catch (e) {
            img = await pdfDoc.embedJpg(imgBytes);
          }
          const imgDims = img.scaleToFit(field.width, field.height);
          page.drawImage(img, {
            x: field.x_position,
            y: pageHeight - field.y_position - field.height,
            width: imgDims.width,
            height: imgDims.height,
          });
        } else {
          page.drawText(value, {
            x: field.x_position,
            y: pageHeight - field.y_position - field.height,
            size: 12,
            color: rgb(0, 0, 0),
          });
        }
      }

      const pdfBytesUpdated = await pdfDoc.save();
      return await this.uploadModifiedDocument(documentId, pdfBytesUpdated, ownerId, token);
    } catch (error: any) {
      console.error('Error in generateAndUploadUpdatedPDF:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to generate and upload updated PDF: ${error.message}`);
    }
  }

  static async uploadModifiedDocument(
    documentId: string,
    pdfBytes: Uint8Array,
    ownerId: string,
    token?: string
  ): Promise<string> {
    const authSupabase = token ? supabase : await getAuthenticatedClient();

    if (!isValidUUID(documentId)) {
      throw new Error('Invalid document ID format');
    }

    if (!ownerId) {
      throw new Error('Owner ID is required to upload documents');
    }

    const filePath = `${ownerId}/documents/${documentId}/${uuidv4()}.pdf`;
    const file = new File([pdfBytes], 'signed-document.pdf', { type: 'application/pdf' });

    const { error: uploadError } = await authSupabase.storage
      .from('documents')
      .upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Upload error:', JSON.stringify(uploadError, null, 2));
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    const { data: urlData } = authSupabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to generate public URL for the uploaded file');
    }

    const { error: updateError } = await authSupabase
      .from('documents')
      .update({
        file_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Update document error:', JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    return urlData.publicUrl;
  }

  static async addRecipients(recipients: RecipientInsert[]): Promise<Recipient[]> {
    const authSupabase = await getAuthenticatedClient();
    const documentIds = [...new Set(recipients.map(r => r.document_id))];

    for (const documentId of documentIds) {
      if (!isValidUUID(documentId)) {
        throw new Error(`Invalid document ID: ${documentId}`);
      }

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
      throw new Error(`Failed to add recipients: ${error.message}`);
    }
    return data || [];
  }

  static async getRecipients(documentId: string): Promise<Recipient[]> {
    if (!isValidUUID(documentId)) {
      throw new Error('Invalid document ID format');
    }

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
      throw new Error(`Failed to fetch recipients: ${error.message}`);
    }
    return data || [];
  }

  static async getRecipientByToken(token: string): Promise<Recipient | null> {
    if (!token) {
      console.error('Token is required');
      return null;
    }

    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .eq('signing_url_token', token)
      .gt('token_expiry', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.warn('No recipient found for token:', token);
        return null;
      }
      console.error('Get recipient by token error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to fetch recipient: ${error.message}`);
    }
    return data;
  }

  static async updateRecipientStatus(recipientId: string, status: 'pending' | 'viewed' | 'signed'): Promise<void> {
    if (!isValidUUID(recipientId)) {
      throw new Error('Invalid recipient ID format');
    }

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
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', recipientId);

    if (error) {
      console.error('Update recipient status error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to update recipient status: ${error.message}`);
    }
  }

  static async saveSignatureFields(fields: SignatureFieldInsert[]): Promise<SignatureField[]> {
    try {
      const authSupabase = await getAuthenticatedClient();
      const documentIds = [...new Set(fields.map(f => f.document_id))];

      for (const documentId of documentIds) {
        if (!isValidUUID(documentId)) {
          throw new Error(`Invalid document ID: ${documentId}`);
        }

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

      const { data, error } = await authSupabase
        .from('signature_fields')
        .insert(fields)
        .select();

      if (error) {
        console.error('Save signature fields error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to save signature fields: ${error.message}`);
      }

      return data?.map(field => ({
        ...field,
        signature_data: field.signature_data || null
      })) || [];
    } catch (error: any) {
      console.error('Unexpected error in saveSignatureFields:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to save signature fields: ${error.message || 'Unknown error'}`);
    }
  }

  static async saveFieldValue(
    documentId: string,
    fieldId: string,
    signatureData: string,
    token?: string
  ): Promise<void> {
    return this.saveSignatureForField(documentId, fieldId, signatureData, token);
  }

  static async saveSignatureForField(
    documentId: string,
    fieldId: string,
    signatureData: string,
    token?: string
  ): Promise<void> {
    try {
      const authSupabase = token ? supabase : await getAuthenticatedClient();

      if (!isValidUUID(documentId)) {
        throw new Error('Invalid document ID format');
      }

      if (!isValidUUID(fieldId)) {
        throw new Error('Invalid field ID format');
      }

      if (token) {
        const recipient = await this.getRecipientByToken(token);
        if (!recipient || recipient.document_id !== documentId) {
          throw new Error('Invalid or expired signing token');
        }
      } else {
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
      }

      const { error } = await authSupabase
        .from('signature_fields')
        .update({ signature_data: signatureData })
        .eq('id', fieldId)
        .eq('document_id', documentId);

      if (error) {
        console.error('Save signature error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to save signature: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in saveSignatureForField:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to save signature: ${error.message}`);
    }
  }

  static async getSignatureFields(documentId: string): Promise<SignatureField[]> {
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    if (!isValidUUID(documentId)) {
      throw new Error('Invalid document ID format');
    }

    try {
      const authSupabase = await getAuthenticatedClient();
      const { data: { user } } = await authSupabase.auth.getUser();
      if (!user) {
        throw new Error('User must be authenticated to view signature fields');
      }

      const { data, error } = await authSupabase
        .from('signature_fields')
        .select('*')
        .eq('document_id', documentId);

      if (error) {
        console.error('Get signature fields error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to fetch signature fields: ${error.message}`);
      }

      return data?.map(field => ({
        ...field,
        signature_data: field.signature_data || null
      })) || [];
    } catch (error: any) {
      console.error('Error in getSignatureFields:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to retrieve signature fields: ${error.message || 'Unknown error'}`);
    }
  }

  static async logAccess(log: AccessLog): Promise<void> {
    if (!isValidUUID(log.document_id)) {
      throw new Error('Invalid document ID format');
    }

    const { error } = await supabase
      .from('access_logs')
      .insert({
        ...log,
        timestamp: new Date().toISOString(),
      });

    if (error) {
      console.error('Log access error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to log access: ${error.message}`);
    }
  }

  static async getAccessLogs(documentId: string): Promise<any[]> {
    if (!isValidUUID(documentId)) {
      throw new Error('Invalid document ID format');
    }

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
      throw new Error(`Failed to fetch access logs: ${error.message}`);
    }
    return data || [];
  }

  static async getDocumentsWithDetails(userId: string): Promise<any[]> {
    if (!isValidUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

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
          signatures (*)
        ),
        signature_fields (
          id,
          document_id,
          signature_data
        )
      `)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get documents with details error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to fetch documents with details: ${error.message}`);
    }
    return data || [];
  }

  static async getDocumentForSigning(documentId: string, token: string): Promise<{
    document: Document;
    recipient: Recipient;
    fields: SignatureField[];
  } | null> {
    try {
      if (!isValidUUID(documentId)) {
        console.error('Invalid document ID format:', documentId);
        throw new Error('Invalid document ID format');
      }

      if (!token) {
        console.error('Token is required');
        throw new Error('Token is required');
      }

      // Fetch recipient to verify token
      const { data: recipientData, error: recipientError } = await supabase
        .from('recipients')
        .select('*')
        .eq('signing_url_token', token)
        .gt('token_expiry', new Date().toISOString())
        .single();

      if (recipientError || !recipientData) {
        console.error('Error fetching recipient:', JSON.stringify(recipientError, null, 2));
        throw new Error(recipientError?.message || 'Invalid or expired token');
      }

      const recipient = recipientData as Recipient;
      if (recipient.document_id !== documentId) {
        console.error('Recipient document_id does not match:', {
          recipientDocumentId: recipient.document_id,
          providedDocumentId: documentId,
        });
        throw new Error('Document ID does not match recipient');
      }

      // Fetch document using database function
      const { data: documentData, error: documentError } = await supabase
        .rpc('get_document_for_signing_v2', { p_document_id: documentId, p_token: token });

      if (documentError || !documentData) {
        console.error('Error fetching document:', JSON.stringify(documentError, null, 2));
        throw new Error(documentError?.message || 'Document not found');
      }

      const document = documentData as Document;
      if (!document.file_url) {
        console.error('Document missing file_url:', documentId);
        throw new Error('Document missing file URL');
      }

      // Fetch signature fields using database function
      const { data: fieldsData, error: fieldsError } = await supabase
        .rpc('get_signature_fields_for_signing_v2', { p_document_id: documentId, p_token: token });

      if (fieldsError) {
        console.error('Error fetching signature fields:', JSON.stringify(fieldsError, null, 2));
        throw new Error(`Failed to fetch signature fields: ${fieldsError.message}`);
      }

      const fields = fieldsData ? (fieldsData as SignatureField[]) : [];

      return {
        document,
        recipient,
        fields: fields.map(field => ({
          ...field,
          signature_data: field.signature_data || null,
        })),
      };
    } catch (error: any) {
      console.error('Error in getDocumentForSigning:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch document for signing: ${error.message || 'Unknown error'}`);
    }
  }

  static async updateRecipientStatusWithToken(token: string, status: 'pending' | 'viewed' | 'signed'): Promise<void> {
    if (!token) {
      throw new Error('Token is required');
    }

    const { error } = await supabase.rpc('update_recipient_status_v2', { p_token: token, p_status: status });

    if (error) {
      console.error('Update recipient status error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to update recipient status: ${error.message}`);
    }
  }

  static async logAccessWithToken(token: string, action: string, ip_address: string, user_agent: string, location: string): Promise<void> {
    if (!token) {
      throw new Error('Token is required');
    }

    const { error } = await supabase.rpc('log_access_for_signing_v2', {
      p_token: token,
      p_action: action,
      p_ip_address: ip_address,
      p_user_agent: user_agent,
      p_location: location,
    });

    if (error) {
      console.error('Log access error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to log access: ${error.message}`);
    }
  }
}