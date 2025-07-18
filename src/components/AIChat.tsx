// AIChat.tsx
import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { X, Send } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface AIChatProps {
  onClose: () => void;
  onSave: (file: File) => void;
}

interface Message {
  sender: 'User' | 'AI';
  text: string;
}

const AIChat: React.FC<AIChatProps> = ({ onClose, onSave }) => {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'AI', text: 'Hello! I can help you create a document. What type of document do you need? (e.g., NDA, contract, letter)' },
  ]);
  const [input, setInput] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [loading, setLoading] = useState(false);

  // Function to call OpenAI ChatGPT API
  const getAIResponse = async (input: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_OPEN_AI_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured.');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4', // Use 'gpt-3.5-turbo' if preferred for cost-efficiency
          messages: [
            {
              role: 'system',
              content: 'You are a professional document creation assistant. Generate clear, concise, and legally formatted document content based on user requests. Include placeholders like [PARTY_A], [DATE], etc., for fields that users can fill later. If the request is unclear, ask for clarification. Return only the document content or a clarification message.',
            },
            ...messages.map((msg) => ({
              role: msg.sender === 'AI' ? 'assistant' : 'user',
              content: msg.text,
            })),
            { role: 'user', content: input },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content?.trim();

      if (!aiResponse) {
        throw new Error('No response from OpenAI API.');
      }

      return aiResponse;
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate document content. Please try again.');
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const aiResponse = await getAIResponse(input);
      // Check if the response seems to be document content (e.g., contains placeholders or multiple lines)
      const isDocumentContent = aiResponse.includes('[') || aiResponse.split('\n').length > 3;
      if (isDocumentContent) {
        setDocumentText(aiResponse);
        setMessages([
          ...messages,
          { sender: 'User', text: input },
          { sender: 'AI', text: 'I have updated the document in the preview pane. Review it and let me know if you want to make changes or proceed to create the PDF.' },
        ]);
      } else {
        setMessages([...messages, { sender: 'User', text: input }, { sender: 'AI', text: aiResponse }]);
      }
      setInput('');
    } catch (error: any) {
      console.error('Error getting AI response:', error);
      setMessages([...messages, { sender: 'AI', text: error.message || 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePDF = async () => {
    if (!documentText.trim()) {
      alert('No document content to convert to PDF. Please generate content using the chat.');
      return;
    }
    setLoading(true);
    try {
      const pdfBytes = await generatePDFFromText(documentText);
      const pdfFile = new File([pdfBytes], `AI_Generated_Document_${uuidv4()}.pdf`, { type: 'application/pdf' });
      onSave(pdfFile);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to generate PDF from text
  const generatePDFFromText = async (text: string): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]); // A4 size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont('Helvetica');
    const fontSize = 12;
    const lineHeight = fontSize * 1.2;

    // Split text into lines and handle basic wrapping
    const lines = text.split('\n');
    let yPosition = height - 50;

    for (const line of lines) {
      if (yPosition < 50) {
        // Add new page if content overflows
        const newPage = pdfDoc.addPage([600, 800]);
        yPosition = height - 50;
        newPage.drawText(line, {
          x: 50,
          y: yPosition,
          size: fontSize,
          font,
        });
      } else {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: fontSize,
          font,
        });
      }
      yPosition -= lineHeight;
    }

    return pdfDoc.save();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">AI Document Creator</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Chat Pane */}
          <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200">
            {messages.map((msg, index) => (
              <div key={index} className={`mb-4 ${msg.sender === 'AI' ? 'text-left' : 'text-right'}`}>
                <div className={`p-3 rounded-lg inline-block max-w-[80%] ${msg.sender === 'AI' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            )}
          </div>
          {/* Preview Pane */}
          <div className="w-1/2 p-6 overflow-y-auto bg-gray-50">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Document Preview</h4>
            {documentText ? (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 whitespace-pre-wrap">
                {documentText}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">
                No document content yet. Use the chat to generate a document.
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex items-center space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message (e.g., 'Create an NDA document')..."
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleCreatePDF}
            disabled={loading || !documentText.trim()}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Change to PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;