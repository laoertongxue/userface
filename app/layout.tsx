import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '社区用户画像分析',
  description: '支持单账号分析与手工聚合分析的社区用户画像工作台。',
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
