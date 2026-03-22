import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Community Portrait Analysis',
  description:
    'A modular monolith for multi-community profile analysis with connector isolation and evidence-based portraits.',
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
