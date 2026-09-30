import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children, title, subtitle }) {
  return (
    <div className="flex min-h-screen bg-surface-900">
      <Sidebar />

      {/* Main content — offset by sidebar width */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Topbar title={title} subtitle={subtitle} />
        <main className="flex-1 px-8 py-7 fade-in">{children}</main>
      </div>
    </div>
  );
}
