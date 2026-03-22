import type { Metadata } from 'next';

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
      <body
        style={{
          margin: 0,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: '#f7f7f7',
          color: '#111827',
        }}
      >
        {children}
      </body>
    </html>
  );
}
