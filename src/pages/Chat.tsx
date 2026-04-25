import { useState, useRef, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Send, FileText, Bot, User, Sparkles } from "lucide-react";

type Message = {
  id: number;
  type: "user" | "ai";
  content: string;
  isReport?: boolean;
};

// --- MOCK DATA FOR UI DEMO: YOUR FRIEND CAN DELETE OR REPLACE THIS LIST LATER WHEN CONNECTING BACKEND ---
const initialMessages: Message[] = [
  {
    id: 1,
    type: "ai",
    content: "Hello! I am your FinSight AI Advisor (powered by GLM-3). I have access to your financial data. How can I assist you today?"
  }
];

// Persist session ID across navigations (one session per browser)
const SESSION_ID = (() => {
  let id = localStorage.getItem('finsight_session_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('finsight_session_id', id); }
  return id;
})();

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userText = inputValue;
    const newUserMsg: Message = { id: Date.now(), type: "user", content: userText };
    const loadingId = Date.now() + 1;
    const loadingMsg: Message = { id: loadingId, type: "ai", content: "..." };

    setMessages(prev => [...prev, newUserMsg, loadingMsg]);
    setInputValue("");

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, session_id: SESSION_ID }),
      });
      const data = await res.json();
      const replyText = data.reply || data.error || "Sorry, I could not generate a response.";

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, content: replyText, isReport: data.isReport }
          : m
      ));
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, content: "Sorry, I am having trouble connecting to the backend right now." }
          : m
      ));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 md:px-6 pt-28 pb-6 flex flex-col h-[calc(100vh-80px)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              FinSight AI Advisor 
              <span className="ml-3 px-2 py-1 bg-primary/20 text-primary text-xs rounded-full flex items-center">
                <Sparkles className="w-3 h-3 mr-1" /> GLM-3 / GLM-5 Active
              </span>
            </h1>
            <p className="text-muted-foreground text-sm">Ask about your profit, cutting costs, or generating reports.</p>
          </div>
          
          <Button 
            variant="outline" 
            className="hidden md:flex border-primary/50 text-primary hover:bg-primary/10"
            onClick={() => { setInputValue("Generate report"); handleSend(); }}
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>

        {/* Chat Window */}
        <div className="flex-1 bg-card border border-border rounded-xl shadow-card overflow-hidden flex flex-col relative">
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] md:max-w-[75%] ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.type === 'user' ? 'bg-accent ml-3' : 'bg-primary mr-3'
                  }`}>
                    {msg.type === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                  </div>
                  
                  {/* Message Bubble */}
                  <div className={`p-4 rounded-2xl ${
                    msg.type === 'user' 
                      ? 'bg-accent/20 text-foreground border border-accent/20 rounded-tr-none' 
                      : 'bg-muted/50 border border-border rounded-tl-none'
                  }`}>
                    {msg.content === "..." ? (
                      <p className="text-sm leading-relaxed animate-pulse text-muted-foreground">GLM is thinking...</p>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                    
                    {/* Mock Report Card if triggered */}
                    {msg.isReport && (
                      <div className="mt-4 bg-background border border-border rounded-lg p-4 w-full md:w-[400px]">
                        <div className="flex items-center space-x-2 text-primary mb-3 border-b border-border pb-2">
                          <FileText className="w-5 h-5" />
                          <h4 className="font-bold">FinSight Monthly Executive Summary</h4>
                        </div>
                        <ul className="text-sm space-y-2 text-muted-foreground mb-4">
                          <li>• <strong className="text-foreground">Revenue:</strong> $12,500 (+3% MoM)</li>
                          <li>• <strong className="text-foreground">Expenses:</strong> $5,100 (-2% MoM)</li>
                          <li>• <strong className="text-foreground">Profit Margin:</strong> 59.2%</li>
                          <li>• <strong className="text-foreground">Risk:</strong> Marketing spend ROI decreasing rapidly.</li>
                        </ul>
                        <Button className="w-full text-xs h-8 bg-primary hover:bg-primary/80">
                          Download PDF
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-background/50 border-t border-border backdrop-blur-sm">
            <div className="relative flex items-end bg-muted/30 border border-border rounded-xl focus-within:ring-1 focus-within:ring-primary overflow-hidden transition-all">
              <textarea 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your financial advisor anything, or paste unstructured notes..."
                className="w-full bg-transparent border-none p-4 text-sm max-h-32 outline-none resize-none"
                rows={1}
                style={{ minHeight: '60px' }}
              />
              <div className="p-2">
                <Button 
                  onClick={handleSend}
                  size="icon" 
                  className="rounded-lg bg-primary hover:bg-primary/80 h-10 w-10 disabled:opacity-50 transition-all"
                  disabled={!inputValue.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="text-center mt-2 text-xs text-muted-foreground">
              GLM can make mistakes. Consider verifying important financial data directly in the Cashflow page.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
