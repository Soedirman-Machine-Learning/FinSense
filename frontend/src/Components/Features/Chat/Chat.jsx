import React, { useState, useRef, useEffect } from 'react';
import api from '../../../services/api';
import { IoMdSend } from 'react-icons/io';
import { IoClose, IoChatboxEllipsesOutline } from 'react-icons/io5';

function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewSession = async () => {
    try {
      const response = await api.post('/chat/sessions', {
        session_title: 'Chat baru',
      });
      setSessionId(response.data.id);
      setMessages([
        {
          id: Date.now(),
          sender: 'ai',
          text: 'Halo! Saya asisten FinSense. Pilih topik yang ingin kamu tanyakan:',
        },
      ]);
      setQuickReplies([
        { id: 'catat', label: '🎤 Catat Transaksi (Suara)' },
        { id: 'lihat_transaksi', label: '📋 Lihat Transaksi' },
        { id: 'stok', label: '📦 Manajemen Stok' },
        { id: 'hutang', label: '💰 Hutang/Piutang' },
        { id: 'tips', label: '💡 Tips UMKM' },
      ]);
    } catch (error) {
      console.error('Gagal membuat session chat:', error);
    }
  };
  useEffect(() => {
    if (isOpen && !sessionId) {
      createNewSession();
    }
  }, [isOpen, sessionId]);

  const sendMessageToBackend = async (message) => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const response = await api.post(`/chat/sessions/${sessionId}/messages`, {
        message,
      });
      const assistantMsg = response.data.assistantMessage;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsg.id,
          sender: 'ai',
          text: assistantMsg.content,
        },
      ]);
      setQuickReplies(response.data.quickReplies || []);
    } catch (error) {
      console.error('Gagal mengirim pesan:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 999,
          sender: 'ai',
          text: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSendEventHandler = async () => {
    if (inputValue.trim() === '' || isLoading) return;
    const userMessageText = inputValue.trim();
    const newUserMsg = {
      id: Date.now(),
      sender: 'user',
      text: userMessageText,
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setInputValue('');
    setQuickReplies([]);
    await sendMessageToBackend(userMessageText);
  };

  const onEnterButtonHandler = (e) => {
    if (e.key === 'Enter') onSendEventHandler();
  };

  const toggleChat = () => setIsOpen(!isOpen);

  return (
    <>
      {isOpen && (
        <div className='fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-50 w-[calc(100vw-2rem)] sm:w-96 md:w-[28rem] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200'>
          {/* Header */}
          <div className='bg-sky-950 px-4 py-3 flex justify-between items-center text-white'>
            <span className='font-bold text-sm tracking-wide flex items-center gap-2'>
              FinSense AI Support
            </span>
            <button
              onClick={toggleChat}
              className='hover:bg-sky-800 p-1 rounded-full transition'
            >
              <IoClose size={22} />
            </button>
          </div>

          {/* Messages Area */}
          <div className='flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3 text-sm min-h-[300px] max-h-[calc(80vh-130px)]'>
            {messages.map((n) => (
              <div
                key={n.id}
                className={`p-3 max-w-[85%] shadow-sm break-words ${
                  n.sender === 'user'
                    ? 'self-end bg-sky-950 text-white rounded-t-xl rounded-bl-xl rounded-br-xl'
                    : 'self-start bg-gray-200 text-sky-950 rounded-tr-xl rounded-br-xl rounded-bl-xl'
                }`}
              >
                <span dangerouslySetInnerHTML={{ __html: n.text }}></span>
              </div>
            ))}
            {isLoading && (
              <div className='self-start bg-gray-200 text-sky-950 p-3 rounded-xl'>
                Mengetik...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {quickReplies.length > 0 && (
            <div className='px-3 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-2'>
              {quickReplies.map((reply, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputValue(reply.label);
                    onSendEventHandler();
                  }}
                  className='bg-gray-100 hover:bg-gray-200 text-sky-950 text-xs py-1.5 px-3 rounded-full transition'
                >
                  {reply.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          <div className='p-3 bg-white border-t border-gray-200 flex gap-2 items-center'>
            <input
              type='text'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={onEnterButtonHandler}
              placeholder='Ketik pesan...'
              disabled={isLoading}
              className='flex-1 px-3 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-1 focus:ring-sky-950 text-sm'
            />
            <button
              onClick={onSendEventHandler}
              disabled={isLoading}
              className='bg-sky-950 text-white p-2 rounded-full hover:bg-sky-800 transition disabled:opacity-50'
            >
              <IoMdSend size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className={`
    fixed bottom-4 right-4 sm:bottom-6 sm:right-6 
    p-3 rounded-full shadow-xl transition-all duration-300 z-50 
    flex items-center justify-center
    ${
      isOpen
        ? 'bg-red-500 hover:bg-red-600 rotate-90 scale-90 md:hidden' // Sembunyikan di tablet/laptop saat chat terbuka
        : 'bg-sky-950 hover:bg-sky-800 hover:-translate-y-1 text-white'
    }
  `}
      >
        {isOpen ? (
          <IoClose size={24} />
        ) : (
          <IoChatboxEllipsesOutline size={24} />
        )}
      </button>
    </>
  );
}

export default Chat;
