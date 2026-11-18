import './globals.css';

export const metadata = { title: 'Photo Library', description: 'Browse and download your photos' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
