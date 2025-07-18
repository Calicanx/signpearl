import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAuth } from '../hooks/useAuth';
import { DocumentService } from '../services/documentService';
import { v4 as uuidv4 } from 'uuid';
import {
  X,
  Save,
  Plus,
  Type,
  Edit3,
  MousePointer,
  Send,
  Mail,
  Users,
  UserPlus,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  User,
  Phone,
  AtSign,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface SignatureField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  type: 'signature' | 'text' | 'date' | 'name' | 'email' | 'phone' | 'custom';
  label: string;
  required: boolean;
  assignedTo?: string | null;
  defaultValue?: string;
}

interface Recipient {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface DocumentData {
  id?: string;
  title: string;
  owner_id: string;
  status?: 'draft' | 'sent' | 'signed' | 'completed';
  content?: string | null;
  file_url?: string | null;
  created_at?: string;
  updated_at?: string;
  is_template?: boolean;
}

interface RecipientData {
  id?: string;
  document_id: string;
  email: string;
  name: string;
  role?: string;
  status?: 'pending' | 'viewed' | 'signed';
  signing_url_token?: string;
  token_expiry?: string;
  created_at?: string;
}

interface SignatureFieldData {
  id?: string;
  document_id: string;
  field_type: 'signature' | 'text' | 'date' | 'name' | 'email' | 'phone' | 'custom';
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  page_number: number;
  label: string;
  required: boolean;
  assigned_to?: string | null;
}

interface DocumentEditorProps {
  file?: File;
  templateContent?: string;
  templateName?: string;
  documentId?: string;
  isTemplateUpload?: boolean;
  onClose: () => void;
  onSave: (fields: SignatureField[], documentData?: any) => void;
}

interface Database {
  public: {
    Tables: {
      documents: {
        Insert: {
          id?: string;
          title: string;
          owner_id: string;
          status?: 'draft' | 'sent' | 'signed' | 'completed';
          content?: string | null;
          file_url?: string | null;
          created_at?: string;
          updated_at?: string;
          is_template?: boolean;
        };
      };
      recipients: {
        Insert: {
          id?: string;
          document_id: string;
          email: string;
          name: string;
          role?: string;
          status?: 'pending' | 'viewed' | 'signed';
          signing_url_token?: string;
          token_expiry?: string;
          created_at?: string;
        };
      };
    };
  };
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  file,
  templateContent,
  templateName,
  documentId,
  isTemplateUpload = false,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [selectedTool, setSelectedTool] = useState<'signature' | 'text' | 'date' | 'name' | 'email' | 'phone' | 'custom' | 'select'>('select');
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [newRecipient, setNewRecipient] = useState({ email: '', name: '', role: 'Signer' });
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingStep, setSendingStep] = useState<'compose' | 'sending' | 'sent'>('compose');
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(isTemplateUpload);

  const pageRef = useRef<HTMLDivElement>(null);
  const signatureCanvasRef = useRef<SignatureCanvas>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const originalPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const loadTemplateData = async () => {
      if (documentId && user) {
        try {
          const template = await DocumentService.getDocument(documentId);
          if (template && template.is_template) {
            setFileUrl(template.file_url || '');
            setIsTemplate(false);
            const fields = await DocumentService.getSignatureFields(documentId);
            setSignatureFields(
              fields.map((field) => ({
                id: field.id,
                x: field.x_position,
                y: field.y_position,
                width: field.width,
                height: field.height,
                page: field.page_number,
                type: field.field_type,
                label: field.label,
                required: field.required,
                assignedTo: field.assigned_to,
                defaultValue: field.defaultValue,
              }))
            );
            setDocumentLoaded(true);
            setNumPages(1);
          } else {
            setDocumentError('Template not found or not accessible');
          }
        } catch (error) {
          console.error('Error loading template:', error);
          setDocumentError('Failed to load template');
        }
      }
    };

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
    } else if (documentId) {
      loadTemplateData();
    } else {
      setDocumentError('No document or template provided');
    }
  }, [file, templateContent, documentId, user]);

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

    const defaultLabels = {
      signature: 'Signature',
      text: 'Text Field',
      date: 'Date',
      name: 'Full Name',
      email: 'Email Address',
      phone: 'Phone Number',
      custom: 'Custom Field',
    };

    const newField: SignatureField = {
      id: uuidv4(),
      x: Math.max(0, x - 50),
      y: Math.max(0, y - 15),
      width: selectedTool === 'signature' ? 150 : 100,
      height: 30,
      page: currentPage,
      type: selectedTool,
      label: defaultLabels[selectedTool],
      required: true,
      assignedTo: null,
      defaultValue: '',
    };

    setSignatureFields((prev) => [...prev, newField]);
    setIsAddingField(false);

    if (selectedTool === 'custom') {
      setEditingField(newField.id);
      setFieldLabel(newField.label);
    }
  };

  const handleFieldMouseDown = (event: React.MouseEvent, fieldId: string) => {
    event.stopPropagation();
    setSelectedField(fieldId);
    setIsDragging(true);

    const field = signatureFields.find((f) => f.id === fieldId);
    if (field) {
      dragStartRef.current = { x: event.clientX, y: event.clientY };
      originalPositionRef.current = { x: field.x, y: field.y };
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !selectedField || !pageRef.current) return;

    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;

    const container = pageRef.current;
    const field = signatureFields.find((f) => f.id === selectedField);
    if (!field) return;

    let newX = originalPositionRef.current.x + deltaX;
    let newY = originalPositionRef.current.y + deltaY;

    const maxX = container.clientWidth - field.width;
    const maxY = container.clientHeight - field.height;
    newX = Math.max(0, Math.min(maxX, newX));
    newY = Math.max(0, Math.min(maxY, newY));

    setSignatureFields((prev) =>
      prev.map((f) =>
        f.id === selectedField ? { ...f, x: newX, y: newY } : f
      )
    );
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleFieldDelete = (fieldId: string) => {
    setSignatureFields((prev) => prev.filter((field) => field.id !== fieldId));
    setSelectedField(null);
    setEditingField(null);
  };

  const updateFieldLabel = (fieldId: string, newLabel: string) => {
    setSignatureFields((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, label: newLabel } : field
      )
    );
  };

  const saveFieldLabel = () => {
    if (editingField) {
      updateFieldLabel(editingField, fieldLabel);
      setEditingField(null);
    }
  };

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
      setShowSignatureModal(false);
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Error saving signature. Please try again.');
    }
  };

  const clearSignature = () => {
    if (signatureCanvasRef.current) {
      signatureCanvasRef.current.clear();
    }
  };

  const handleSave = async () => {
    if (!user || (!file && !fileUrl)) {
      alert('You must be logged in and have a file to save the document.');
      return;
    }

    try {
      let pdfBytes;
      if (fileUrl) {
        pdfBytes = await fetch(fileUrl).then((res) => res.arrayBuffer());
      } else if (file) {
        pdfBytes = await fetch(URL.createObjectURL(file)).then((res) => res.arrayBuffer());
      } else {
        throw new Error('No document to save');
      }

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();

      for (const field of signatureFields) {
        const page = pdfDoc.getPage(field.page - 1);
        const fieldName = `${field.type}_${field.id}`;
        const textField = form.createTextField(fieldName);
        textField.addToPage(page, {
          x: field.x,
          y: page.getHeight() - field.y - field.height,
          width: field.width,
          height: field.height,
        });
        if (field.required) {
          textField.setText(field.defaultValue || (field.type === 'date' ? new Date().toISOString().split('T')[0] : field.label));
        }
      }

      const newPdfBytes = await pdfDoc.save();
      const editedFile = new File([newPdfBytes], `${file?.name || 'edited'}.pdf`, { type: 'application/pdf' });

      const document = await DocumentService.createDocument({
        id: uuidv4(),
        title: file?.name || templateName || 'Untitled Document',
        owner_id: user.id,
        status: 'draft',
        content: templateContent,
        is_template: saveAsTemplate,
      });
      const documentId = document.id;

      const publicUrl = await DocumentService.uploadDocumentFile(documentId, editedFile);
      await DocumentService.updateDocument(documentId, { file_url: publicUrl });

      if (signatureFields.length > 0) {
        const fieldInserts = signatureFields.map((field) => ({
          document_id: documentId,
          field_type: field.type,
          x_position: Math.round(field.x),
          y_position: Math.round(field.y),
          width: Math.round(field.width),
          height: Math.round(field.height),
          page_number: field.page,
          label: field.label,
          required: field.required,
          assigned_to: field.assignedTo,
        }));
        await DocumentService.saveSignatureFields(fieldInserts);
      }

      onSave(signatureFields, { id: documentId, title: document.title, file_url: publicUrl });
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Error saving document. Please try again.');
    }
  };

  const handleSendDocument = async () => {
    if (!file && !templateContent && !fileUrl) {
      alert('No document or template content to send.');
      return;
    }
    if (!user) {
      alert('You must be logged in to send a document.');
      return;
    }

    setLoading(true);
    setSendingStep('sending');

    try {
      const documentData: Database['public']['Tables']['documents']['Insert'] = {
        id: uuidv4(),
        title: file?.name || templateName || 'Untitled Document',
        owner_id: user.id,
        status: recipients.length > 0 ? 'sent' : 'draft',
        content: templateContent || null,
        created_at: new Date().toISOString(),
        is_template: saveAsTemplate,
      };

      const document = await DocumentService.createDocument(documentData);
      await DocumentService.logAccess({
        document_id: document.id,
        recipient_id: null,
        action: 'document_created',
        ip_address: 'unknown',
        user_agent: navigator.userAgent,
        location: 'unknown',
      });

      let fileUrlToUse = fileUrl;
      if (file) {
        fileUrlToUse = await DocumentService.uploadDocumentFile(document.id, file);
      }

      const signatureFieldsData: SignatureFieldData[] = signatureFields.map((field) => ({
        id: field.id,
        document_id: document.id,
        field_type: field.type,
        x_position: Math.round(field.x),
        y_position: Math.round(field.y),
        width: Math.round(field.width),
        height: Math.round(field.height),
        page_number: field.page,
        label: field.label,
        required: field.required,
        assigned_to: field.assignedTo || null,
      }));

      const savedFields = await DocumentService.saveSignatureFields(signatureFieldsData);

      if (recipients.length > 0) {
        const recipientData: RecipientData[] = recipients.map((recipient) => ({
          id: uuidv4(),
          document_id: document.id,
          email: recipient.email,
          name: recipient.name,
          role: recipient.role || 'signer',
          status: 'pending',
          signing_url_token: uuidv4(),
          token_expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        }));

        const addedRecipients = await DocumentService.addRecipients(recipientData);

        const recipientsToSend = addedRecipients.map((recipient) => ({
          email: recipient.email,
          signingUrl: `${window.location.origin}/sign/${document.id}/${recipient.signing_url_token}`,
        }));

        const subject = 'Your document is ready for signature';
        const text = `Please sign the document at %SIGNING_URL%. ${emailMessage ? `\n\n${emailMessage}` : ''}`;
        const html = `<p>Please sign the document at <a href="%SIGNING_URL%">this link</a>.</p>${emailMessage ? `<p>${emailMessage}</p>` : ''}`;

        const emailResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            recipients: recipientsToSend,
            subject,
            text,
            html,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          throw new Error(`Failed to send emails: ${errorData.error}`);
        }

        for (const recipient of addedRecipients) {
          await DocumentService.logAccess({
            document_id: document.id,
            recipient_id: recipient.id,
            action: 'email_sent',
            ip_address: 'unknown',
            user_agent: navigator.userAgent,
            location: 'unknown',
          });
        }
      }

      onSave(savedFields, { ...document, file_url: fileUrlToUse });
      setSendingStep('sent');
    } catch (error: any) {
      console.error('HandleSendDocument failed:', error);
      alert(`Failed to send document: ${error.message || 'Unknown error'}`);
      setSendingStep('compose');
      if (error.documentId) {
        await DocumentService.deleteDocument(error.documentId);
      }
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = () => {
    if (newRecipient.email && newRecipient.name) {
      const recipient: Recipient = {
        id: uuidv4(),
        email: newRecipient.email,
        name: newRecipient.name,
        role: newRecipient.role,
      };
      setRecipients((prev) => [...prev, recipient]);
      setNewRecipient({ email: '', name: '', role: 'Signer' });
    }
  };

  const removeRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const currentPageFields = signatureFields.filter((field) => field.page === currentPage);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-4 max-h-[95vh] overflow-hidden flex">
        {/* Left sidebar - Made scrollable with overflow-y-auto */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
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
            <p className="text-sm text-gray-600">{file?.name || templateName || 'Template Document'}</p>
            {isTemplate && (
              <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                Template
              </span>
            )}
          </div>

          {/* Tools section */}
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
                  setSelectedTool('name');
                  setIsAddingField(true);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  selectedTool === 'name' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Name Field</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTool('email');
                  setIsAddingField(true);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  selectedTool === 'email' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                }`}
              >
                <AtSign className="w-4 h-4" />
                <span>Email Field</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTool('phone');
                  setIsAddingField(true);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  selectedTool === 'phone' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                }`}
              >
                <Phone className="w-4 h-4" />
                <span>Phone Field</span>
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
                <Calendar className="w-4 h-4" />
                <span>Date Field</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTool('custom');
                  setIsAddingField(true);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  selectedTool === 'custom' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Custom Field</span>
              </button>
            </div>
            {isAddingField && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">Click on the document to place a {selectedTool} field</p>
              </div>
            )}
          </div>

          {/* Field properties editor */}
          {selectedField && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Field Properties</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Field Label
                  </label>
                  <input
                    type="text"
                    value={signatureFields.find((f) => f.id === selectedField)?.label || ''}
                    onChange={(e) => updateFieldLabel(selectedField, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={signatureFields.find((f) => f.id === selectedField)?.required || false}
                      onChange={(e) => {
                        setSignatureFields((prev) =>
                          prev.map((field) =>
                            field.id === selectedField ? { ...field, required: e.target.checked } : field
                          )
                        );
                      }}
                      className="rounded text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">Required Field</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Fields list */}
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

          {/* Action buttons */}
          <div className="p-6 border-t border-gray-200">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="saveAsTemplate"
                  checked={saveAsTemplate}
                  onChange={() => setSaveAsTemplate(!saveAsTemplate)}
                  className="form-checkbox h-5 w-5 text-blue-600"
                />
                <label htmlFor="saveAsTemplate" className="text-sm text-gray-700">
                  Save as Template
                </label>
              </div>
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

        {/* Main document area */}
        <div className="flex-1 flex flex-col">
          {/* Page navigation */}
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
                {selectedTool === 'select'
                  ? 'Select and drag fields to move them'
                  : isAddingField
                  ? `Click to place ${selectedTool} field`
                  : ''}
              </div>
            </div>
          )}

          {/* Document viewer */}
          <div className="flex-1 overflow-auto bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
              <div
                ref={pageRef}
                className="relative bg-white shadow-lg min-h-[600px]"
                onClick={handlePageClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isAddingField ? 'crosshair' : isDragging ? 'grabbing' : 'default' }}
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
                  <div
                    className="min-h-[800px] p-8"
                    dangerouslySetInnerHTML={{ __html: templateContent || '' }}
                  />
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

                {/* Signature fields overlay */}
                {documentLoaded &&
                  currentPageFields.map((field) => (
                    <div
                      key={field.id}
                      className={`absolute border-2 rounded cursor-move flex items-center justify-center text-center text-xs font-medium ${
                        selectedField === field.id ? 'border-blue-500 bg-blue-100/50' : 'border-gray-400 bg-gray-100/50'
                      } ${field.required ? 'border-dashed' : 'border-solid'}`}
                      style={{
                        left: field.x,
                        top: field.y,
                        width: field.width,
                        height: field.height,
                      }}
                      onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                    >
                      <span className="text-gray-700">{field.label}</span>
                      {field.type === 'signature' && (
                        <Edit3 className="absolute top-1 right-1 w-4 h-4 text-gray-500" />
                      )}
                      {field.type === 'date' && (
                        <Calendar className="absolute top-1 right-1 w-4 h-4 text-gray-500" />
                      )}
                      {field.type === 'name' && (
                        <User className="absolute top-1 right-1 w-4 h-4 text-gray-500" />
                      )}
                      {field.type === 'email' && (
                        <AtSign className="absolute top-1 right-1 w-4 h-4 text-gray-500" />
                      )}
                      {field.type === 'phone' && (
                        <Phone className="absolute top-1 right-1 w-4 h-4 text-gray-500" />
                      )}
                      {field.type === 'custom' && (
                        <Type className="absolute top-1 right-1 w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Signature modal */}
        {showSignatureModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Create Signature</h3>
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SignatureCanvas
                ref={signatureCanvasRef}
                canvasProps={{
                  className: 'border border-gray-300 rounded-lg w-full h-48',
                }}
              />
              <div className="flex justify-between mt-4">
                <button
                  onClick={clearSignature}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Clear
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
        )}

        {/* Send document modal */}
        {showSendModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              {sendingStep === 'compose' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Send Document</h3>
                    <button
                      onClick={() => setShowSendModal(false)}
                      className="p-2 hover:bg-gray-200 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Recipients</h4>
                      {recipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                        >
                          <div>
                            <p className="text-sm font-medium">{recipient.name}</p>
                            <p className="text-xs text-gray-500">{recipient.email} ({recipient.role})</p>
                          </div>
                          <button
                            onClick={() => removeRecipient(recipient.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                            <input
                              type="text"
                              value={newRecipient.name}
                              onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              placeholder="Enter name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <input
                              type="email"
                              value={newRecipient.email}
                              onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              placeholder="Enter email"
                            />
                          </div>
                        </div>
                        <div className="mt-4">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                          <select
                            value={newRecipient.role}
                            onChange={(e) => setNewRecipient({ ...newRecipient, role: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="Signer">Signer</option>
                            <option value="Viewer">Viewer</option>
                            <option value="Approver">Approver</option>
                          </select>
                        </div>
                        <button
                          onClick={addRecipient}
                          className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Add Recipient</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Message (Optional)</label>
                      <textarea
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        rows={4}
                        placeholder="Add a message to the recipients"
                      />
                    </div>
                    <button
                      onClick={handleSendDocument}
                      disabled={recipients.length === 0 || loading}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Document</span>
                    </button>
                  </div>
                </>
              )}
              {sendingStep === 'sending' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Sending document...</p>
                </div>
              )}
              {sendingStep === 'sent' && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Document Sent!</h3>
                  <p className="text-gray-600 mb-4">Your document has been sent to all recipients.</p>
                  <button
                    onClick={() => {
                      setShowSendModal(false);
                      setSendingStep('compose');
                      setRecipients([]);
                      setEmailMessage('');
                      onClose();
                    }}
                    className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom field label modal */}
        {editingField && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4">Edit Field Label</h3>
              <input
                type="text"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                placeholder="Enter field label"
              />
              <div className="flex justify-between">
                <button
                  onClick={() => setEditingField(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFieldLabel}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentEditor;