import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppHeader } from "@/components/AppHeader";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { Toaster } from "@/components/toast";
import "./globals.css";

const pretendard = localFont({
  src: "../../public/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MayAIStudio · 여행•숙소 쇼핑숏폼 팩토리",
  description: "숙소·여행상품 링크와 사진으로 인스타그램 릴스용 쇼핑 숏폼을 자동으로 만듭니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AppHeader />
        <main className="flex-1">{children}</main>
        <SettingsDialog />
        <Toaster />
      </body>
    </html>
  );
}
