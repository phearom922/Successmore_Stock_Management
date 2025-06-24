const TopBar = () => {
    return (
      <div className="bg-white p-4 shadow">
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Welcome, Admin</h2>
          <div className="flex space-x-4">
            <button className="p-2 bg-gray-200 rounded">Notifications</button>
          </div>
        </div>
      </div>
    );
  };

  export default TopBar;