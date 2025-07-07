import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Edit3, Calendar, Type, Check, X } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface SignatureField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  type: 'signature' | 'text' | 'date';
  label: string;
  required: boolean;
  value?: string;
  completed?: boolean;
}

interface DocumentData {
  id: string;
  title: string;
  content?: string;
  fileUrl?: string;
  fields: SignatureField[];
  recipient: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

const SigningPage: React.FC = () => {
  const { documentId, recipientId } = useParams<{ documentId: string; recipientId: string }>();
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const signatureCanvasRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    // Log access when page loads
    logAccess('document_viewed');
    
    // Mock document data - in real app, fetch from API
    const mockDocument: DocumentData = {
      id: documentId || '1',
      title: 'Service Agreement - ABC Corp',
      content: `
        <div class="p-8 bg-white min-h-[800px] font-serif">
          <div class="text-center mb-8">
            <h1 class="text-2xl font-bold mb-2">SERVICE AGREEMENT</h1>
            <div class="w-24 h-0.5 bg-gray-400 mx-auto"></div>
          </div>
          
          <div class="space-y-6">
            <div class="grid grid-cols-2 gap-8">
              <div>
                <p class="font-semibold mb-2">Service Provider:</p>
                <div class="border-b border-gray-400 pb-1 mb-4">
                  <span class="bg-yellow-200 px-2 py-1 text-sm">ABC Corporation</span>
                </div>
              </div>
              
              <div>
                <p class="font-semibold mb-2">Client:</p>
                <div class="border-b border-gray-400 pb-1 mb-4">
                  <span class="bg-blue-200 px-2 py-1 text-sm">John Smith</span>
                </div>
              </div>
            </div>
            
            <div class="mt-8">
              <p class="text-justify leading-relaxed">
                This Service Agreement ("Agreement") is entered into on 
                <span class="bg-green-200 px-1 mx-1">January 15, 2024</span> 
                by and between ABC Corporation and John Smith for professional services.
              </p>
            </div>
            
            <div class="mt-8">
              <h2 class="text-lg font-semibold mb-4">Terms and Conditions</h2>
              <p class="text-justify leading-relaxed mb-4">
                The service provider agrees to deliver professional consulting services as outlined in the attached scope of work. Payment terms are net 30 days from invoice date.
              </p>
              <p class="text-justify leading-relaxed">
                This agreement shall remain in effect for a period of 12 months from the date of signing, unless terminated earlier by mutual consent of both parties.
              </p>
            </div>
            
            <div class="mt-12 grid grid-cols-2 gap-8">
              <div class="text-center">
                <div class="border-t border-gray-400 pt-2 mt-16">
                  <p class="font-semibold">Service Provider</p>
                  <div class="mt-8 h-16 border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <span class="text-gray-500 text-sm">Signature Required</span>
                  </div>
                  <p class="text-sm mt-2">Date: _______________</p>
                </div>
              </div>
              
              <div class="text-center">
                <div class="border-t border-gray-400 pt-2 mt-16">
                  <p class="font-semibold">Client</p>
                  <div class="mt-8 h-16 border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <span class="text-gray-500 text-sm">Signature Required</span>
                  </div>
                  <p class="text-sm mt-2">Date: _______________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      fields: [
        {
          id: 'sig1',
          x: 150,
          y: 650,
          width: 200,
          height: 60,
          page: 1,
          type: 'signature',
          label: 'Client Signature',
          required: true
        },
        {
          id: 'date1',
          x: 150,
          y: 720,
          width: 150,
          height: 30,
          page: 1,
          type: 'date',
          label: 'Date',
          required: true
        },
        {
          id: 'name1',
          x: 150,
          y: 580,
          width: 200,
          height: 30,
          page: 1,
          type: 'text',
          label: 'Print Name',
          required: true
        }
      ],
      recipient: {
        id: recipientId || 'rec1',
        name: 'John Smith',
        email: 'john@example.com',
        role: 'Signer'
      }
    };

    setDocumentData(mockDocument);
    setFields(mockDocument.fields);
    setIsLoading(false);
  }, [documentId, recipientId]);

  const logAccess = (action: string) => {
    const accessLog = {
      documentId,
      recipientId,
      action,
      timestamp: new Date().toISOString(),
      ipAddress: '192.168.1.1', // In real app, get from server
      userAgent: navigator.userAgent,
      location: 'Unknown' // In real app, get from IP geolocation
    };
    
    console.log('Access logged:', accessLog);
    
    // In a real application, send this to your backend
    // fetch('/api/log-access', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(accessLog)
    // });
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleFieldClick = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field || field.completed) return;

    setActiveField(fieldId);
    
    if (field.type === 'signature') {
      setShowSignatureModal(true);
    } else if (field.type === 'text') {
      setTextInput(field.value || '');
    } else if (field.type === 'date') {
      const today = new Date().toISOString().split('T')[0];
      setTextInput(field.value || today);
    }
  };

  const saveSignature = () => {
    if (signatureCanvasRef.current && activeField) {
      const signatureData = signatureCanvasRef.current.toDataURL();
      
      setFields(prev => prev.map(field => 
        field.id === activeField 
          ? { ...field, value: signatureData, completed: true }
          : field
      ));
      
      setShowSignatureModal(false);
      setActiveField(null);
      logAccess('field_completed');
    }
  };

  const saveTextInput = () => {
    if (activeField && textInput.trim()) {
      setFields(prev => prev.map(field => 
        field.id === activeField 
          ? { ...field, value: textInput.trim(), completed: true }
          : field
      ));
      
      setActiveField(null);
      setTextInput('');
      logAccess('field_completed');
    }
  };

  const completeDocument = () => {
    const allRequiredFieldsCompleted = fields
      .filter(f => f.required)
      .every(f => f.completed);

    if (!allRequiredFieldsCompleted) {
      alert('Please complete all required fields before submitting.');
      return;
    }

    // Log completion
    logAccess('document_signed');
    
    // In real app, submit to backend
    console.log('Document completed with fields:', fields);
    
    setIsCompleted(true);
    alert('Document signed successfully! Thank you.');
  };

  const currentPageFields = fields.filter(field => field.page === currentPage);
  const completedFields = fields.filter(f => f.completed).length;
  const totalRequiredFields = fields.filter(f => f.required).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Not Found</h1>
          <p className="text-gray-600">The document you're looking for doesn't exist or has expired.</p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Signed Successfully!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for signing "{documentData.title}". All parties will be notified of the completion.
          </p>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">
              Signed by: <span className="font-medium">{documentData.recipient.name}</span><br />
              Date: <span className="font-medium">{new Date().toLocaleDateString()}</span><br />
              Time: <span className="font-medium">{new Date().toLocaleTimeString()}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{documentData.title}</h1>
                  <p className="text-sm text-gray-600">
                    Signing as: {documentData.recipient.name} ({documentData.recipient.email})
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Progress: {completedFields}/{totalRequiredFields} fields completed
                </p>
                <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(completedFields / totalRequiredFields) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Document Viewer */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Page Navigation */}
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

              {/* Document Content */}
              <div className="p-8 bg-gray-100">
                <div className="max-w-4xl mx-auto">
                  <div className="relative bg-white shadow-lg">
                    {documentData.content ? (
                      // Render template content
                      <div 
                        className="min-h-[800px] relative"
                        dangerouslySetInnerHTML={{ __html: documentData.content }}
                      />
                    ) : documentData.fileUrl ? (
                      // Render PDF
                      <Document
                        file={documentData.fileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        className="w-full"
                        loading={<div className="flex items-center justify-center h-96">Loading PDF...</div>}
                        error={<div className="flex items-center justify-center h-96 text-red-600">Error loading PDF</div>}
                      >
                        <Page
                          pageNumber={currentPage}
                          width={800}
                          className="w-full"
                          loading={<div className="flex items-center justify-center h-96">Loading page...</div>}
                        />
                      </Document>
                    ) : null}

                    {/* Signature Fields Overlay */}
                    {currentPageFields.map((field) => (
                      <div
                        key={field.id}
                        onClick={() => handleFieldClick(field.id)}
                        className={`absolute border-2 cursor-pointer flex items-center justify-center text-xs font-medium transition-all ${
                          field.completed
                            ? 'border-green-500 bg-green-100 text-green-700'
                            : activeField === field.id
                            ? 'border-blue-500 bg-blue-100 text-blue-700'
                            : 'border-red-500 bg-red-100 text-red-700 animate-pulse'
                        }`}
                        style={{
                          left: field.x,
                          top: field.y,
                          width: field.width,
                          height: field.height,
                        }}
                      >
                        {field.completed ? (
                          field.type === 'signature' ? (
                            <img src={field.value} alt="Signature" className="max-w-full max-h-full" />
                          ) : (
                            <span className="truncate px-2">{field.value}</span>
                          )
                        ) : (
                          <span>
                            {field.type === 'signature' && <Edit3 className="w-4 h-4 mr-1" />}
                            {field.type === 'text' && <Type className="w-4 h-4 mr-1" />}
                            {field.type === 'date' && <Calendar className="w-4 h-4 mr-1" />}
                            Click to {field.type === 'signature' ? 'sign' : 'fill'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Fields</h3>
              
              <div className="space-y-3 mb-6">
                {fields.filter(f => f.required).map((field) => (
                  <div
                    key={field.id}
                    onClick={() => handleFieldClick(field.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      field.completed
                        ? 'border-green-200 bg-green-50'
                        : activeField === field.id
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-red-200 bg-red-50 hover:bg-red-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{field.label}</p>
                        <p className="text-xs text-gray-500">
                          Page {field.page} • {field.type}
                        </p>
                      </div>
                      {field.completed ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Text Input Modal */}
              {activeField && (fields.find(f => f.id === activeField)?.type === 'text' || fields.find(f => f.id === activeField)?.type === 'date') && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    {fields.find(f => f.id === activeField)?.label}
                  </h4>
                  <input
                    type={fields.find(f => f.id === activeField)?.type === 'date' ? 'date' : 'text'}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                    placeholder={`Enter ${fields.find(f => f.id === activeField)?.label.toLowerCase()}`}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveTextInput}
                      disabled={!textInput.trim()}
                      className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setActiveField(null);
                        setTextInput('');
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={completeDocument}
                disabled={completedFields < totalRequiredFields}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {completedFields < totalRequiredFields 
                  ? `Complete ${totalRequiredFields - completedFields} more field${totalRequiredFields - completedFields !== 1 ? 's' : ''}`
                  : 'Submit Signed Document'
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Add Your Signature</h3>
              <p className="text-sm text-gray-600 mt-1">
                Draw your signature in the box below
              </p>
            </div>
            <div className="p-6">
              <div className="border border-gray-300 rounded-lg">
                <SignatureCanvas
                  ref={signatureCanvasRef}
                  canvasProps={{
                    width: 600,
                    height: 200,
                    className: 'signature-canvas w-full'
                  }}
                />
              </div>
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => signatureCanvasRef.current?.clear()}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear
                </button>
                <div className="space-x-3">
                  <button
                    onClick={() => {
                      setShowSignatureModal(false);
                      setActiveField(null);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSignature}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Signature
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

export default SigningPage;