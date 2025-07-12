import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DocumentService } from '../services/documentService';
import DocumentViewer from './DocumentViewer';
import { X } from 'lucide-react';

interface SignatureField {
  id: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  page_number: number;
  field_type: 'signature' | 'text' | 'date';
  label: string;
  required: boolean;
  assigned_to?: string | null;
  defaultValue?: string | null;
  signature_data?: string | null;
}

const isValidUUID = (uuid: string | undefined): boolean => {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const DocumentSign: React.FC = () => {
  const { documentId, token } = useParams<{ documentId: string; token: string }>();
  const [documentData, setDocumentData] = useState<{
    fileUrl: string;
    id: string;
    fields: SignatureField[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Memoize fields to prevent unnecessary re-renders
  const memoizedFields = useMemo(() => documentData?.fields || [], [documentData?.fields]);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!documentId || !token || !isValidUUID(documentId) || !isValidUUID(token)) {
        setError('Invalid document ID or token');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await DocumentService.getDocumentForSigning(documentId, token);
        if (!result || !result.document.file_url) {
          throw new Error('Document not found or invalid token');
        }
        const unsignedFields = (result.fields || []).filter((field) => !field.signature_data);
        setDocumentData({
          fileUrl: result.document.file_url,
          id: result.document.id,
          fields: unsignedFields,
        });
        await DocumentService.logAccess({
          document_id: documentId,
          recipient_id: result.recipient.id,
          action: 'document_viewed',
          ip_address: 'unknown',
          user_agent: navigator.userAgent,
          location: 'unknown',
        });
        await DocumentService.updateRecipientStatus(result.recipient.id, 'viewed');
      } catch (err: any) {
        console.error('Error fetching document:', err);
        setError(err.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId, token]);

  const handleDocumentUpdated = useCallback(
    async (newFileUrl: string, fieldValues: Record<string, string>) => {
      if (!documentData || !token || !isValidUUID(documentId)) {
        setError('Invalid document ID or token');
        return;
      }

      try {
        const recipient = await DocumentService.getRecipientByToken(token);
        if (recipient) {
          await DocumentService.updateRecipientStatus(recipient.id, 'signed');
          await DocumentService.logAccess({
            document_id: documentId!,
            recipient_id: recipient.id,
            action: 'document_signed',
            ip_address: 'unknown',
            user_agent: navigator.userAgent,
            location: 'unknown',
          });
        }
        setDocumentData((prev) => {
          if (!prev) return prev;
          const updatedFields = prev.fields.filter((field) => !fieldValues[field.id]);
          return { ...prev, fileUrl: newFileUrl, fields: updatedFields };
        });
      } catch (err: any) {
        console.error('Error updating document:', err);
        setError('Failed to update document');
      }
    },
    [documentData, token, documentId]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !documentData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error || 'Document not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <DocumentViewer
      key={documentData.id}
      fileUrl={documentData.fileUrl}
      documentId={documentData.id}
      recipientToken={token}
      fields={memoizedFields}
      onClose={() => window.close()}
      onDocumentUpdated={handleDocumentUpdated}
      isSigningEnabled={true}
      isFieldsDraggable={false}
      heading="Sign Document"
    />
  );
};

export default DocumentSign;