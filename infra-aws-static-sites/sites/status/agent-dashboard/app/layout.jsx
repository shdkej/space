import './globals.css';

export const metadata = {
  title: 'Agent room · Space status',
  description: '실시간 에이전트 작업 흐름과 최근 결과를 보는 운영 화면',
};

export default function RootLayout({ children }) {
  return <html lang="ko"><body>{children}</body></html>;
}
