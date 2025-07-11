import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, PenLine, Type, Image, Save, Calendar, TextCursorInput } from 'lucide-react';
import { DocumentService } from '../services/documentService';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

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

interface DocumentViewerProps {
  fileUrl: string;
  documentId: string;
  onClose: () => void;
  recipientToken?: string;
  onDocumentUpdated?: (newFileUrl: string) => void;
}

const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  fileUrl,
  documentId,
  onClose,
  recipientToken,
  onDocumentUpdated,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<SignatureField | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [editorValue, setEditorValue] = useState('');
  const [signatureType, setSignatureType] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);
  const [savingField, setSavingField] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [renderedPageSize, setRenderedPageSize] = useState<{ width: number; height: number } | null>(null);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const signatureCanvasRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (!documentId || !isValidUUID(documentId)) {
      const errorMsg = !documentId ? 'Document ID is missing' : `Invalid document ID format: ${documentId}`;
      console.warn('[DocumentViewer] Invalid document ID:', errorMsg);
      setFieldsError(errorMsg);
      setSignatureFields([]);
      setLoadingFields(false);
      return;
    }

    const loadSignatureFields = async () => {
      try {
        console.log('[DocumentViewer] Loading signature fields for document:', documentId);
        setLoadingFields(true);
        setFieldsError(null);
        const fields = await DocumentService.getSignatureFields(documentId);
        console.log('[DocumentViewer] Loaded signature fields:', fields);
        setSignatureFields(fields);
        const initialValues: Record<string, string> = {};
        fields.forEach((field) => {
          initialValues[field.id] = field.signature_data || '';
        });
        setFieldValues(initialValues);
      } catch (error: any) {
        const errMsg = error.message || 'Failed to load signature fields';
        console.error('[DocumentViewer] Error loading fields:', errMsg);
        setFieldsError(errMsg);
      } finally {
        setLoadingFields(false);
      }
    };

    loadSignatureFields();
  }, [documentId]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('[DocumentViewer] Document loaded successfully, pages:', numPages);
    setNumPages(numPages);
    setDocumentLoaded(true);
    setDocumentError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('[DocumentViewer] Error loading PDF:', error);
    setDocumentError('Failed to load PDF document.');
    setDocumentLoaded(false);
  };

  const handlePageRenderSuccess = (page: any) => {
    console.log('[DocumentViewer] Page rendered:', page);
    setPageDimensions({
      width: page._pageInfo.view[2],
      height: page._pageInfo.view[3],
    });
    setRenderedPageSize({
      width: page.width,
      height: page.height,
    });
  };

  const handleFieldClick = (field: SignatureField) => {
    if (!isValidUUID(documentId)) {
      alert(`Cannot interact with fields: Invalid document ID (${documentId})`);
      return;
    }
    setActiveField(field);
    setEditorValue(fieldValues[field.id] || '');
    setShowFieldEditor(true);
    setSignatureType('draw');
    setTypedSignature('');
    setUploadedSignature(null);
  };

  const handleFieldMouseDown = (event: React.MouseEvent, fieldId: string) => {
    if (!isValidUUID(documentId)) return;
    
    event.stopPropagation();
    setSelectedFieldId(fieldId);
    setIsDragging(true);
    const field = signatureFields.find((f) => f.id === fieldId);
    if (field && pageRef.current) {
      const rect = pageRef.current.getBoundingClientRect();
      setDragOffset({
        x: event.clientX - rect.left - field.x_position,
        y: event.clientY - rect.top - field.y_position,
      });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !selectedFieldId || !pageRef.current || !pageDimensions || !renderedPageSize) return;

    const pageRect = pageRef.current.getBoundingClientRect();
    const newX = event.clientX - pageRect.left - dragOffset.x;
    const newY = event.clientY - pageRect.top - dragOffset.y;
    
    // Calculate original coordinates based on rendered scale
    const scaleX = renderedPageSize.width / pageDimensions.width;
    const scaleY = renderedPageSize.height / pageDimensions.height;
    const originalX = newX / scaleX;
    const originalY = newY / scaleY;

    setSignatureFields((prev) =>
      prev.map((field) =>
        field.id === selectedFieldId
          ? { 
              ...field, 
              x_position: Math.max(0, originalX),
              y_position: Math.max(0, originalY)
            }
          : field
      )
    );
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const clearSignature = () => {
    if (signatureCanvasRef.current) {
      signatureCanvasRef.current.clear();
    }
    setTypedSignature('');
    setUploadedSignature(null);
    setEditorValue('');
  };

  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedSignature(e.target?.result as string);
        setEditorValue(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveFieldValue = async () => {
    if (!activeField || !isValidUUID(documentId)) {
      if (!isValidUUID(documentId)) {
        alert(`Cannot save field: Invalid document ID (${documentId})`);
      }
      return;
    }
    setSavingField(true);
    try {
      let value = editorValue;
      if (activeField.field_type === 'signature') {
        switch (signatureType) {
          case 'draw':
            if (signatureCanvasRef.current) {
              value = signatureCanvasRef.current.getTrimmedCanvas().toDataURL();
            }
            break;
          case 'type':
            if (typedSignature) {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = 300;
              canvas.height = 100;
              if (ctx) {
                ctx.font = '40px "Dancing Script", cursive';
                ctx.fillStyle = 'black';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.fillText(typedSignature, canvas.width / 2, canvas.height / 2);
                value = canvas.toDataURL();
              }
            }
            break;
          case 'upload':
            if (uploadedSignature) {
              value = uploadedSignature;
            }
            break;
        }
      }
      if (value) {
        setFieldValues((prev) => ({
          ...prev,
          [activeField.id]: value,
        }));
        await DocumentService.saveFieldValue(documentId, activeField.id, value, recipientToken);
        setShowFieldEditor(false);
        setActiveField(null);
        setEditorValue('');
      }
    } catch (error: any) {
      console.error('[DocumentViewer] Error saving field value:', error);
      alert('Failed to save field value. Please try again.');
    } finally {
      setSavingField(false);
    }
  };

  const saveUpdatedDocument = async () => {
    if (!isValidUUID(documentId) || !fileUrl) {
      alert('Cannot save document: Invalid document ID or file URL');
      return;
    }
    setSavingDocument(true);
    try {
      const updatedFileUrl = await DocumentService.generateAndUploadUpdatedPDF(
        documentId,
        fileUrl,
        signatureFields,
        fieldValues,
        recipientToken
      );
      alert('Document updated successfully!');
      if (onDocumentUpdated) {
        onDocumentUpdated(updatedFileUrl);
      }
    } catch (error: any) {
      console.error('[DocumentViewer] Error saving updated PDF:', error);
      alert('Failed to save updated PDF. Please try again.');
    } finally {
      setSavingDocument(false);
    }
  };

  const renderFieldContent = (field: SignatureField) => {
    const value = fieldValues[field.id] || '';
    switch (field.field_type) {
      case 'signature':
        return value ? (
          <img src={value} alt="Signature" className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <PenLine className="w-5 h-5 mb-1 text-blue-600" />
            <span className="text-xs">Click to sign</span>
          </div>
        );
      case 'text':
        return value ? (
          <div className="p-1 text-sm overflow-hidden text-ellipsis">{value}</div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <TextCursorInput className="w-5 h-5 mb-1 text-blue-600" />
            <span className="text-xs">Click to enter text</span>
          </div>
        );
      case 'date':
        return value ? (
          <div className="p-1 text-sm">{value}</div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Calendar className="w-5 h-5 mb-1 text-blue-600" />
            <span className="text-xs">Click to select date</span>
          </div>
        );
      default:
        return null;
    }
  };

  // Calculate field positions based on rendered page scale
  const calculateFieldPosition = (field: SignatureField) => {
    if (!pageDimensions || !renderedPageSize) return { x: 0, y: 0, width: 0, height: 0 };
    
    const scaleX = renderedPageSize.width / pageDimensions.width;
    const scaleY = renderedPageSize.height / pageDimensions.height;
    
    return {
      x: field.x_position * scaleX,
      y: field.y_position * scaleY,
      width: field.width * scaleX,
      height: field.height * scaleY
    };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Document Editor</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={saveUpdatedDocument}
              disabled={savingDocument || !isValidUUID(documentId)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 disabled:opacity-75"
            >
              {savingDocument ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving Document...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Document</span>
                </>
              )}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
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
            <div className="text-sm text-gray-600">
              Click fields to edit or drag to move
            </div>
          </div>
        )}
        <div 
          className="flex-1 overflow-auto bg-gray-100 p-8"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div className="max-w-4xl mx-auto">
            <div 
              ref={pageRef} 
              className="relative bg-white shadow-lg min-h-[600px]"
              style={{ cursor: isDragging ? 'grabbing' : 'default' }}
            >
              {documentError ? (
                <div className="flex items-center justify-center h-96 text-red-600 p-8">
                  <div className="text-center">
                    <X className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">Document Error</p>
                    <p className="text-sm">{documentError}</p>
                  </div>
                </div>
              ) : fileUrl ? (
                <>
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
                      onRenderSuccess={handlePageRenderSuccess}
                      loading={
                        <div className="flex items-center justify-center h-96">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      }
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                  
                  {/* Signature fields overlay */}
                  {documentLoaded && pageDimensions && renderedPageSize && (
                    signatureFields
                      .filter((field) => field.page_number === currentPage)
                      .map((field) => {
                        const { x, y, width, height } = calculateFieldPosition(field);
                        
                        return (
                          <div
                            key={field.id}
                            className={`absolute border-2 flex items-center justify-center text-xs font-medium select-none ${
                              selectedFieldId === field.id
                                ? 'border-blue-500 bg-blue-100 text-blue-700'
                                : 'border-gray-400 bg-gray-100 text-gray-600'
                            }`}
                            style={{
                              left: `${x}px`,
                              top: `${y}px`,
                              width: `${width}px`,
                              height: `${height}px`,
                            }}
                            onClick={() => handleFieldClick(field)}
                            onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                          >
                            {renderFieldContent(field)}
                            {field.required && !fieldValues[field.id] && (
                              <span className="absolute -top-2 -right-2 text-red-500">*</span>
                            )}
                          </div>
                        );
                      })
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  <div className="text-center">
                    <p className="text-lg font-medium mb-2">No Document</p>
                    <p className="text-sm">Document not available</p>
                  </div>
                </div>
              )}
              {loadingFields && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-100 text-blue-700 px-4 py-2 rounded-md flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Loading signature fields...
                </div>
              )}
              {fieldsError && !loadingFields && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {fieldsError}
                </div>
              )}
              {!loadingFields && !fieldsError && signatureFields.length === 0 && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                  {isValidUUID(documentId)
                    ? 'No signature fields found for this document'
                    : 'Invalid document ID format - unable to load fields'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showFieldEditor && activeField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {activeField.field_type === 'signature' && 'Add Your Signature'}
                {activeField.field_type === 'text' && 'Enter Text'}
                {activeField.field_type === 'date' && 'Select Date'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{activeField.label}</p>
            </div>
            <div className="p-6">
              {activeField.field_type === 'signature' ? (
                <>
                  <div className="flex border-b border-gray-200 mb-4">
                    <button
                      className={`flex-1 py-3 font-medium flex items-center justify-center space-x-2 ${
                        signatureType === 'draw' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
                      }`}
                      onClick={() => setSignatureType('draw')}
                    >
                      <PenLine className="w-4 h-4" />
                      <span>Draw</span>
                    </button>
                    <button
                      className={`flex-1 py-3 font-medium flex items-center justify-center space-x-2 ${
                        signatureType === 'type' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
                      }`}
                      onClick={() => setSignatureType('type')}
                    >
                      <Type className="w-4 h-4" />
                      <span>Type</span>
                    </button>
                    <button
                      className={`flex-1 py-3 font-medium flex items-center justify-center space-x-2 ${
                        signatureType === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
                      }`}
                      onClick={() => setSignatureType('upload')}
                    >
                      <Image className="w-4 h-4" />
                      <span>Upload</span>
                    </button>
                  </div>
                  <div className="mb-6">
                    {signatureType === 'draw' && (
                      <div className="border border-gray-300 rounded-lg h-64">
                        <SignatureCanvas
                          ref={signatureCanvasRef}
                          canvasProps={{
                            className: 'w-full h-full bg-white',
                          }}
                        />
                      </div>
                    )}
                    {signatureType === 'type' && (
                      <div>
                        <input
                          type="text"
                          placeholder="Type your name"
                          value={typedSignature}
                          onChange={(e) => setTypedSignature(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <div className="mt-4 h-48 border border-gray-300 rounded-lg flex items-center justify-center">
                          <p className="text-3xl font-signature">{typedSignature}</p>
                        </div>
                      </div>
                    )}
                    {signatureType === 'upload' && (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSignatureUpload}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {uploadedSignature && (
                          <div className="mt-4 border border-gray-300 rounded-lg p-4">
                            <img
                              src={uploadedSignature}
                              alt="Uploaded signature"
                              className="max-w-full max-h-48 mx-auto"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : activeField.field_type === 'text' ? (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter text for "{activeField.label}"
                  </label>
                  <textarea
                    value={editorValue}
                    onChange={(e) => setEditorValue(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Enter text here..."
                  />
                </div>
              ) : activeField.field_type === 'date' ? (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select date for "{activeField.label}"
                  </label>
                  <input
                    type="date"
                    value={editorValue}
                    onChange={(e) => setEditorValue(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ) : null}
              <div className="flex justify-between">
                <div>
                  <button
                    onClick={() => {
                      clearSignature();
                      setShowFieldEditor(false);
                      setActiveField(null);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={clearSignature}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Clear
                  </button>
                  <button
                    onClick={saveFieldValue}
                    disabled={savingField || !isValidUUID(documentId)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-75"
                  >
                    {savingField ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;