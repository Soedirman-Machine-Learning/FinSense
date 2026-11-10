import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/tailwind.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <AuthProvider>
      <div className='font-poppins'>
        <App />
      </div>
    </AuthProvider>
  </BrowserRouter>,
);
