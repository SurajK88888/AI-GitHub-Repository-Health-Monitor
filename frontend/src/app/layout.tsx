import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { WidgetContainer } from "@/components/widgets";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "GitHub Repository Health Monitor",
    template: "%s | Health Monitor",
  },
  description:
    "AI-powered health monitoring for your GitHub repositories — automated scores, security findings, remediation actions, and trend analysis.",
  keywords: ["GitHub", "repository", "health", "monitoring", "security", "AI"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('gh_health_theme_mode')||'light';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <AuthProvider>
            {children}
            <WidgetContainer />
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
