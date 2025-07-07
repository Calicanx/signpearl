import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Save, Plus, Type, Edit3, MousePointer, Send, Mail, Users, Clock, UserPlus, Calendar, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
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
  assignedTo?: string;
}

interface Recipient {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface DocumentEditorProps {
  file?: File;
  templateContent?: string;
  templateName?: string;
  onClose: () => void;
  onSave: (fields: SignatureField[], documentData?: any) => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ 
  file, 
  templateContent, 
  templateName, 
  onClose, 
  onSave 
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [selectedTool, setSelectedTool] = useState<'signature' | 'text' | 'date' | 'select'>('select');
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [newRecipient, setNewRecipient] = useState({ email: '', name: '', role: 'Signer' });
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingStep, setSendingStep] = useState<'compose' | 'sending' | 'sent'>('compose');
  
  const pageRef = useRef<HTMLDivElement>(null);
  const signatureCanvasRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (file) {
      // Handle uploaded file
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      setIsTemplate(false);
      setDocumentError(null);
      setDocumentLoaded(false);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (templateContent) {
      // Handle template
      setIsTemplate(true);
      setDocumentLoaded(true);
      setNumPages(1);
      setDocumentError(null);
    } else {
      setDocumentError('No document or template provided');
    }
  }, [file, templateContent]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setDocumentLoaded(true);
    setDocumentError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setDocumentError('Failed to load PDF document. Please try uploading again.');
    setDocumentLoaded(false);
  };

  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'select' || !isAddingField) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newField: SignatureField = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.max(0, x - 50),
      y: Math.max(0, y - 15),
      width: selectedTool === 'signature' ? 150 : 100,
      height: 30,
      page: currentPage,
      type: selectedTool,
      label: `${selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1)} Field`,
      required: true
    };

    setSignatureFields(prev => [...prev, newField]);
    setIsAddingField(false);
  };

  const handleFieldMouseDown = (event: React.MouseEvent, fieldId: string) => {
    event.stopPropagation();
    setSelectedField(fieldId);
    setIsDragging(true);
    
    const field = signatureFields.find(f => f.id === fieldId);
    if (field) {
      const rect = event.currentTarget.getBoundingClientRect();
      setDragOffset({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !selectedField || !pageRef.current) return;

    const pageRect = pageRef.current.getBoundingClientRect();
    const newX = event.clientX - pageRect.left - dragOffset.x;
    const newY = event.clientY - pageRect.top - dragOffset.y;

    setSignatureFields(prev =>
      prev.map(field =>
        field.id === selectedField 
          ? { ...field, x: Math.max(0, newX), y: Math.max(0, newY) }
          : field
      )
    );
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleFieldDelete = (fieldId: string) => {
    setSignatureFields(prev => prev.filter(field => field.id !== fieldId));
    setSelectedField(null);
  };

  const saveSignature = () => {
    if (signatureCanvasRef.current) {
      const signatureData = signatureCanvasRef.current.toDataURL();
      console.log('Signature saved:', signatureData);
      setShowSignatureModal(false);
    }
  };

  const clearSignature = () => {
    if (signatureCanvasRef.current) {
      signatureCanvasRef.current.clear();
    }
  };

  const handleSave = () => {
    const documentData = {
      name: file?.name || templateName || 'Untitled Document',
      type: isTemplate ? 'template' : 'upload',
      content: templateContent,
      fileUrl: fileUrl
    };
    onSave(signatureFields, documentData);
  };

  const addRecipient = () => {
    if (newRecipient.email && newRecipient.name) {
      const recipient: Recipient = {
        id: Math.random().toString(36).substr(2, 9),
        ...newRecipient
      };
      setRecipients(prev => [...prev, recipient]);
      setNewRecipient({ email: '', name: '', role: 'Signer' });
    }
  };

  const removeRecipient = (id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
  };

  const generateDocumentUrl = (documentId: string, recipientId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/sign/${documentId}/${recipientId}`;
  };

  const logAccess = (documentId: string, recipientId: string, action: string) => {
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
    return accessLog;
  };

  const sendEmailToRecipients = async (documentId: string) => {
    const emailPromises = recipients.map(async (recipient) => {
      const signingUrl = generateDocumentUrl(documentId, recipient.id);
      
      // Log the email send action
      logAccess(documentId, recipient.id, 'email_sent');
      
      const emailData = {
        to: recipient.email,
        subject: `Document Signature Request - ${file?.name || templateName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">SignPearl</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Document Signature Request</p>
            </div>
            
            <div style="padding: 30px; background: white;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${recipient.name},</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                You have been requested to sign the document: <strong>${file?.name || templateName}</strong>
              </p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Document Details:</h3>
                <ul style="color: #666; margin: 0; padding-left: 20px;">
                  <li>Document: ${file?.name || templateName}</li>
                  <li>Your Role: ${recipient.role}</li>
                  <li>Fields to Complete: ${signatureFields.length}</li>
                  <li>Sent: ${new Date().toLocaleDateString()}</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${signingUrl}" 
                   style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Review & Sign Document
                </a>
              </div>
              
              <p style="color: #999; font-size: 14px; margin-top: 30px;">
                This link is unique to you and will expire in 30 days. If you have any questions, please contact the sender.
              </p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #999; margin: 0; font-size: 12px;">
                Powered by SignPearl - Secure Digital Document Signing
              </p>
            </div>
          </div>
        `,
        metadata: {
          documentId,
          recipientId: recipient.id,
          signingUrl,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        }
      };
      
      console.log('Email would be sent:', emailData);
      
      // Simulate email sending
      return new Promise(resolve => setTimeout(resolve, 500));
    });
    
    return Promise.all(emailPromises);
  };

  const handleSendDocument = async () => {
    try {
      setSendingStep('sending');
      
      // Generate unique document ID
      const documentId = Math.random().toString(36).substr(2, 9);
      
      // Log document creation
      logAccess(documentId, 'system', 'document_created');
      
      // Send emails to all recipients
      await sendEmailToRecipients(documentId);
      
      // Create document record with tracking URLs
      const documentRecord = {
        id: documentId,
        name: file?.name || templateName || 'Untitled Document',
        fields: signatureFields,
        recipients: recipients.map(recipient => ({
          ...recipient,
          signingUrl: generateDocumentUrl(documentId, recipient.id),
          status: 'pending',
          sentAt: new Date().toISOString()
        })),
        createdAt: new Date().toISOString(),
        status: 'sent'
      };
      
      console.log('Document sent successfully:', documentRecord);
      
      setSendingStep('sent');
      
      setTimeout(() => {
        setShowSendModal(false);
        setSendingStep('compose');
        onSave(signatureFields, documentRecord);
      }, 2000);
      
    } catch (error) {
      console.error('Error sending document:', error);
      alert('Error sending document. Please try again.');
      setSendingStep('compose');
    }
  };

  const currentPageFields = signatureFields.filter(field => field.page === currentPage);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-4 max-h-[95vh] overflow-hidden flex">
        {/* Sidebar */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Document Editor</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              {file?.name || templateName || 'Template Document'}
            </p>
            {isTemplate && (
              <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                Template
              </span>
            )}
          </div>

          {/* Tools */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Tools</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setSelectedTool('select');
                  setIsAddingField(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  selectedTool === 'select' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                }`}
              >
                <MousePointer className="w-4 h-4" />
                <span>Select & Move</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTool('signature');
                  setIsAddingField(true);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  selectedTool === 'signature' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                <span>Signature</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTool('text');
                  setIsAddingField(true);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  selectedTool === 'text' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Text Field</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTool('date');
                  setIsAddingField(true);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  selectedTool === 'date' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Date Field</span>
              </button>
            </div>
            {isAddingField && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  Click on the document to place a {selectedTool} field
                </p>
              </div>
            )}
          </div>

          {/* Fields List */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Fields ({signatureFields.length})
            </h3>
            <div className="space-y-2">
              {signatureFields.map((field) => (
                <div
                  key={field.id}
                  onClick={() => setSelectedField(field.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedField === field.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{field.label}</p>
                      <p className="text-xs text-gray-500">
                        Page {field.page} • {field.type}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFieldDelete(field.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-gray-200">
            <div className="space-y-3">
              <button
                onClick={() => setShowSignatureModal(true)}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Create Signature
              </button>
              <button
                onClick={() => setShowSendModal(true)}
                disabled={signatureFields.length === 0}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>Send for Signature</span>
              </button>
              <button
                onClick={handleSave}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Document</span>
              </button>
            </div>
          </div>
        </div>

        {/* Document Viewer */}
        <div className="flex-1 flex flex-col">
          {/* Page Navigation - Only show for PDFs with multiple pages */}
          {!isTemplate && numPages > 1 && (
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
                {selectedTool === 'select' ? 'Select and drag fields to move them' : 
                 isAddingField ? `Click to place ${selectedTool} field` : ''}
              </div>
            </div>
          )}

          {/* Document Content */}
          <div className="flex-1 overflow-auto bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
              <div
                ref={pageRef}
                className="relative bg-white shadow-lg min-h-[600px]"
                onClick={handlePageClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ cursor: isAddingField ? 'crosshair' : 'default' }}
              >
                {documentError ? (
                  <div className="flex items-center justify-center h-96 text-red-600 p-8">
                    <div className="text-center">
                      <X className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-lg font-medium mb-2">Document Error</p>
                      <p className="text-sm">{documentError}</p>
                    </div>
                  </div>
                ) : isTemplate ? (
                  // Render template content
                  <div 
                    className="min-h-[800px] p-8"
                    dangerouslySetInnerHTML={{ __html: templateContent || '' }}
                  />
                ) : file && fileUrl ? (
                  // Render PDF
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
                    />
                  </Document>
                ) : (
                  <div className="flex items-center justify-center h-96 text-gray-500">
                    <div className="text-center">
                      <p className="text-lg font-medium mb-2">No Document</p>
                      <p className="text-sm">Please upload a document or select a template</p>
                    </div>
                  </div>
                )}

                {/* Signature Fields Overlay */}
                {documentLoaded && currentPageFields.map((field) => (
                  <div
                    key={field.id}
                    onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                    className={`absolute border-2 border-dashed cursor-move flex items-center justify-center text-xs font-medium select-none ${
                      selectedField === field.id
                        ? 'border-blue-500 bg-blue-100 text-blue-700'
                        : 'border-gray-400 bg-gray-100 text-gray-600'
                    }`}
                    style={{
                      left: field.x,
                      top: field.y,
                      width: field.width,
                      height: field.height,
                    }}
                  >
                    {field.type === 'signature' && 'Signature'}
                    {field.type === 'text' && 'Text'}
                    {field.type === 'date' && 'Date'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Create Your Signature</h3>
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
                  onClick={clearSignature}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear
                </button>
                <div className="space-x-3">
                  <button
                    onClick={() => setShowSignatureModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSignature}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Signature
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Document Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Send for Signature</h3>
                    <p className="text-blue-100 text-sm">Share your document with recipients</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSendModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {sendingStep === 'compose' && (
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Document Info Card */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl mb-6 border border-blue-200">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{file?.name || templateName}</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Edit3 className="w-4 h-4" />
                          <span>{signatureFields.length} signature fields</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4" />
                          <span>{recipients.length} recipients</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4" />
                          <span>Created {new Date().toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isTemplate ? 'Template' : 'Uploaded Document'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add Recipients Section */}
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-gray-900">Add Recipients</h4>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={newRecipient.name}
                        onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                        className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={newRecipient.email}
                        onChange={(e) => setNewRecipient(prev => ({ ...prev, email: e.target.value }))}
                        className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="flex space-x-2">
                        <select
                          value={newRecipient.role}
                          onChange={(e) => setNewRecipient(prev => ({ ...prev, role: e.target.value }))}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="Signer">Signer</option>
                          <option value="Reviewer">Reviewer</option>
                          <option value="CC">CC</option>
                        </select>
                        <button
                          onClick={addRecipient}
                          disabled={!newRecipient.email || !newRecipient.name}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recipients List */}
                {recipients.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Recipients ({recipients.length})</h4>
                      <span className="text-sm text-gray-500">All recipients will receive signing invitations</span>
                    </div>
                    <div className="space-y-3">
                      {recipients.map((recipient) => (
                        <div key={recipient.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                              {recipient.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{recipient.name}</p>
                              <p className="text-sm text-gray-600">{recipient.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                              {recipient.role}
                            </span>
                            <button
                              onClick={() => removeRecipient(recipient.id)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Section */}
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-gray-900">Personal Message</h4>
                    <span className="text-sm text-gray-500">(Optional)</span>
                  </div>
                  <textarea
                    placeholder="Add a personal message for your recipients..."
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Warning if no recipients */}
                {recipients.length === 0 && (
                  <div className="flex items-center space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <p className="text-amber-800 text-sm">Please add at least one recipient to send the document.</p>
                  </div>
                )}
              </div>
            )}

            {sendingStep === 'sending' && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
                <h4 className="text-xl font-semibold text-gray-900 mb-2">Sending Document</h4>
                <p className="text-gray-600">Preparing emails and generating secure signing links...</p>
              </div>
            )}

            {sendingStep === 'sent' && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-xl font-semibold text-gray-900 mb-2">Document Sent Successfully!</h4>
                <p className="text-gray-600">All recipients have been notified and can now sign the document.</p>
              </div>
            )}

            {/* Footer */}
            {sendingStep === 'compose' && (
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {recipients.length > 0 ? (
                      <span className="flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>Ready to send to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Add recipients to continue</span>
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowSendModal(false)}
                      className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendDocument}
                      disabled={recipients.length === 0}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-medium"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Document</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentEditor;