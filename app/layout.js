import "./globals.css";

export const metadata = {
  title: "MBBS/BDS Counselling Updates | NEET Navigator",
  description:
    "One-stop dashboard for MCC, NTA/NEET, NMC and all State Medical Counselling updates and official links.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
