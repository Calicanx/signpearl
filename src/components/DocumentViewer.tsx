// DocumentViewer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X } from 'lucide-react';
import { DocumentService } from '../services/documentService';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// Interface for document viewer props
interface DocumentViewerProps {
  fileUrl: string;
  documentId: string; // Added to fetch signature fields
  onClose: () => void;
}

// Interface for signature fields (reused from DocumentEditor)
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
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ fileUrl, documentId, onClose }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const pageRef = useRef<HTMLDivElement>(null);

  // Fetch signature fields when documentId changes
  useEffect(() => {
    const loadSignatureFields = async () => {
      try {
        const fields = await DocumentService.getSignatureFields(documentId);
        setSignatureFields(fields);
      } catch (error) {
        console.error('Error loading signature fields:', error);
      }
    };
    loadSignatureFields();
  }, [documentId]);

  // Callback for successful PDF loading
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setDocumentLoaded(true);
    setDocumentError(null);
  };

  // Callback for PDF loading errors
  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setDocumentError('Failed to load PDF document.');
    setDocumentLoaded(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Document Viewer</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {numPages > 1 && (
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {numPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                disabled={currentPage >= numPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div className="max-w-4xl mx-auto">
            <div ref={pageRef} className="relative bg-white shadow-lg min-h-[600px]">
              {documentError ? (
                <div className="flex items-center justify-center h-96 text-red-600 p-8">
                  <div className="text-center">
                    <X className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">Document Error</p>
                    <p className="text-sm">{documentError}</p>
                  </div>
                </div>
              ) : fileUrl ? (
                <Document
                  file={fileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  className="w-full"
                  loading={
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading PDF...</p>
                      </div>
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    width={800}
                    className="w-full"
                    loading={
                      <div className="flex items-center justify-center h-96">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    }
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  >
                    {signatureFields
                      .filter((field) => field.page_number === currentPage)
                      .map((field) => (
                        <div
                          key={field.id}
                          className="absolute border border-dashed border-blue-500 bg-blue-100 bg-opacity-30 pointer-events-none"
                          style={{
                            left: `${field.x_position}px`,
                            top: `${field.y_position}px`,
                            width: `${field.width}px`,
                            height: `${field.height}px`,
                          }}
                        >
                          <span className="text-xs text-blue-700 font-medium">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </span>
                        </div>
                      ))}
                  </Page>
                </Document>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  <div className="text-center">
                    <p className="text-lg font-medium mb-2">No Document</p>
                    <p className="text-sm">Document not available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;