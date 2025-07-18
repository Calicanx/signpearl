import { supabase, getAuthenticatedClient } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, rgb } from 'pdf-lib';

type Document = Database['public']['Tables']['documents']['Row'] & {
  recipients?: Array<
    Database['public']['Tables']['recipients']['Row'] & {
      signatures?: Array<{
        id: string;
        recipient_id: string;
        signed_at: string;
      }> | null;
    }
  >;
  signature_fields?: Array<
    Database['public']['Tables']['signature_fields']['Row'] & {
      signature_data: string | null;
    }
  >;
};
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type DocumentUpdate = Database['public']['Tables']['documents']['Update'];
type Recipient = Database['public']['Tables']['recipients']['Row'];
type RecipientInsert = Database['public']['Tables']['recipients']['Insert'];
type SignatureField = Database['public']['Tables']['signature_fields']['Row'] & {
  signature_data: string | null;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  page_number: number;
  field_type: 'signature' | 'text' | 'date' | 'name' | 'email' | 'phone' | 'custom';
  label: string;
  required: boolean;
  assigned_to?: string | null;
  defaultValue?: string | null;
};
type SignatureFieldInsert = Database['public']['Tables']['signature_fields']['Insert'];
type AccessLog = Database['public']['Tables']['access_logs']['Insert'];

const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export class DocumentService {
  static async createDocument(document: DocumentInsert): Promise<Document> {
    try {
      const authSupabase = await getAuthenticatedClient();
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user) {
        console.error('Authentication error in createDocument:', JSON.stringify(userError, null, 2));
        throw new Error('User must be authenticated to create a document');
      }
      const documentWithOwner = {
        ...document,
        owner_id: user.id,
        is_template: document.is_template ?? false,
      };

      const { data, error } = await authSupabase
        .from('documents')
        .insert(documentWithOwner)
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
            *,
            signature_data
          )
        `)
        .single();

      if (error) {
        console.error('Create document error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to create document: ${error.message}`);
      }
      if (!data) {
        throw new Error('No data returned from document creation');
      }
      return data;
    } catch (error: any) {
      console.error('Unexpected error in createDocument:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to create document: ${error.message || 'Unknown error'}`);
    }
  }

  static async getDocuments(userId: string): Promise<Document[]> {
    try {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }

      const authSupabase = await this.getVerifiedClient();
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || user.id !== userId) {
        console.error('Authentication error in getDocuments:', JSON.stringify(userError, null, 2));
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
            *,
            signature_data
          )
        `)
        .eq('owner_id', userId)
        .eq('is_template', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get documents error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to fetch documents: ${error.message}`);
      }
      return data || [];
    } catch (error: any) {
      console.error('Unexpected error in getDocuments:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch documents: ${error.message || 'Unknown error'}`);
    }
  }

  static async getDocumentsWithDetails(
    userId: string,
    searchTerm: string = '',
    page: number = 1,
    pageSize: number = 20
  ): Promise<Document[]> {
    try {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }
  
      const authSupabase = await this.getVerifiedClient();
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || user.id !== userId) {
        console.error('Authentication error in getDocumentsWithDetails:', JSON.stringify(userError, null, 2));
        throw new Error('User does not have permission to view these documents');
      }
  
      const { data, error } = await authSupabase
        .from('documents')
        .select(`
          id,
          title,
          owner_id,
          status,
          file_url,
          created_at,
          updated_at,
          recipients (
            id,
            email,
            name,
            status,
            signing_url_token
          ),
          signature_fields (
            id,
            document_id,
            signature_data
          )
        `)
        .eq('owner_id', userId)
        .eq('is_template', false)
        .ilike('title', `%${searchTerm}%`)
        .range((page - 1) * pageSize, page * pageSize - 1)
        .order('created_at', { ascending: false });
  
      if (error) {
        console.error('Get documents with details error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to fetch documents with details: ${error.message}`);
      }
      return data || [];
    } catch (error: any) {
      console.error('Unexpected error in getDocumentsWithDetails:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch documents with details: ${error.message || 'Unknown error'}`);
    }
  }

  static async getSentDocuments(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<Document[]> {
    try {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }

      const authSupabase = await this.getVerifiedClient();
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || user.id !== userId) {
        console.error('Authentication error in getSentDocuments:', JSON.stringify(userError, null, 2));
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
          ),
          signature_fields (
            *,
            signature_data
          )
        `)
        .eq('owner_id', userId)
        .in('status', ['sent', 'signed', 'completed'])
        .eq('is_template', false)
        .range((page - 1) * pageSize, page * pageSize - 1)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Get sent documents error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to fetch sent documents: ${error.message}`);
      }
      return data || [];
    } catch (error: any) {
      console.error('Unexpected error in getSentDocuments:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch sent documents: ${error.message || 'Unknown error'}`);
    }
  }

  static async getMyTemplates(userId: string): Promise<Document[]> {
    try {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }

      const authSupabase = await this.getVerifiedClient();
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || user.id !== userId) {
        console.error('Authentication error in getMyTemplates:', JSON.stringify(userError, null, 2));
        throw new Error('User does not have permission to view templates');
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
            *,
            signature_data
          )
        `)
        .eq('owner_id', userId)
        .eq('is_template', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get templates error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to fetch templates: ${error.message}`);
      }
      return data || [];
    } catch (error: any) {
      console.error('Unexpected error in getMyTemplates:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch templates: ${error.message || 'Unknown error'}`);
    }
  }

  static async getMyTemplatesWithFields(userId: string): Promise<Document[]> {
    try {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }
  
      const authSupabase = await this.getVerifiedClient();
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || user.id !== userId) {
        console.error('Authentication error in getMyTemplatesWithFields:', JSON.stringify(userError, null, 2));
        throw new Error('User does not have permission to view templates');
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
            signature_data,
            x_position,
            y_position,
            width,
            height,
            page_number,
            field_type,
            label,
            required,
            assigned_to
          ) // Removed 'defaultValue' as it does not exist in the database
        `)
        .eq('owner_id', userId)
        .eq('is_template', true)
        .order('created_at', { ascending: false });
  
      if (error) {
        console.error('Get templates with fields error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to fetch templates with fields: ${error.message}`);
      }
  
      return data?.map(doc => ({
        ...doc,
        signature_fields: doc.signature_fields?.map(field => ({
          ...field,
          signature_data: field.signature_data || null,
          x_position: field.x_position ?? 0,
          y_position: field.y_position ?? 0,
          width: field.width ?? 100,
          height: field.height ?? 50,
          page_number: field.page_number ?? 1,
          field_type: field.field_type ?? 'signature',
          label: field.label ?? '',
          required: field.required ?? false,
          assigned_to: field.assigned_to ?? null,
          defaultValue: null, // Explicitly set to null since it's not fetched
        })) || [],
      })) || [];
    } catch (error: any) {
      console.error('Unexpected error in getMyTemplatesWithFields:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch templates with fields: ${error.message || 'Unknown error'}`);
    }
  }

  static async getDocument(documentId: string): Promise<Document | null> {
    try {
      if (!isValidUUID(documentId)) {
        console.error('Invalid document ID format:', documentId);
        throw new Error('Invalid document ID format');
      }

      const authSupabase = await this.getVerifiedClient();
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user) {
        console.error('Authentication error in getDocument:', JSON.stringify(userError, null, 2));
        throw new Error('User must be authenticated to view this document');
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
            *,
            signature_data
          )
        `)
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
    } catch (error: any) {
      console.error('Unexpected error in getDocument:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch document: ${error.message || 'Unknown error'}`);
    }
  }

  static async updateDocument(documentId: string, updates: DocumentUpdate): Promise<Document> {
    try {
      if (!isValidUUID(documentId)) {
        throw new Error('Invalid document ID format');
      }

      const authSupabase = await this.getVerifiedClient();
      const { data: document, error: docError } = await authSupabase
        .from('documents')
        .select('owner_id')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        console.error('Document validation error:', JSON.stringify(docError, null, 2));
        throw new Error('Document not found');
      }

      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || document.owner_id !== user.id) {
        console.error('Authentication error in updateDocument:', JSON.stringify(userError, null, 2));
        throw new Error('User does not have permission to update this document');
      }

      const { data, error } = await authSupabase
        .from('documents')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', documentId)
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
            *,
            signature_data
          )
        `)
        .single();

      if (error) {
        console.error('Update document error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to update document: ${error.message}`);
      }
      if (!data) {
        throw new Error('No data returned from document update');
      }
      return data;
    } catch (error: any) {
      console.error('Unexpected error in updateDocument:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to update document: ${error.message || 'Unknown error'}`);
    }
  }

  static async deleteDocument(documentId: string): Promise<void> {
    try {
      if (!isValidUUID(documentId)) {
        throw new Error('Invalid document ID format');
      }
  
      const authSupabase = await this.getVerifiedClient();
      const { data: document, error: docError } = await authSupabase
        .from('documents')
        .select('owner_id')
        .eq('id', documentId)
        .single();
  
      if (docError || !document) {
        console.error('Document validation error:', JSON.stringify(docError, null, 2));
        throw new Error('Document not found');
      }
  
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || document.owner_id !== user.id) {
        console.error('Authentication error in deleteDocument:', JSON.stringify(userError, null, 2));
        throw new Error('User does not have permission to delete this document');
      }
  
      // Get recipient IDs for this document
      const { data: recipientIdsData, error: recipientIdsError } = await authSupabase
        .from('recipients')
        .select('id')
        .eq('document_id', documentId);
  
      if (recipientIdsError) {
        console.error('Error fetching recipient IDs:', JSON.stringify(recipientIdsError, null, 2));
        throw new Error('Failed to fetch recipient IDs');
      }
  
      const recipientIds = recipientIdsData?.map(r => r.id) || [];
      // Delete signatures related to recipients
      await authSupabase
        .from('signatures')
        .delete()
        .in('recipient_id', recipientIds);
  
      // Delete recipients for this document
      await authSupabase
        .from('recipients')
        .delete()
        .eq('document_id', documentId);
  
      // Delete signature fields for this document
      await authSupabase
        .from('signature_fields')
        .delete()
        .eq('document_id', documentId);
  
      // Finally, delete the document
      const { error: deleteError } = await authSupabase
        .from('documents')
        .delete()
        .eq('id', documentId);
  
      if (deleteError) {
        console.error('Delete document error:', JSON.stringify(deleteError, null, 2));
        throw new Error(`Failed to delete document: ${deleteError.message}`);
      }
    } catch (error: any) {
      console.error('Unexpected error in deleteDocument:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to delete document: ${error.message || 'Unknown error'}`);
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

      const authSupabase = await this.getVerifiedClient();
      const { data: document, error: docError } = await authSupabase
        .from('documents')
        .select('owner_id')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        console.error('Document validation error:', JSON.stringify(docError, null, 2));
        throw new Error('Document not found');
      }

      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || document.owner_id !== user.id) {
        console.error('Authentication error in uploadDocumentFile:', JSON.stringify(userError, null, 2));
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
        .update({ file_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', documentId);

      if (updateError) {
        console.error('Error updating document with file_url:', JSON.stringify(updateError, null, 2));
        throw new Error(`Failed to update document with file_url: ${updateError.message}`);
      }

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error in uploadDocumentFile:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to upload document file: ${error.message || 'Unknown error'}`);
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
      const authSupabase = token ? supabase : await this.getVerifiedClient();
      if (!isValidUUID(documentId)) {
        throw new Error('Invalid document ID format');
      }

      let ownerId: string | null = null;
      if (token) {
        const recipient = await this.getRecipientByToken(token);
        if (!recipient || recipient.document_id !== documentId) {
          throw new Error('Invalid or expired signing token');
        }
        const { data: document, error: docError } = await authSupabase
          .from('documents')
          .select('owner_id')
          .eq('id', documentId)
          .single();
        if (docError || !document) {
          console.error('Document validation error:', JSON.stringify(docError, null, 2));
          throw new Error('Document not found');
        }
        ownerId = document.owner_id;
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
        const { data: { user }, error: userError } = await authSupabase.auth.getUser();
        if (userError || !user || document.owner_id !== user.id) {
          console.error('Authentication error in generateAndUploadUpdatedPDF:', JSON.stringify(userError, null, 2));
          throw new Error('User does not have permission to update this document');
        }
        ownerId = user.id;
      }

      const response = await fetch(originalFileUrl);
      if (!response.ok) {
        console.error('Failed to fetch PDF:', JSON.stringify({ status: response.status, statusText: response.statusText }, null, 2));
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
        const { height: pageHeight } = page.getSize();

        if (field.field_type === 'signature') {
          const imgBytes = await fetch(value).then((res) => {
            if (!res.ok) {
              console.error('Failed to fetch signature image:', JSON.stringify({ status: res.status, statusText: res.statusText }, null, 2));
              throw new Error(`Failed to fetch signature image: ${res.statusText}`);
            }
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
      console.error('Error in generateAndUploadUpdatedPDF:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to generate and upload updated PDF: ${error.message || 'Unknown error'}`);
    }
  }

  static async uploadModifiedDocument(
    documentId: string,
    pdfBytes: Uint8Array,
    ownerId: string,
    token?: string
  ): Promise<string> {
    try {
      const authSupabase = token ? supabase : await this.getVerifiedClient();

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
    } catch (error: any) {
      console.error('Error in uploadModifiedDocument:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to upload modified document: ${error.message || 'Unknown error'}`);
    }
  }

  static async addRecipients(recipients: RecipientInsert[]): Promise<Recipient[]> {
    try {
      const authSupabase = await this.getVerifiedClient();
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

        const { data: { user }, error: userError } = await authSupabase.auth.getUser();
        if (userError || !user || document.owner_id !== user.id) {
          console.error('Authentication error in addRecipients:', JSON.stringify(userError, null, 2));
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
    } catch (error: any) {
      console.error('Unexpected error in addRecipients:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to add recipients: ${error.message || 'Unknown error'}`);
    }
  }

  static async getRecipients(documentId: string): Promise<Recipient[]> {
    try {
      if (!isValidUUID(documentId)) {
        throw new Error('Invalid document ID format');
      }

      const authSupabase = await this.getVerifiedClient();
      const { data: document, error: docError } = await authSupabase
        .from('documents')
        .select('owner_id')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        console.error('Document validation error:', JSON.stringify(docError, null, 2));
        throw new Error('Document not found');
      }

      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || document.owner_id !== user.id) {
        console.error('Authentication error in getRecipients:', JSON.stringify(userError, null, 2));
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
    } catch (error: any) {
      console.error('Unexpected error in getRecipients:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch recipients: ${error.message || 'Unknown error'}`);
    }
  }

  static async getRecipientByToken(token: string): Promise<Recipient | null> {
    try {
      if (!token) {
        console.error('Token is required');
        throw new Error('Token is required');
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
    } catch (error: any) {
      console.error('Unexpected error in getRecipientByToken:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch recipient by token: ${error.message || 'Unknown error'}`);
    }
  }

  static async updateRecipientStatus(recipientId: string, status: 'pending' | 'viewed' | 'signed'): Promise<void> {
    try {
      if (!isValidUUID(recipientId)) {
        throw new Error('Invalid recipient ID format');
      }

      const authSupabase = await this.getVerifiedClient();
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

      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || document.owner_id !== user.id) {
        console.error('Authentication error in updateRecipientStatus:', JSON.stringify(userError, null, 2));
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
    } catch (error: any) {
      console.error('Unexpected error in updateRecipientStatus:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to update recipient status: ${error.message || 'Unknown error'}`);
    }
  }

  static async saveSignatureFields(fields: SignatureFieldInsert[]): Promise<SignatureField[]> {
    try {
      const authSupabase = await this.getVerifiedClient();
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

        const { data: { user }, error: userError } = await authSupabase.auth.getUser();
        if (userError || !user || document.owner_id !== user.id) {
          console.error('Authentication error in saveSignatureFields:', JSON.stringify(userError, null, 2));
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
        signature_data: field.signature_data || null,
        x_position: field.x_position ?? 0,
        y_position: field.y_position ?? 0,
        width: field.width ?? 100,
        height: field.height ?? 50,
        page_number: field.page_number ?? 1,
        field_type: field.field_type ?? 'signature',
        label: field.label ?? '',
        required: field.required ?? false,
        assigned_to: field.assigned_to ?? null,
        defaultValue: field.defaultValue ?? null,
      })) || [];
    } catch (error: any) {
      console.error('Unexpected error in saveSignatureFields:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to save signature fields: ${error.message || 'Unknown error'}`);
    }
  }

  static async saveSignature(
    signature: {
      document_id: string;
      recipient_id: string;
      signature_data: string;
      ip_address: string;
      user_agent: string;
      location: string;
    }
  ): Promise<void> {
    try {
      if (!isValidUUID(signature.document_id)) {
        throw new Error('Invalid document ID format');
      }
      if (!isValidUUID(signature.recipient_id)) {
        throw new Error('Invalid recipient ID format');
      }

      const authSupabase = await this.getVerifiedClient();
      const { data: document, error: docError } = await authSupabase
        .from('documents')
        .select('owner_id')
        .eq('id', signature.document_id)
        .single();

      if (docError || !document) {
        console.error('Document validation error:', JSON.stringify(docError, null, 2));
        throw new Error('Document not found');
      }

      const { data: recipient, error: recError } = await authSupabase
        .from('recipients')
        .select('id')
        .eq('id', signature.recipient_id)
        .eq('document_id', signature.document_id)
        .single();

      if (recError || !recipient) {
        console.error('Recipient validation error:', JSON.stringify(recError, null, 2));
        throw new Error('Recipient not found or does not belong to this document');
      }

      const { error } = await authSupabase
        .from('signatures')
        .insert({
          ...signature,
          signed_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Save signature error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to save signature: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in saveSignature:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to save signature: ${error.message || 'Unknown error'}`);
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
      const authSupabase = token ? supabase : await this.getVerifiedClient();

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

        const { data: { user }, error: userError } = await authSupabase.auth.getUser();
        if (userError || !user || document.owner_id !== user.id) {
          console.error('Authentication error in saveSignatureForField:', JSON.stringify(userError, null, 2));
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
      console.error('Error in saveSignatureForField:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to save signature: ${error.message || 'Unknown error'}`);
    }
  }

  static async getSignatureFields(documentId: string): Promise<SignatureField[]> {
    try {
      if (!documentId) {
        throw new Error('Document ID is required');
      }
  
      if (!isValidUUID(documentId)) {
        throw new Error('Invalid document ID format');
      }
  
      const authSupabase = await this.getVerifiedClient();
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user) {
        console.error('Authentication error in getSignatureFields:', JSON.stringify(userError, null, 2));
        throw new Error('User must be authenticated to view signature fields');
      }
  
      const { data, error } = await authSupabase
        .from('signature_fields')
        .select(`
          id,
          document_id,
          signature_data,
          x_position,
          y_position,
          width,
          height,
          page_number,
          field_type,
          label,
          required,
          assigned_to
        `) // Removed 'defaultValue' as it does not exist in the database
        .eq('document_id', documentId);
  
      if (error) {
        console.error('Get signature fields error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to fetch signature fields: ${error.message}`);
      }
  
      return data?.map(field => ({
        ...field,
        signature_data: field.signature_data || null,
        x_position: field.x_position ?? 0,
        y_position: field.y_position ?? 0,
        width: field.width ?? 100,
        height: field.height ?? 50,
        page_number: field.page_number ?? 1,
        field_type: field.field_type ?? 'signature',
        label: field.label ?? '',
        required: field.required ?? false,
        assigned_to: field.assigned_to ?? null,
        defaultValue: null, // Explicitly set to null since it's not fetched
      })) || [];
    } catch (error: any) {
      console.error('Error in getSignatureFields:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to retrieve signature fields: ${error.message || 'Unknown error'}`);
    }
  }

  static async logAccess(log: AccessLog): Promise<void> {
    try {
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
    } catch (error: any) {
      console.error('Error in logAccess:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to log access: ${error.message || 'Unknown error'}`);
    }
  }

  static async getAccessLogs(documentId: string): Promise<any[]> {
    try {
      if (!isValidUUID(documentId)) {
        throw new Error('Invalid document ID format');
      }

      const authSupabase = await this.getVerifiedClient();
      const { data: document, error: docError } = await authSupabase
        .from('documents')
        .select('owner_id')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        console.error('Document validation error:', JSON.stringify(docError, null, 2));
        throw new Error('Document not found');
      }

      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user || document.owner_id !== user.id) {
        console.error('Authentication error in getAccessLogs:', JSON.stringify(userError, null, 2));
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
    } catch (error: any) {
      console.error('Error in getAccessLogs:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch access logs: ${error.message || 'Unknown error'}`);
    }
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
  
      // Fetch recipient by token
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
  
      // Fetch document
      const { data: documentData, error: documentError } = await supabase
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
            signature_data,
            x_position,
            y_position,
            width,
            height,
            page_number,
            field_type,
            label,
            required,
            assigned_to
          )
        `)
        .eq('id', documentId)
        .single();
  
      if (documentError || !documentData) {
        console.error('Error fetching document:', JSON.stringify(documentError, null, 2));
        throw new Error(documentError?.message || 'Document not found');
      }
  
      const document = documentData as Document;
      if (!document.file_url) {
        console.error('Document missing file_url:', documentId);
        throw new Error('Document missing file URL');
      }
  
      // Map fields to ensure consistent SignatureField type
      const fields = document.signature_fields ? document.signature_fields.map(field => ({
        ...field,
        signature_data: field.signature_data || null,
        x_position: field.x_position ?? 0,
        y_position: field.y_position ?? 0,
        width: field.width ?? 100,
        height: field.height ?? 50,
        page_number: field.page_number ?? 1,
        field_type: field.field_type ?? 'signature',
        label: field.label ?? '',
        required: field.required ?? false,
        assigned_to: field.assigned_to ?? null,
        defaultValue: null, // Explicitly set to null since it doesn't exist in DB
      })) : [];
  
      return {
        document,
        recipient,
        fields,
      };
    } catch (error: any) {
      console.error('Error in getDocumentForSigning:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to fetch document for signing: ${error.message || 'Unknown error'}`);
    }
  }

  static async updateRecipientStatusWithToken(token: string, status: 'pending' | 'viewed' | 'signed'): Promise<void> {
    try {
      if (!token) {
        throw new Error('Token is required');
      }
  
      const { error } = await supabase
        .from('recipients')
        .update({ status }) // Removed updated_at since it doesn't exist
        .eq('signing_url_token', token)
        .gt('token_expiry', new Date().toISOString());
  
      if (error) {
        console.error('Update recipient status error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to update recipient status: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Unexpected error in updateRecipientStatusWithToken:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to update recipient status: ${error.message || 'Unknown error'}`);
    }
  }

  static async logAccessWithToken(token: string, action: string, ip_address: string, user_agent: string, location: string): Promise<void> {
    try {
      if (!token) {
        throw new Error('Token is required');
      }

      const { data: recipient, error: recipientError } = await supabase
        .from('recipients')
        .select('id, document_id')
        .eq('signing_url_token', token)
        .gt('token_expiry', new Date().toISOString())
        .single();

      if (recipientError || !recipient) {
        console.error('Error fetching recipient for logging:', JSON.stringify(recipientError, null, 2));
        throw new Error(`Failed to log access: ${recipientError?.message || 'Invalid or expired token'}`);
      }

      const { error } = await supabase
        .from('access_logs')
        .insert({
          document_id: recipient.document_id,
          recipient_id: recipient.id,
          action,
          ip_address,
          user_agent,
          location,
          timestamp: new Date().toISOString(),
        });

      if (error) {
        console.error('Log access error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to log access: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Unexpected error in logAccessWithToken:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to log access: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Helper method to verify Supabase client and session before making requests.
   */
  private static async getVerifiedClient() {
    try {
      const authSupabase = await getAuthenticatedClient();
      const { data: { session }, error: sessionError } = await authSupabase.auth.getSession();
      if (sessionError || !session) {
        console.error('Session verification failed:', JSON.stringify(sessionError, null, 2));
        throw new Error('No valid session found for authenticated client');
      }
      return authSupabase;
    } catch (error: any) {
      console.error('Error verifying Supabase client:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
      throw new Error(`Failed to verify Supabase client: ${error.message || 'Unknown error'}`);
    }
  }
}