import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '社区用户画像分析',
  description: '第 1 阶段：V2EX 单平台最小闭环的应用入口与分析 API 骨架。',
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
