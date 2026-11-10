import React from 'react';
import { Route, Routes } from 'react-router-dom';

import MainPage from './Pages/MainPage';
import LoginPage from './Pages/Auth/LoginPage';
import RegisterPage from './Pages/Auth/RegisterPage';
import LupaPasswordPage from './Pages/Auth/LupaPasswordPage';
import ResetPasswordPage from './Pages/Auth/ResetPasswordPage';
import MainLayout from './Components/Layout/MainLayout';

import DashboardPage from './Pages/Features/DashboardPage';
import StockPage from './Pages/Features/StockPage';
import PosPage from './Pages/Features/PosPage';
import TransactionPage from './Pages/Features/TransactionPage';
import DebtPage from './Pages/Features/DebtPage';
import LogPage from './Pages/Features/LogPage';
import NewPage from './Pages/NewItem/NewPage';

import NewStock from './Components/Features/Stock/NewStock';
import NewTransaction from './Components/Features/Transaction/NewTransaction';
import NewPos from './Components/Features/Pos/NewPos';
import NewDebt from './Components/Features/Debt/NewDebt';
import NewLog from './Components/Features/Log/NewLog';

import DetailStock from './Components/Features/Stock/DetailStock';
import DetailTransaction from './Components/Features/Transaction/DetailTransaction';
import DetailDebt from './Components/Features/Debt/DetailDebt';
import DetailLog from './Components/Features/Log/DetailLog';

import EditStock from './Components/Features/Stock/EditStock';
import EditTransaction from './Components/Features/Transaction/EditTransaction';
import EditDebt from './Components/Features/Debt/EditDebt';
import EditLog from './Components/Features/Log/EditLog';

import ErrorPage from './Pages/Features/ErrorPage';

function App() {
  return (
    <main>
      <Routes>
        <Route path='/' element={<MainPage />} />
        <Route path='/login' element={<LoginPage />} />
        <Route path='/register' element={<RegisterPage />} />
        <Route path='/lupa-password' element={<LupaPasswordPage />} />
        <Route path='/reset-password' element={<ResetPasswordPage />} />

        <Route element={<MainLayout />}>
          {/* Halaman utama */}
          <Route path='/dashboard' element={<DashboardPage />} />

          {/* tambah item baru */}
          <Route path='/new' element={<NewPage />} />

          {/* Transaction */}
          <Route path='/transactions' element={<TransactionPage />} />
          <Route path='/transactions/new/' element={<NewTransaction />} />
          <Route path='/transactions/:id' element={<DetailTransaction />} />
          <Route path='/transactions/edit/:id' element={<EditTransaction />} />

          {/* Stock */}
          <Route path='/stocks' element={<StockPage />} />
          <Route path='/stocks/new' element={<NewStock />} />
          <Route path='/stocks/:id' element={<DetailStock />} />
          <Route path='/stocks/edit/:id' element={<EditStock />} />

          {/* POS */}
          <Route path='/pos' element={<PosPage />} />
          <Route path='/pos/new' element={<NewPos />} />

          {/* Debt */}
          <Route path='/debts' element={<DebtPage />} />
          <Route path='/debts/new' element={<NewDebt />} />
          <Route path='debts/:id' element={<DetailDebt />} />
          <Route path='/debts/edit/:id' element={<EditDebt />} />

          {/* Log */}
          <Route path='/logs' element={<LogPage />} />
          <Route path='/logs/new' element={<NewLog />} />
          <Route path='/logs/:id' element={<DetailLog />} />
          <Route path='/logs/edit/:id' element={<EditLog />} />
        </Route>

        <Route path='*' element={<ErrorPage />} />
      </Routes>
    </main>
  );
}

export default App;
