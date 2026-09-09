import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '범양 현장훈련장 | PUMYANG FIELD SIMULATOR',
  description:
    '범양이엔씨 브로슈어 기반 3D 현장 탐색과 건설장비 자유 조작 훈련장.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
