import "./globals.css";

export const metadata = {
  title: "Control Center CMS",
  description: "Draft-friendly CMS for operational pages"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
