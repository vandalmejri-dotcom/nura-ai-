import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { Toaster } from 'sonner';
import { UIProvider } from "@/context/UIContext";
import { StudySetsProvider } from "@/context/StudySetsContext";
import GlobalElements from "@/components/layout/GlobalElements";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Nura AI - Master Anything",
  description: "Next-generation AI learning platform for students who want to dominate their field.",
  icons: {
    icon: "/logo.png",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark no-scrollbar">
      <body className={`${inter.variable} font-sans bg-black text-zinc-100 antialiased overflow-hidden`}>
        <UIProvider>
          <StudySetsProvider>
            <Toaster position="top-center" theme="dark" />
            <GlobalElements />
            <div className="flex h-screen w-screen overflow-hidden bg-radial from-zinc-900 via-black to-black">
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Background Decorative Element */}
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 blur-[120px] rounded-full -z-10 animate-pulse" />
                <div className="absolute bottom-[-10%] left-[10%] w-[30%] h-[30%] bg-violet-600/10 blur-[100px] rounded-full -z-10" />

                <Navbar />
                <main className="flex-1 overflow-y-auto no-scrollbar p-10 animate-slide-up">
                  {children}
                </main>
              </div>
            </div>
          </StudySetsProvider>
        </UIProvider>
      </body>
    </html>
  );
}
