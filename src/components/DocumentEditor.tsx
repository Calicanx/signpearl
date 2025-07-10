import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAuth } from '../hooks/useAuth';
import { DocumentService } from '../services/DocumentService';
import { v4 as uuidv4 } from 'uuid';
import { X, Save, Plus, Type, Edit3, MousePointer, Send, Mail, Users, UserPlus, Calendar, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// Interface for signature fields placed on the document
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
  assignedTo?: string | null;
}

// Interface for recipients who will receive the document
interface Recipient {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Interface for the DocumentEditor component props
interface DocumentEditorProps {
  file?: File;
  templateContent?: string;
  templateName?: string;
  onClose: () => void;
  onSave: (fields: SignatureField[], documentData?: any) => void;
}

// DocumentEditor component definition
const DocumentEditor: React.FC<DocumentEditorProps> = ({
  file,
  templateContent,
  templateName,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();

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

  // Effect to handle file or template loading
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      setIsTemplate(false);
      setDocumentError(null);
      setDocumentLoaded(false);
      return () => URL.revokeObjectURL(url);
    } else if (templateContent) {
      setIsTemplate(true);
      setDocumentLoaded(true);
      setNumPages(1);
      setDocumentError(null);
    } else {
      setDocumentError('No document or template provided');
    }
  }, [file, templateContent]);

  // Callback for successful PDF loading
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setDocumentLoaded(true);
    setDocumentError(null);
  };

  // Callback for PDF loading errors
  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setDocumentError('Failed to load PDF document. Please try uploading again.');
    setDocumentLoaded(false);
  };

  // Handle clicks on the page to place new fields
  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'select' || !isAddingField) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newField: SignatureField = {
      id: uuidv4(),
      x: Math.max(0, x - 50),
      y: Math.max(0, y - 15),
      width: selectedTool === 'signature' ? 150 : 100,
      height: 30,
      page: currentPage,
      type: selectedTool,
      label: `${selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1)} Field`,
      required: true,
      assignedTo: null,
    };

    setSignatureFields((prev) => [...prev, newField]);
    setIsAddingField(false);
  };

  // Handle mouse down on a field to start dragging
  const handleFieldMouseDown = (event: React.MouseEvent, fieldId: string) => {
    event.stopPropagation();
    setSelectedField(fieldId);
    setIsDragging(true);
    const field = signatureFields.find((f) => f.id === fieldId);
    if (field) {
      const rect = event.currentTarget.getBoundingClientRect();
      setDragOffset({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
  };

  // Handle mouse movement for dragging fields
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !selectedField || !pageRef.current) return;
    const pageRect = pageRef.current.getBoundingClientRect();
    const newX = event.clientX - pageRect.left - dragOffset.x;
    const newY = event.clientY - pageRect.top - dragOffset.y;

    setSignatureFields((prev) =>
      prev.map((field) =>
        field.id === selectedField
          ? { ...field, x: Math.max(0, newX), y: Math.max(0, newY) }
          : field
      )
    );
  };

  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Delete a field from the document
  const handleFieldDelete = (fieldId: string) => {
    setSignatureFields((prev) => prev.filter((field) => field.id !== fieldId));
    setSelectedField(null);
  };

  // Save the signature from the canvas
  const saveSignature = async () => {
    if (!user || !signatureCanvasRef.current) return;
    try {
      const signatureData = signatureCanvasRef.current.toDataURL();
      await DocumentService.saveSignature({
        document_id: 'temp',
        recipient_id: user.id,
        signature_data: signatureData,
        ip_address: '127.0.0.1',
        user_agent: navigator.userAgent,
        location: 'Unknown',
      });
      console.log('Signature saved:', signatureData);
      setShowSignatureModal(false);
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Error saving signature. Please try again.');
    }
  };

  // Clear the signature canvas
  const clearSignature = () => {
    if (signatureCanvasRef.current) {
      signatureCanvasRef.current.clear();
    }
  };

  // Save the document and its fields to Supabase
  const handleSave = async () => {
    if (!user || !file) {
      alert('You must be logged in and have a file to save the document.');
      return;
    }

    try {
      // Step 1: Generate the edited PDF with fields
      const originalPdfBytes = await fetch(fileUrl).then((res) => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      const form = pdfDoc.getForm();

      for (const field of signatureFields) {
        const page = pdfDoc.getPage(field.page - 1);
        const rect = [field.x, page.getHeight() - field.y - field.height, field.x + field.width, page.getHeight() - field.y];

        if (field.type === 'signature') {
          const signatureField = form.createSignature(field.label);
          signatureField.setRectangle(rect);
          page.addAnnotation(signatureField);
        } else if (field.type === 'text') {
          const textField = form.createTextField(field.label);
          textField.setRectangle(rect);
          page.addAnnotation(textField);
        } else if (field.type === 'date') {
          const dateField = form.createTextField(field.label);
          dateField.setRectangle(rect);
          page.addAnnotation(dateField);
        }
      }

      const newPdfBytes = await pdfDoc.save();
      const editedFile = new File([newPdfBytes], `${file.name || 'edited'}.pdf`, { type: 'application/pdf' });

      // Step 2: Create the document record without file_url
      const document = await DocumentService.createDocument({
        title: file.name || templateName || 'Untitled Document',
        owner_id: user.id,
        status: 'draft',
        content: templateContent,
      });
      const documentId = document.id;

      // Step 3: Upload the edited PDF to Supabase Storage
      const publicUrl = await DocumentService.uploadDocumentFile(documentId, editedFile);

      // Step 4: Update the document record with file_url
      await DocumentService.updateDocument(documentId, { file_url: publicUrl });

      // Step 5: Save signature fields
      if (signatureFields.length > 0) {
        const fieldInserts = signatureFields.map((field) => ({
          document_id: documentId,
          field_type: field.type,
          x_position: field.x,
          y_position: field.y,
          width: field.width,
          height: field.height,
          page_number: field.page,
          label: field.label,
          required: field.required,
          assigned_to: field.assignedTo,
        }));
        await DocumentService.saveSignatureFields(fieldInserts);
      }

      console.log('Document saved successfully:', { id: documentId, name: document.title, file_url: publicUrl });
      onSave(signatureFields, { id: documentId, name: document.title, file_url: publicUrl });
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Error saving document. Please try again.');
    }
  };

  // Generate a unique signing URL for a recipient
  const generateDocumentUrl = (documentId: string, recipientId: string) => {
    const baseUrl = window.location.origin;
    const token = uuidv4();
    return `${baseUrl}/sign/${documentId}/${recipientId}?token=${token}`;
  };

  // Log access events for the document
  const logAccess = async (documentId: string, recipientId: string | null, action: string) => {
    try {
      await DocumentService.logAccess({
        document_id: documentId,
        recipient_id: recipientId,
        action,
        ip_address: '127.0.0.1',
        user_agent: navigator.userAgent,
        location: 'Unknown',
      });
    } catch (error) {
      console.error('Error logging access:', error);
      throw error; // Re-throw to handle in caller
    }
  };

  // Simulate sending emails to recipients with signing URLs
  const sendEmailToRecipients = async (documentId: string) => {
    const emailPromises = recipients.map(async (recipient) => {
      const signingUrl = generateDocumentUrl(documentId, recipient.id);
      await logAccess(documentId, recipient.id, 'email_sent');

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
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      console.log('Email would be sent:', emailData);
      return new Promise((resolve) => setTimeout(resolve, 500));
    });

    return Promise.all(emailPromises);
  };

  // Handle sending the document to recipients
  const handleSendDocument = async () => {
    if (!user) {
      alert('You must be logged in to send a document.');
      return;
    }
    try {
      setSendingStep('sending');
      const documentId = uuidv4();

      // Step 1: Create the document in the database with initial status
      const document = await DocumentService.createDocument({
        id: documentId,
        title: file?.name || templateName || 'Untitled Document',
        owner_id: user.id,
        status: 'preparing',
        content: templateContent,
      });

      // Step 2: Log the access after document creation
      await logAccess(documentId, null, 'document_created');

      // Step 3: Generate and upload the edited PDF with fields
      let publicUrl = fileUrl;
      if (file) {
        const originalPdfBytes = await fetch(fileUrl).then((res) => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(originalPdfBytes);
        const form = pdfDoc.getForm();

        for (const field of signatureFields) {
          const page = pdfDoc.getPage(field.page - 1);
          const rect = [field.x, page.getHeight() - field.y - field.height, field.x + field.width, page.getHeight() - field.y];

          if (field.type === 'signature') {
            const signatureField = form.createSignature(field.label);
            signatureField.setRectangle(rect);
            page.addAnnotation(signatureField);
          } else if (field.type === 'text') {
            const textField = form.createTextField(field.label);
            textField.setRectangle(rect);
            page.addAnnotation(textField);
          } else if (field.type === 'date') {
            const dateField = form.createTextField(field.label);
            dateField.setRectangle(rect);
            page.addAnnotation(dateField);
          }
        }

        const newPdfBytes = await pdfDoc.save();
        const editedFile = new File([newPdfBytes], `${file.name || 'edited'}.pdf`, { type: 'application/pdf' });
        publicUrl = await DocumentService.uploadDocumentFile(documentId, editedFile);
      }

      // Step 4: Update the document with file_url
      await DocumentService.updateDocument(documentId, { file_url: publicUrl });

      // Step 5: Save signature fields
      if (signatureFields.length > 0) {
        const fieldInserts = signatureFields.map((field) => ({
          document_id: documentId,
          field_type: field.type,
          x_position: field.x,
          y_position: field.y,
          width: field.width,
          height: field.height,
          page_number: field.page,
          label: field.label,
          required: field.required,
          assigned_to: field.assignedTo,
        }));
        await DocumentService.saveSignatureFields(fieldInserts);
      }

      // Step 6: Add recipients to the document
      if (recipients.length > 0) {
        const recipientInserts = recipients.map((recipient) => ({
          id: recipient.id,
          document_id: documentId,
          email: recipient.email,
          name: recipient.name,
          role: recipient.role,
          status: 'pending',
          signing_url_token: uuidv4(),
          token_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }));
        await DocumentService.addRecipients(recipientInserts);
        await sendEmailToRecipients(documentId);
      }

      // Step 7: Update document status to 'sent'
      await DocumentService.updateDocument(documentId, { status: 'sent' });

      setSendingStep('sent');
      setTimeout(() => {
        setShowSendModal(false);
        setSendingStep('compose');
        onSave(signatureFields, {
          id: documentId,
          name: document.title,
          file_url: publicUrl,
          recipients: recipients.map((r) => ({
            ...r,
            signingUrl: generateDocumentUrl(documentId, r.id),
            status: 'pending',
            sentAt: new Date().toISOString(),
          })),
        });
      }, 2000);
    } catch (error) {
      console.error('Error sending document:', error);
      alert('Error sending document. Please try again.');
      setSendingStep('compose');
    }
  };

  // Add a new recipient to the list
  const addRecipient = () => {
    if (newRecipient.email && newRecipient.name) {
      const recipient: Recipient = { id: uuidv4(), ...newRecipient };
      setRecipients((prev) => [...prev, recipient]);
      setNewRecipient({ email: '', name: '', role: 'Signer' });
    }
  };

  // Remove a recipient from the list
  const removeRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  // Filter fields for the current page
  const currentPageFields = signatureFields.filter((field) => field.page === currentPage);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-4 max-h-[95vh] overflow-hidden flex">
        <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Document Editor</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">{file?.name || templateName || 'Template Document'}</p>
            {isTemplate && (
              <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                Template
              </span>
            )}
          </div>

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
                <p className="text-xs text-blue-700">Click on the document to place a {selectedTool} field</p>
              </div>
            )}
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Fields ({signatureFields.length})</h3>
            <div className="space-y-2">
              {signatureFields.map((field) => (
                <div
                  key={field.id}
                  onClick={() => setSelectedField(field.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedField === field.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-100'
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

        <div className="flex-1 flex flex-col">
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
                {selectedTool === 'select' ? 'Select and drag fields to move them' : isAddingField ? `Click to place ${selectedTool} field` : ''}
              </div>
            </div>
          )}

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
                  <div className="min-h-[800px] p-8" dangerouslySetInnerHTML={{ __html: templateContent || '' }} />
                ) : file && fileUrl ? (
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

                {documentLoaded &&
                  currentPageFields.map((field) => (
                    <div
                      key={field.id}
                      onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                      className={`absolute border-2 border-dashed cursor-move flex items-center justify-center text-xs font-medium select-none ${
                        selectedField === field.id ? 'border-blue-500 bg-blue-100 text-blue-700' : 'border-gray-400 bg-gray-100 text-gray-600'
                      }`}
                      style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
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
                  canvasProps={{ width: 600, height: 200, className: 'signature-canvas w-full' }}
                />
              </div>
              <div className="flex justify-between mt-4">
                <button onClick={clearSignature} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Clear
                </button>
                <div className="space-x-3">
                  <button
                    onClick={() => setShowSignatureModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button onClick={saveSignature} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Save Signature
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
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
                <button onClick={() => setShowSendModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {sendingStep === 'compose' && (
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
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
                        onChange={(e) => setNewRecipient((prev) => ({ ...prev, name: e.target.value }))}
                        className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={newRecipient.email}
                        onChange={(e) => setNewRecipient((prev) => ({ ...prev, email: e.target.value }))}
                        className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="flex space-x-2">
                        <select
                          value={newRecipient.role}
                          onChange={(e) => setNewRecipient((prev) => ({ ...prev, role: e.target.value }))}
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

                {recipients.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Recipients ({recipients.length})</h4>
                      <span className="text-sm text-gray-500">All recipients will receive signing invitations</span>
                    </div>
                    <div className="space-y-3">
                      {recipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow"
                        >
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

            {sendingStep === 'compose' && (
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {recipients.length > 0 ? (
                      <span className="flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>
                          Ready to send to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                        </span>
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