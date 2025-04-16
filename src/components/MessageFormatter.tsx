// components/MessageFormatter.tsx
import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';


interface MessageFormatterProps {
  content: string;
  className?: string;
}

const MessageFormatter: React.FC<MessageFormatterProps> = ({ content, className = '' }) => {

  
  // Configure marked for GitHub-like rendering
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Line breaks are treated as <br>
    headerIds: false, // Don't add IDs to headers
    mangle: false, // Don't mangle header IDs
  });

  // Process the content through marked to convert markdown to HTML
  const processContent = () => {
    if (!content) return '';
    
    try {
      // Convert markdown to HTML
      const rawHtml = marked.parse(content);
      
      // Sanitize the HTML to prevent XSS attacks
      const sanitizedHtml = DOMPurify.sanitize(rawHtml);
      
      return sanitizedHtml;
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return content; // Fallback to raw content if parsing fails
    }
  };

  return (
    <div className={`markdown-content relative group ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: processContent() }} />
      
    </div>
  );
};

export default MessageFormatter;