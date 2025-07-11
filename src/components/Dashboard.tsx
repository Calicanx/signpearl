import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Template, Page } from '../types';
import DocumentUpload from './DocumentUpload';
import DocumentEditor from './DocumentEditor';
import DocumentViewer from './DocumentViewer';
import TemplateViewer from './TemplateViewer';

// Define the props interface for the Dashboard component
interface DashboardProps {
  user: { id: string; name: string; email: string };
  onPageChange: (page: Page) => void;
}

// Interface for uploaded files
interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

// Interface for document data (aligned with DocumentService)
interface Document {
  id: string;
  title: string;
  owner_id: string;
  status: 'draft' | 'sent' | 'signed' | 'completed';
  content?: string | null;
  file_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  recipients: Array<{
    id: string;
    email: string;
    name: string;
    status: 'pending' | 'viewed' | 'signed';
    signing_url_token?: string | null;
    signatures?: Array<{
      id: string;
      recipient_id: string;
      signed_at: string;
    }> | null;
  }>;
}

// Interface for sent documents (for consistency with mock data)
interface SentDocument {
  id: string;
  title: string;
  status: 'sent' | 'viewed' | 'signed' | 'completed';
  sentAt: string;
  recipients: Array<{
    email: string;
    name: string;
    status: 'pending' | 'viewed' | 'signed';
    signedAt?: string;
    signingUrl?: string;
    accessLogs?: Array<{
      action: string;
      timestamp: string;
      ipAddress: string;
      userAgent: string;
      location: string;
    }>;
  }>;
}

// Interface for selected document
interface SelectedDocument {
  url: string;
  id: string;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onPageChange }) => {
  const [activeTab, setActiveTab] = useState('documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDocumentEditor, setShowDocumentEditor] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [showTemplateViewer, setShowTemplateViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocument | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sentDocuments] = useState<SentDocument[]>([
    {
      id: '1',
      title: 'Service Agreement - ABC Corp',
      status: 'signed',
      sentAt: '2024-01-15',
      recipients: [
        {
          email: 'john@abccorp.com',
          name: 'John Smith',
          status: 'signed',
          signedAt: '2024-01-16',
          signingUrl: '/sign/1/rec1',
          accessLogs: [
            { action: 'email_sent', timestamp: '2024-01-15T10:00:00Z', ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0...', location: 'New York, US' },
            { action: 'document_viewed', timestamp: '2024-01-15T14:30:00Z', ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0...', location: 'New York, US' },
            { action: 'document_signed', timestamp: '2024-01-16T09:15:00Z', ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0...', location: 'New York, US' },
          ],
        },
        {
          email: 'jane@abccorp.com',
          name: 'Jane Doe',
          status: 'pending',
          signingUrl: '/sign/1/rec2',
          accessLogs: [
            { action: 'email_sent', timestamp: '2024-01-15T10:00:00Z', ipAddress: '192.168.1.101', userAgent: 'Mozilla/5.0...', location: 'New York, US' },
          ],
        },
      ],
    },
    {
      id: '2',
      title: 'NDA - Tech Startup',
      status: 'completed',
      sentAt: '2024-01-14',
      recipients: [
        {
          email: 'founder@techstartup.com',
          name: 'Mike Johnson',
          status: 'signed',
          signedAt: '2024-01-15',
          signingUrl: '/sign/2/rec3',
          accessLogs: [
            { action: 'email_sent', timestamp: '2024-01-14T15:00:00Z', ipAddress: '10.0.0.50', userAgent: 'Mozilla/5.0...', location: 'San Francisco, US' },
            { action: 'document_viewed', timestamp: '2024-01-14T16:45:00Z', ipAddress: '10.0.0.50', userAgent: 'Mozilla/5.0...', location: 'San Francisco, US' },
            { action: 'document_signed', timestamp: '2024-01-15T08:30:00Z', ipAddress: '10.0.0.50', userAgent: 'Mozilla/5.0...', location: 'San Francisco, US' },
          ],
        },
      ],
    },
  ]);

  // Effect to load documents when the component mounts or user.id changes
  useEffect(() => {
    loadDocuments();
  }, [user.id]);

  // Function to fetch documents from DocumentService
  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await DocumentService.getDocumentsWithDetails(user.id);
      setDocuments(docs);
    } catch (error: any) {
      console.error('Error loading documents:', error);
      setError(error.message || 'Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to handle document download
  const handleDownload = async (fileUrl: string, filename: string) => {
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
  };

  // Function to handle document view
  const handleDocumentView = (fileUrl: string, documentId: string) => {
    setSelectedDocument({ url: fileUrl, id: documentId });
    setShowDocumentViewer(true);
  };

  // Mock template data
  const templates: Template[] = [
    { id: '1', name: 'Non-Disclosure Agreement', category: 'Legal', description: 'Standard NDA template for confidential information', usage: 145 },
    { id: '2', name: 'Service Agreement', category: 'Business', description: 'Professional services contract template', usage: 89 },
    { id: '3', name: 'Employment Contract', category: 'HR', description: 'Full-time employment agreement template', usage: 67 },
    { id: '4', name: 'Partnership Agreement', category: 'Business', description: 'Business partnership contract template', usage: 34 },
  ];

  // Function to determine status color based on document status
  const getStatusColor = (status: string) => {
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
  };

  // Function to determine status icon based on document status
  const getStatusIcon = (status: string) => {
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
  };

  // Filter templates based on search term
  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter sent documents based on search term
  const filteredSentDocuments = sentDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle file selection from upload modal
  const handleFileSelect = (file: UploadedFile) => {
    setSelectedFile(file);
    setShowUploadModal(false);
    setShowDocumentEditor(true);
  };

  // Handle template viewing
  const handleTemplateView = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplateViewer(true);
  };

  // Handle template usage (opens editor with template content)
  const handleTemplateUse = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplateViewer(false);
    setShowDocumentEditor(true);
  };

  // Handle document save and refresh document list
  const handleDocumentSave = (fields: any[], documentData?: any) => {
    console.log('Saving document with fields:', fields);
    console.log('Document data:', documentData);
    loadDocuments();
    setShowDocumentEditor(false);
    setSelectedFile(null);
    setSelectedTemplate(null);
  };

  // Summarize recipient status for sent documents
  const getRecipientStatusSummary = (recipients: SentDocument['recipients']) => {
    const signed = recipients.filter((r) => r.status === 'signed').length;
    const total = recipients.length;
    return `${signed}/${total} signed`;
  };

  // Copy signing URL to clipboard
  const copySigningUrl = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      alert('Signing URL copied to clipboard!');
    }).catch((err) => {
      console.error('Failed to copy URL:', err);
      alert('Failed to copy URL. Please try again.');
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header section with gradient background */}
      <div className="bg-gradient-to-r from-blue-900 via-purple-900 to-indigo-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-blue-100">Welcome back, {user.name}</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg hover:bg-white/30 transition-colors flex items-center space-x-2 border border-white/30"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload Document</span>
                </button>
                <button
                  onClick={() => setShowDocumentEditor(true)}
                  className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg hover:bg-white/30 transition-colors flex items-center space-x-2 border border-white/30"
                >
                  <Plus className="w-5 h-5" />
                  <span>New Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error message */}
        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        {/* Summary cards */}
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
                <p className="text-2xl font-bold text-gray-900">{documents.filter((doc) => doc.status === 'completed').length}</p>
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
                <p className="text-2xl font-bold text-gray-900">{documents.reduce((sum, doc) => sum + (doc.recipients?.length || 0), 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed content area */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          {/* Navigation tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('documents')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'documents' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Documents
              </button>
              <button
                onClick={() => setActiveTab('sent')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'sent' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Sent for Signature
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'templates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Templates
              </button>
            </nav>
          </div>

          {/* Search and filter bar */}
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

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'documents' ? (
              loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
                  <p className="text-gray-600 mb-4">Get started by uploading your first document</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Upload Document
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents
                    .filter((doc) => doc.title.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{doc.title}</h3>
                            <p className="text-sm text-gray-600">
                              {doc.recipients?.length || 0} recipient{(doc.recipients?.length || 0) !== 1 ? 's' : ''} • {new Date(doc.created_at).toLocaleDateString()}
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
                                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (window.confirm('Are you sure you want to delete this document?')) {
                                          try {
                                            await DocumentService.deleteDocument(doc.id);
                                            await loadDocuments();
                                          } catch (error: any) {
                                            console.error('Error deleting document:', error);
                                            alert(error.message || 'Failed to delete document. Please try again.');
                                          }
                                        }
                                        setOpenMenuId(null);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      Delete
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
                    <div key={doc.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Send className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{doc.title}</h3>
                            <p className="text-sm text-gray-600">
                              Sent on {new Date(doc.sentAt).toLocaleDateString()} • {getRecipientStatusSummary(doc.recipients)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                            {getStatusIcon(doc.status)}
                            <span className="capitalize">{doc.status}</span>
                          </div>
                          <button className="p-2 text-gray-400 hover:text-gray-600">
                            <MoreHorizontal className="w-4 h-4" />
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
                                    <span className="text-xs text-gray-500">Signed {new Date(recipient.signedAt).toLocaleDateString()}</span>
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
                              {recipient.accessLogs && recipient.accessLogs.length > 0 && (
                                <div className="mt-2">
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-gray-700 font-medium hover:text-gray-900">
                                      Access History ({recipient.accessLogs.length} events)
                                    </summary>
                                    <div className="mt-2 space-y-1 pl-4 border-l-2 border-gray-200">
                                      {recipient.accessLogs.map((log, logIndex) => (
                                        <div key={logIndex} className="text-xs text-gray-600">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium capitalize">{log.action.replace('_', ' ')}</span>
                                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                                          </div>
                                          <div className="text-gray-500">IP: {log.ipAddress} • {log.location}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-12 col-span-full">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                    <p className="text-gray-600">Try adjusting your search term.</p>
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <div key={template.id} className="bg-gray-50 p-6 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-xs text-gray-500">{template.usage} uses</span>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-2">{template.name}</h3>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{template.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 uppercase">{template.category}</span>
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
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showUploadModal && (
        <DocumentUpload
          onFileSelect={handleFileSelect}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      {showDocumentEditor && (
        <DocumentEditor
          file={selectedFile?.file}
          templateContent={
            selectedTemplate
              ? `
            <div class="p-8 bg-white min-h-[800px] font-serif">
              <div class="text-center mb-8">
                <h1 class="text-2xl font-bold mb-2">${selectedTemplate.name.toUpperCase()}</h1>
                <div class="w-24 h-0.5 bg-gray-400 mx-auto"></div>
              </div>
              <div class="space-y-6">
                <div class="grid grid-cols-2 gap-8">
                  <div>
                    <p class="font-semibold mb-2">Party A (Disclosing Party):</p>
                    <div class="border-b border-gray-400 pb-1 mb-4">
                      <span class="bg-yellow-200 px-2 py-1 text-sm">[COMPANY_NAME]</span>
                    </div>
                  </div>
                  <div>
                    <p class="font-semibold mb-2">Party B (Receiving Party):</p>
                    <div class="border-b border-gray-400 pb-1 mb-4">
                      <span class="bg-blue-200 px-2 py-1 text-sm">[RECIPIENT_NAME]</span>
                    </div>
                  </div>
                </div>
                <div class="mt-8">
                  <p class="text-justify leading-relaxed">
                    This ${selectedTemplate.name} ("Agreement") is entered into on 
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
          templateName={selectedTemplate?.name}
          onClose={() => {
            setShowDocumentEditor(false);
            setSelectedFile(null);
            setSelectedTemplate(null);
          }}
          onSave={handleDocumentSave}
        />
      )}

      {showDocumentViewer && selectedDocument && (
        <DocumentViewer
          fileUrl={selectedDocument.url}
          documentId={selectedDocument.id}
          onClose={() => {
            setShowDocumentViewer(false);
            setSelectedDocument(null);
          }}
          isSigningEnabled={false}
        />
      )}

      {showTemplateViewer && selectedTemplate && (
        <TemplateViewer
          template={selectedTemplate}
          onClose={() => {
            setShowTemplateViewer(false);
            setSelectedTemplate(null);
          }}
          onUseTemplate={handleTemplateUse}
        />
      )}
    </div>
  );
};

export default Dashboard;