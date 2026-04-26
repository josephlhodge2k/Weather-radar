import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage, WeatherData } from '../types';
import { sendMessage } from '../services/geminiService';
import { cn } from '../lib/utils';

interface ChatBoxProps {
  weather: WeatherData | null;
}

export function ChatBox({ weather }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { 
      id: `${Date.now()}-user-${Math.random().toString(36).substr(2, 9)}`, 
      role: 'user', 
      text: input 
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await sendMessage(messages, input, weather);
      setMessages(prev => [...prev, { 
        id: `${Date.now()}-model-${Math.random().toString(36).substr(2, 9)}`, 
        role: 'model', 
        text: responseText 
      }]);
    } catch (err) {
      console.error("Chat Error:", err);
      setMessages(prev => [...prev, { 
        id: `${Date.now()}-error-${Math.random().toString(36).substr(2, 9)}`, 
        role: 'model', 
        text: "I'm sorry, I'm having trouble processing your message right now. Please try again in a moment." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] border-2 border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden shadow-2xl">
      <header className="px-4 py-3 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
        <h2 className="text-zinc-100 text-sm font-bold flex items-center gap-2" id="chat-heading">
          <Bot className="w-4 h-4 text-sky-400" />
          Aura Assistant
        </h2>
        <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-[0.2em]">Active</span>
      </header>

      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 font-sans"
        role="log"
        aria-labelledby="chat-heading"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <div key="empty-state" className="text-center py-10 space-y-2">
              <p className="text-zinc-400">Ask me anything about the current weather.</p>
              <p className="text-xs text-zinc-600">"Should I take an umbrella today?"</p>
            </div>
          )}
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                msg.role === 'user' ? "bg-zinc-800 border-zinc-700" : "bg-sky-950 border-sky-800"
              )}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-300" /> : <Bot className="w-4 h-4 text-sky-400" />}
              </div>
              <div className={cn(
                "p-3 rounded-2xl text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-zinc-100 text-zinc-950 rounded-tr-none" 
                  : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700"
              )}>
                <div className="prose prose-invert prose-sm">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div key="loading-indicator" className="flex gap-3 mr-auto items-center text-sky-400">
               <div className="w-8 h-8 rounded-full bg-sky-950 border border-sky-800 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <span className="text-xs font-mono animate-pulse">Consulting radar...</span>
            </div>
          )}
          <div key="scroll-anchor" ref={messagesEndRef} />
        </AnimatePresence>
      </div>

      <form onSubmit={handleSubmit} className="p-3 bg-zinc-900 border-t border-zinc-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 bg-zinc-950 border border-zinc-700 text-zinc-100 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
          aria-label="Your message"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-700 text-white p-2 rounded-full transition-colors"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
