import './globals.css';

export const metadata = {
  title: '投票现场 | MYIOI',
  description: '在线投票系统：创建投票、参与选择、透明查看结果。',
};

export default function RootLayout({ children }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
