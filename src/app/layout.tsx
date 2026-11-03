import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import Theme from "@/components/Theme";
export const metadata: Metadata = {
  title: "Gordon Christmas Exchange",
  description: "A little less planning. A little more Christmas.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="class" defaultMode="system" />
        <AppRouterCacheProvider>
          <Theme>{children}</Theme>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
