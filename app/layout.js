import "./globals.css";

export const metadata = {
  title: "MBBS/BDS Counselling Updates | NEET Navigator",
  description:
    "One-stop dashboard for MCC, NTA/NEET, NMC and all State Medical Counselling updates and official links.",
};

// Forces light mode regardless of the visitor's OS/browser dark-mode
// preference — this app has no dark theme, so letting the browser guess
// would mismatch native form controls (scrollbars, checkboxes) against the
// always-light page background.
export const viewport = {
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
