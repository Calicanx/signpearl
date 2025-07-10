import React, { useState } from 'react';
import { X, Download, Edit3, Share2 } from 'lucide-react';
import { Template } from '../types';

interface TemplateViewerProps {
  template: Template;
  onClose: () => void;
  onUseTemplate: (template: Template) => void;
}

const TemplateViewer: React.FC<TemplateViewerProps> = ({ template, onClose, onUseTemplate }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'details'>('preview');

  // Mock template content - in a real app, this would be fetched from an API
  const templateContent = {
    pages: [
      {
        id: 1,
        content: `
          <div class="p-8 bg-white min-h-[800px] font-serif">
            <div class="text-center mb-8">
              <h1 class="text-2xl font-bold mb-2">${template.name.toUpperCase()}</h1>
              <div class="w-24 h-0.5 bg-gray-400 mx-auto"></div>
            </div>
            
            <div class="space-y-6">
              <div class="grid grid-cols-2 gap-8">
                <div>
                  <p class="font-semibold mb-2">Party A (Disclosing Party):</p>
                  <div class="border-b border-gray-400 pb-1 mb-4">
                    <span class="bg-yellow-200 px-2 py-1 text-sm">[COMPANY_NAME]</span>
                  </div>
                  <div class="space-y-2 text-sm">
                    <div class="border-b border-gray-300 pb-1">
                      <span class="bg-yellow-200 px-1">[ADDRESS]</span>
                    </div>
                    <div class="border-b border-gray-300 pb-1">
                      <span class="bg-yellow-200 px-1">[CITY, STATE, ZIP]</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p class="font-semibold mb-2">Party B (Receiving Party):</p>
                  <div class="border-b border-gray-400 pb-1 mb-4">
                    <span class="bg-blue-200 px-2 py-1 text-sm">[RECIPIENT_NAME]</span>
                  </div>
                  <div class="space-y-2 text-sm">
                    <div class="border-b border-gray-300 pb-1">
                      <span class="bg-blue-200 px-1">[RECIPIENT_ADDRESS]</span>
                    </div>
                    <div class="border-b border-gray-300 pb-1">
                      <span class="bg-blue-200 px-1">[RECIPIENT_CITY, STATE, ZIP]</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="mt-8">
                <p class="text-justify leading-relaxed">
                  This Non-Disclosure Agreement ("Agreement") is entered into on 
                  <span class="bg-green-200 px-1 mx-1">[DATE]</span> 
                  by and between the parties identified above. The purpose of this Agreement is to protect confidential information that may be disclosed between the parties.
                </p>
              </div>
              
              <div class="mt-8">
                <h2 class="text-lg font-semibold mb-4">1. Definition of Confidential Information</h2>
                <p class="text-justify leading-relaxed">
                  For purposes of this Agreement, "Confidential Information" shall include all information or material that has or could have commercial value or other utility in the business in which Disclosing Party is engaged...
                </p>
              </div>
              
              <div class="mt-8">
                <h2 class="text-lg font-semibold mb-4">2. Obligations of Receiving Party</h2>
                <p class="text-justify leading-relaxed">
                  Receiving Party agrees to hold and maintain the Confidential Information in strict confidence for the sole and exclusive benefit of the Disclosing Party...
                </p>
              </div>
              
              <div class="mt-12 grid grid-cols-2 gap-8">
                <div class="text-center">
                  <div class="border-t border-gray-400 pt-2 mt-16">
                    <p class="font-semibold">Disclosing Party Signature</p>
                    <div class="bg-red-200 px-2 py-1 mt-2 text-sm">[SIGNATURE_1]</div>
                  </div>
                  <div class="mt-4">
                    <p class="text-sm">Date: <span class="bg-green-200 px-1">[DATE_1]</span></p>
                  </div>
                </div>
                
                <div class="text-center">
                  <div class="border-t border-gray-400 pt-2 mt-16">
                    <p class="font-semibold">Receiving Party Signature</p>
                    <div class="bg-red-200 px-2 py-1 mt-2 text-sm">[SIGNATURE_2]</div>
                  </div>
                  <div class="mt-4">
                    <p class="text-sm">Date: <span class="bg-green-200 px-1">[DATE_2]</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      }
    ],
    fields: [
      { name: 'COMPANY_NAME', type: 'text', required: true },
      { name: 'ADDRESS', type: 'text', required: true },
      { name: 'CITY, STATE, ZIP', type: 'text', required: true },
      { name: 'RECIPIENT_NAME', type: 'text', required: true },
      { name: 'RECIPIENT_ADDRESS', type: 'text', required: true },
      { name: 'RECIPIENT_CITY, STATE, ZIP', type: 'text', required: true },
      { name: 'DATE', type: 'date', required: true },
      { name: 'SIGNATURE_1', type: 'signature', required: true },
      { name: 'SIGNATURE_2', type: 'signature', required: true },
      { name: 'DATE_1', type: 'date', required: true },
      { name: 'DATE_2', type: 'date', required: true }
    ]
  };

  const handleUseTemplate = () => {
    onUseTemplate(template);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-4 max-h-[95vh] overflow-hidden flex">
        {/* Sidebar */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Template Preview</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">{template.name}</h3>
              <p className="text-sm text-gray-600">{template.description}</p>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {template.category}
                </span>
                <span className="text-xs text-gray-500">{template.usage} uses</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex-1 py-3 px-4 text-sm font-medium ${
                  activeTab === 'preview'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-3 px-4 text-sm font-medium ${
                  activeTab === 'details'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'preview' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Template Fields</h4>
                  <div className="space-y-2">
                    {templateContent.fields.map((field, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-sm font-medium">{field.name}</span>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            field.type === 'signature' ? 'bg-red-100 text-red-800' :
                            field.type === 'date' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {field.type}
                          </span>
                          {field.required && (
                            <span className="text-xs text-red-600">*</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Template Information</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Category:</span>
                      <span className="ml-2 text-gray-600">{template.category}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Usage Count:</span>
                      <span className="ml-2 text-gray-600">{template.usage} times</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Fields:</span>
                      <span className="ml-2 text-gray-600">{templateContent.fields.length} fields</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Required Fields:</span>
                      <span className="ml-2 text-gray-600">
                        {templateContent.fields.filter(f => f.required).length} required
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-sm text-gray-600">{template.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-gray-200">
            <div className="space-y-3">
              <button
                onClick={handleUseTemplate}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Edit3 className="w-4 h-4" />
                <span>Use This Template</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center justify-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Download</span>
                </button>
                <button className="flex items-center justify-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Share2 className="w-4 h-4" />
                  <span className="text-sm">Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Template Preview */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div 
                dangerouslySetInnerHTML={{ __html: templateContent.pages[0].content }}
                className="template-content"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateViewer;