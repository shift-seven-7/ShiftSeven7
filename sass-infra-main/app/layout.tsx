import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Heebo } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme/theme-provider';
import { TenantProviderWrapper } from '@/components/providers/TenantProviderWrapper';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants/app';
import { BASE_DOMAIN } from '@/lib/constants/domain';
import './globals.css';

// Hebrew-first: Heebo carries both Hebrew and Latin glyphs. Exposed as
// --font-sans so tailwind.config.ts's fontFamily.sans picks it up.
const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export async function generateMetadata(): Promise<Metadata> {
  let baseUrl = `https://${BASE_DOMAIN}`;
  try {
    const headersList = await headers();
    const host = headersList.get('host') || BASE_DOMAIN;
    const protocol = host.includes('localhost') ? 'http' : 'https';
    baseUrl = `${protocol}://${host}`;
  } catch {
    // headers() rejects during prerender — fall back to the base domain.
  }

  return {
    metadataBase: new URL(baseUrl),
    title: APP_NAME,
    description: APP_DESCRIPTION,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: APP_NAME,
    },
    openGraph: {
      title: APP_NAME,
      description: APP_DESCRIPTION,
      siteName: APP_NAME,
      locale: 'he_IL',
      type: 'website',
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning className={heebo.variable}>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <TenantProviderWrapper>
            <QueryProvider>{children}</QueryProvider>
          </TenantProviderWrapper>
          <Toaster position="bottom-left" dir="rtl" />
        </ThemeProvider>
      </body>
    </html>
  );
}
