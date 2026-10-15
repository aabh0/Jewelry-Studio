import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppFrame } from "@/components/frame/app-frame";

// Local single-user app: every page reads live state, so nothing is prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Jewelry Studio", template: "%s · Jewelry Studio" },
  description: "Campaign visuals for jewelry brands.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('js-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
