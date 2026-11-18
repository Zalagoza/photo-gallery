import './globals.css';

export const metadata = { title: 'KIA Mens Welfare Memoirs', description: 'Browse and download KIA Mens Welfare Memoirs photos' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
