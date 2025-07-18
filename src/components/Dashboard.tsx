import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DocumentService } from '../services/documentService';
import {
  Plus,
  Search,
  Filter,
  FileText,
  CheckCircle,
  AlertCircle,
  Users,
  Download,
  MoreHorizontal,
  Eye,
  Edit3,
  Upload,
  Send,
  Mail,
  MessageSquare,
  Trash2
} from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import DocumentEditor from './DocumentEditor';
import DocumentViewer from './DocumentViewer';
import AIChat from './AIChat';
import { v4 as uuidv4 } from 'uuid';

interface DashboardProps {
  user: { id: string; name: string; email: string };
  onPageChange: (page: string) => void;
}

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

interface Document {
  id: string;
  title: string;
  owner_id: string;
  status: 'draft' | 'sent' | 'signed' | 'completed';
  file_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  recipients: Array<{
    id: string;
    email: string;
    name?: string | null;
    status: 'pending' | 'viewed' | 'signed';
    signing_url_token?: string | null;
    signatures?: Array<{
      id: string;
      recipient_id: string;
      signed_at: string;
    }> | null;
  }>;
  is_template?: boolean;
  signature_fields?: SignatureField[];
}

interface SentDocument {
  id: string;
  title: string;
  status: 'sent' | 'signed' | 'completed';
  sentAt: string;
  recipients: Array<{
    email: string;
    name: string;
    status: 'pending' | 'viewed' | 'signed';
    signedAt?: string;
    signingUrl?: string;
    accessLogs: Array<{
      action: string;
      timestamp: string;
      ip_address: string;
      user_agent: string;
      location: string;
    }>;
  }>;
}

interface SelectedDocument {
  url: string;
  id: string;
}

interface SignatureField {
  id: string;
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
  signature_data?: string | null;
}

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid != null && uuidRegex.test(uuid);
};

const Dashboard: React.FC<DashboardProps> = ({ user, onPageChange }) => {
  const [activeTab, setActiveTab] = useState<'documents' | 'sent' | 'templates'>('documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sentDocuments, setSentDocuments] = useState<SentDocument[]>([]);
  const [myTemplates, setMyTemplates] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDocumentEditor, setShowDocumentEditor] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Document | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocument | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [isTemplateUpload, setIsTemplateUpload] = useState(false);

  const memoizedFields = useMemo(() => fields || [], [fields]);

  useEffect(() => {
    setFields([]);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!isValidUUID(user.id)) {
        setError('Invalid user ID');
        setLoading(false);
        return;
      }
  
      try {
        setLoading(true);
        setError(null);
        const [docs, sentDocs, userTemplates] = await Promise.all([
          DocumentService.getDocumentsWithDetails(user.id, searchTerm),
          DocumentService.getSentDocuments(user.id),
          DocumentService.getMyTemplatesWithFields(user.id),
        ]);
  
        setDocuments(docs);
        setSentDocuments(
          sentDocs.map((doc: Document) => ({
            id: doc.id,
            title: doc.title,
            status: doc.status,
            sentAt: doc.updated_at || doc.created_at,
            recipients: doc.recipients.map((recipient) => ({
              email: recipient.email,
              name: recipient.name || 'Unknown',
              status: recipient.status,
              signedAt: recipient.signatures?.[0]?.signed_at,
              signingUrl: recipient.signing_url_token
                ? `/sign/${doc.id}/${recipient.signing_url_token}`
                : undefined,
              accessLogs: [],
            })),
          }))
        );
        setMyTemplates(userTemplates);
      } catch (error: any) {
        console.error('Error loading data:', error);
        setError(error.message || 'Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user.id, searchTerm]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    if (!isValidUUID(documentId)) {
      alert('Invalid document ID');
      return;
    }
    
    try {
      await DocumentService.deleteDocument(documentId);
      
      // Update documents state (all documents tab)
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      // Update sent documents state
      setSentDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      // Update templates state
      setMyTemplates(prev => prev.filter(template => template.id !== documentId));
      
      alert('Document deleted successfully');
    } catch (error: any) {
      console.error('Error deleting document:', error);
      alert(error.message || 'Failed to delete document. Please try again.');
    }
  }, []);

  const handleDownload = useCallback(
    async (fileUrl: string, filename: string) => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch document');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error: any) {
        console.error('Error downloading document:', error);
        alert(error.message || 'Failed to download document. Please try again.');
      }
    },
    []
  );

  const handleDocumentView = useCallback((fileUrl: string, documentId: string) => {
    if (!isValidUUID(documentId)) {
      alert('Invalid document ID');
      return;
    }
    setSelectedDocument({ url: fileUrl, id: documentId });
    setShowDocumentViewer(true);
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'signed':
        return 'bg-blue-100 text-blue-800';
      case 'sent':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'viewed':
        return 'bg-purple-100 text-purple-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'signed':
        return <CheckCircle className="w-4 h-4" />;
      case 'sent':
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      case 'viewed':
        return <Eye className="w-4 h-4" />;
      case 'draft':
        return <Edit3 className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  }, []);

  const handleTemplateUse = useCallback(async (template: Document) => {
    if (!template.file_url) {
      alert('Template file not found');
      return;
    }

    try {
      const response = await fetch(template.file_url);
      if (!response.ok) throw new Error('Failed to fetch template file');
      const blob = await response.blob();
      
      const file = new File([blob], template.title, { type: blob.type });

      setSelectedFile({
        id: uuidv4(),
        file,
        name: template.title,
        size: blob.size,
        type: blob.type,
        uploadedAt: new Date(),
      });
      
      setFields(template.signature_fields || []);
      setSelectedTemplate(template);
      setShowDocumentViewer(false);
      setShowDocumentEditor(true);
      setIsTemplateUpload(false);
    } catch (error: any) {
      console.error('Error loading template file:', error);
      alert(error.message || 'Failed to load template. Please try again.');
    }
  }, []);

  const handleTemplateView = useCallback((template: Document) => {
    setSelectedTemplate(template);
    setShowDocumentViewer(true);
  }, []);

  const handleFileSelect = useCallback((file: UploadedFile) => {
    setSelectedFile(file);
    setShowUploadModal(false);
    setShowDocumentEditor(true);
    setIsTemplateUpload(false);
  }, []);

  const handleTemplateFileSelect = useCallback((file: UploadedFile) => {
    setSelectedFile(file);
    setShowUploadModal(false);
    setShowDocumentEditor(true);
    setIsTemplateUpload(true);
  }, []);

  const handleDocumentSave = useCallback(
    async (fields: SignatureField[], documentData?: any) => {
      try {
        if (!isValidUUID(user.id)) {
          setError('Invalid user ID');
          return;
        }
        
        // Refresh all document types
        const [docs, sentDocs, userTemplates] = await Promise.all([
          DocumentService.getDocumentsWithDetails(user.id),
          DocumentService.getSentDocuments(user.id),
          DocumentService.getMyTemplatesWithFields(user.id),
        ]);
        
        setDocuments(docs);
        setSentDocuments(
          sentDocs.map((doc: Document) => ({
            id: doc.id,
            title: doc.title,
            status: doc.status,
            sentAt: doc.updated_at || doc.created_at,
            recipients: doc.recipients.map((recipient) => ({
              email: recipient.email,
              name: recipient.name || 'Unknown',
              status: recipient.status,
              signedAt: recipient.signatures?.[0]?.signed_at,
              signingUrl: recipient.signing_url_token
                ? `/sign/${doc.id}/${recipient.signing_url_token}`
                : undefined,
              accessLogs: [],
            })),
          }))
        );
        setMyTemplates(userTemplates);
        
      } catch (error: any) {
        console.error('Error refreshing documents:', error);
        setError(error.message || 'Failed to refresh documents');
      }
      
      // Reset UI states
      setShowDocumentEditor(false);
      setSelectedFile(null);
      setSelectedTemplate(null);
      setIsTemplateUpload(false);
      setFields([]);
    },
    [user.id]
  );

  const getRecipientStatusSummary = useCallback((recipients: SentDocument['recipients']) => {
    const signed = recipients.filter((r) => r.status === 'signed').length;
    const total = recipients.length;
    return `${signed}/${total} signed`;
  }, []);

  const copySigningUrl = useCallback((url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard
      .writeText(fullUrl)
      .then(() => {
        alert('Signing URL copied to clipboard!');
      })
      .catch((err) => {
        console.error('Failed to copy URL:', err);
        alert('Failed to copy URL. Please try again.');
      });
  }, []);

  const filteredMyTemplates = useMemo(
    () => myTemplates.filter((template) => template.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [myTemplates, searchTerm]
  );

  const filteredSentDocuments = useMemo(
    () => sentDocuments.filter((doc) => doc.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [sentDocuments, searchTerm]
  );

  const filteredDocuments = useMemo(
    () => documents.filter((doc) => doc.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [documents, searchTerm]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-900 via-purple-900 to-indigo-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-blue-100">Welcome back, {user.name || 'User'}</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowUploadModal(true);
                    setIsTemplateUpload(false);
                  }}
                  className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg hover:bg-white/30 transition-colors flex items-center space-x-2 border border-white/30"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload Document</span>
                </button>
                <button
                  onClick={() => {
                    setShowUploadModal(true);
                    setIsTemplateUpload(true);
                  }}
                  className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg hover:bg-white/30 transition-colors flex items-center space-x-2 border border-white/30"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload Template</span>
                </button>
                <button
                  onClick={() => setShowAIChat(true)}
                  className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg hover:bg-white/30 transition-colors flex items-center space-x-2 border border-white/30"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>AI Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Documents</p>
                <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Send className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Sent for Signature</p>
                <p className="text-2xl font-bold text-gray-900">{sentDocuments.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {documents.filter((doc) => doc.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Recipients</p>
                <p className="text-2xl font-bold text-gray-900">
                  {documents.reduce((sum, doc) => sum + (doc.recipients?.length || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('documents')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'documents'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Documents
              </button>
              <button
                onClick={() => setActiveTab('sent')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sent'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Sent for Signature
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Templates
              </button>
            </nav>
          </div>

          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="w-5 h-5" />
                <span>Filter</span>
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'documents' ? (
              loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
                  <p className="text-gray-600 mb-4">Get started by uploading your first document</p>
                  <button
                    onClick={() => {
                      setShowUploadModal(true);
                      setIsTemplateUpload(false);
                    }}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Upload Document
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{doc.title}</h3>
                          <p className="text-sm text-gray-600">
                            {doc.recipients?.length || 0} recipient{(doc.recipients?.length || 0) !== 1 ? 's' : ''} •{' '}
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                          {getStatusIcon(doc.status)}
                          <span className="capitalize">{doc.status}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => doc.file_url && handleDocumentView(doc.file_url, doc.id)}
                            disabled={!doc.file_url}
                            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="View document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => doc.file_url && handleDownload(doc.file_url, doc.title)}
                            disabled={!doc.file_url}
                            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Download document"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                              className="p-2 text-gray-400 hover:text-gray-600"
                              title="More actions"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {openMenuId === doc.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      console.log('Edit document', doc.id);
                                      setOpenMenuId(null);
                                    }}
                                    className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <Edit3 className="w-4 h-4 mr-2" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm('Are you sure you want to delete this document?')) {
                                        handleDeleteDocument(doc.id);
                                      }
                                      setOpenMenuId(null);
                                    }}
                                    className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === 'sent' ? (
              <div className="space-y-4">
                {filteredSentDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <Send className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No sent documents</h3>
                    <p className="text-gray-600">You haven't sent any documents for signature yet.</p>
                  </div>
                ) : (
                  filteredSentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Send className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{doc.title}</h3>
                            <p className="text-sm text-gray-600">
                              Sent on {new Date(doc.sentAt).toLocaleDateString()} •{' '}
                              {getRecipientStatusSummary(doc.recipients)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div
                            className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              doc.status
                            )}`}
                          >
                            {getStatusIcon(doc.status)}
                            <span className="capitalize">{doc.status}</span>
                          </div>
                          <button
                            onClick={() =>
                              doc.recipients[0]?.signingUrl &&
                              handleDocumentView(doc.recipients[0].signingUrl.replace(/\/sign\//, ''), doc.id)
                            }
                            disabled={!doc.recipients[0]?.signingUrl}
                            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="View document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="ml-14">
                        <div className="space-y-3">
                          {doc.recipients.map((recipient, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <Mail className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-900 font-medium">{recipient.name}</span>
                                  <span className="text-gray-500">({recipient.email})</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      recipient.status === 'signed'
                                        ? 'bg-green-100 text-green-800'
                                        : recipient.status === 'viewed'
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                  >
                                    {recipient.status}
                                  </span>
                                  {recipient.signedAt && (
                                    <span className="text-xs text-gray-500">
                                      Signed {new Date(recipient.signedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {recipient.signingUrl && (
                                <div className="mb-2">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-medium text-gray-700">Signing URL:</span>
                                    <button
                                      onClick={() => copySigningUrl(recipient.signingUrl!)}
                                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                                    >
                                      Copy Link
                                    </button>
                                  </div>
                                  <code className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded block mt-1 truncate">
                                    {window.location.origin}{recipient.signingUrl}
                                  </code>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this sent document?')) {
                              handleDeleteDocument(doc.id);
                            }
                          }}
                          className="mt-4 flex items-center text-sm text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          <span>Delete Document</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold mb-4">My Templates</h2>
                  {filteredMyTemplates.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No templates uploaded</h3>
                      <p className="text-gray-600 mb-4">Upload a document and save it as a template to get started.</p>
                      <button
                        onClick={() => {
                          setShowUploadModal(true);
                          setIsTemplateUpload(true);
                        }}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Upload Template
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredMyTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="bg-gray-50 p-6 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="text-xs text-gray-500">
                              Created on {new Date(template.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="font-medium text-gray-900 mb-2">{template.title}</h3>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500 uppercase">Custom Template</span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleTemplateView(template)}
                                className="text-gray-600 hover:text-gray-700 text-sm font-medium flex items-center space-x-1"
                              >
                                <Eye className="w-4 h-4" />
                                <span>View</span>
                              </button>
                              <button
                                onClick={() => handleTemplateUse(template)}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                Use Template
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete this template?')) {
                                    handleDeleteDocument(template.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showUploadModal && (
        <DocumentUpload
          onFileSelect={isTemplateUpload ? handleTemplateFileSelect : handleFileSelect}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      {showDocumentEditor && (
        <DocumentEditor
          file={selectedFile?.file}
          initialFields={fields}
          templateContent={
            selectedTemplate
              ? `
                <div class="p-8 bg-white min-h-[800px] font-serif">
                  <div class="text-center mb-8">
                    <h1 class="text-2xl font-bold mb-2">${selectedTemplate.title.toUpperCase()}</h1>
                    <div class="w-24 h-0.5 bg-gray-400 mx-auto"></div>
                  </div>
                  <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-8">
                      <div>
                        <p class="font-semibold mb-2">Party A:</p>
                        <div class="border-b border-gray-400 pb-1 mb-4">
                          <span class="bg-yellow-200 px-2 py-1 text-sm">[PARTY_A_NAME]</span>
                        </div>
                      </div>
                      <div>
                        <p class="font-semibold mb-2">Party B:</p>
                        <div class="border-b border-gray-400 pb-1 mb-4">
                          <span class="bg-blue-200 px-2 py-1 text-sm">[PARTY_B_NAME]</span>
                        </div>
                      </div>
                    </div>
                    <div class="mt-8">
                      <p class="text-justify leading-relaxed">
                        This ${selectedTemplate.title} is entered into on 
                        <span class="bg-green-200 px-1 mx-1">[DATE]</span> 
                        by and between the parties identified above.
                      </p>
                    </div>
                    <div class="mt-12 grid grid-cols-2 gap-8">
                      <div class="text-center">
                        <div class="border-t border-gray-400 pt-2 mt-16">
                          <p class="font-semibold">Party A Signature</p>
                          <div class="bg-red-200 px-2 py-1 mt-2 text-sm">[SIGNATURE_1]</div>
                        </div>
                      </div>
                      <div class="text-center">
                        <div class="border-t border-gray-400 pt-2 mt-16">
                          <p class="font-semibold">Party B Signature</p>
                          <div class="bg-red-200 px-2 py-1 mt-2 text-sm">[SIGNATURE_2]</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              `
              : undefined
          }
          templateName={selectedTemplate?.title}
          documentId={isTemplateUpload ? selectedTemplate?.id : undefined}
          isTemplateUpload={isTemplateUpload}
          onClose={() => {
            setShowDocumentEditor(false);
            setSelectedFile(null);
            setSelectedTemplate(null);
            setIsTemplateUpload(false);
            setFields([]);
          }}
          onSave={handleDocumentSave}
        />
      )}

      {showDocumentViewer && selectedDocument && (
        <DocumentViewer
          key={selectedDocument.id}
          fileUrl={selectedDocument.url}
          documentId={selectedDocument.id}
          onClose={() => {
            setShowDocumentViewer(false);
            setSelectedDocument(null);
          }}
          isSigningEnabled={false}
          fields={memoizedFields}
        />
      )}

      {showDocumentViewer && selectedTemplate && (
        <DocumentViewer
          key={selectedTemplate.id}
          fileUrl={selectedTemplate.file_url || ''}
          documentId={selectedTemplate.id}
          onClose={() => {
            setShowDocumentViewer(false);
            setSelectedTemplate(null);
          }}
          isSigningEnabled={false}
          fields={memoizedFields}
        />
      )}

      {showAIChat && (
        <AIChat
          onClose={() => setShowAIChat(false)}
          onSave={(file) => {
            setSelectedFile({
              id: uuidv4(),
              file,
              name: 'AI Generated Document.pdf',
              size: file.size,
              type: file.type,
              uploadedAt: new Date(),
            });
            setShowAIChat(false);
            setShowDocumentEditor(true);
            setIsTemplateUpload(false);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;