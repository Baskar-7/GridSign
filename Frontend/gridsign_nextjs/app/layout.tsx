import type { Metadata } from "next";
import { Fira_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ReduxProvider } from "@/lib/providers/ReduxProvider";
import ReactQueryProvider from "@/lib/providers/ReactQueryProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const firaSans = Fira_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
    variable: "--font-fira-sans",
});

export const metadata: Metadata = {
    title: "Grid Sign - Digital Signature Platform",
    description:
        "Modern digital signature platform with secure document signing",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={firaSans.variable}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <ReactQueryProvider>
                        <ReduxProvider>{children}</ReduxProvider>
                        <Toaster />
                    </ReactQueryProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
