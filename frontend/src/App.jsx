import { useState } from 'react';
  import { Outlet } from 'react-router-dom';
  import Sidebar from './components/Sidebar';
  import TopBar from './components/TopBar';

  function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="p-4">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  export default App;