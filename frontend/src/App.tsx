import { useState } from 'react';
import { LandingPage } from './pages/LandingPage';
import { NodesPage } from './pages/NodesPage';
import { BlocksPage } from './pages/BlocksPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { WalletPage } from './pages/WalletPage';

function App() {
  const [currentView, setCurrentView] = useState('landing');

  return (
    <>
      {currentView === 'landing' && <LandingPage onNavigate={setCurrentView} />}
      {currentView === 'nodes' && <NodesPage onNavigate={setCurrentView} />}
      {currentView === 'blocks' && <BlocksPage onNavigate={setCurrentView} />}
      {currentView === 'transactions' && <TransactionsPage onNavigate={setCurrentView} />}
      {currentView === 'wallet' && <WalletPage onNavigate={setCurrentView} />}
    </>
  );
}

export default App;
