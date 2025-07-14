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
    recipientEmail: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const memoizedFields = useMemo(() => documentData?.fields || [], [documentData?.fields]);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!documentId || !token || !isValidUUID(documentId)) {
        console.error('Invalid document ID or token:', { documentId, token });
        setError('Invalid document ID or token');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await DocumentService.getDocumentForSigning(documentId, token);
        if (!result) {
          throw new Error('Document not found or invalid token');
        }
        if (!result.document.file_url) {
          throw new Error('Document missing file URL');
        }
        setDocumentData({
          fileUrl: result.document.file_url,
          id: result.document.id,
          fields: result.fields.map(field => ({
            ...field,
            signature_data: field.signature_data || null,
          })),
          recipientEmail: result.recipient.email,
        });
        await DocumentService.logAccessWithToken(token, 'document_viewed', 'unknown', navigator.userAgent, 'unknown');
        await DocumentService.updateRecipientStatusWithToken(token, 'viewed');
      } catch (err: any) {
        console.error('Error fetching document:', JSON.stringify({ message: err.message, stack: err.stack }, null, 2));
        if (err.message.includes('Invalid or expired token')) {
          setError('The signing link is invalid or has expired. Please request a new link.');
        } else if (err.message.includes('Document not found')) {
          setError('The requested document could not be found.');
        } else if (err.message.includes('Document missing file URL')) {
          setError('The document is missing a valid file URL. Please contact support.');
        } else {
          setError(`Failed to load document: ${err.message || 'Unknown error'}`);
        }
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
        await DocumentService.updateRecipientStatusWithToken(token, 'signed');
        await DocumentService.logAccessWithToken(token, 'document_signed', 'unknown', navigator.userAgent, 'unknown');
        setDocumentData((prev) => {
          if (!prev) return prev;
          return { ...prev, fileUrl: newFileUrl };
        });
      } catch (err: any) {
        console.error('Error updating document:', JSON.stringify({ message: err.message, stack: err.stack }, null, 2));
        setError(`Failed to update document: ${err.message || 'Unknown error'}`);
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
      documentId={documentId}
      recipientToken={token}
      recipientEmail={documentData.recipientEmail}
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