import "./globals.css";

export const metadata = {
  title: "MusicBoard DApp",
  description: "FHE-powered music message board with encrypted applause",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


