import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="min-w-0 overflow-x-hidden px-6 py-8 lg:ml-72 lg:h-screen lg:overflow-hidden lg:px-12 lg:py-10">
        {children}
      </main>
    </div>
  );
}
