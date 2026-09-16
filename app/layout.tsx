import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth-context';
import { Toaster } from 'sonner';
export const metadata:Metadata={title:'Tholan — Health & Emergency Response',description:'Bilingual health monitoring and emergency-response platform'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ta" data-theme="calm"><body><AuthProvider>{children}</AuthProvider><Toaster position="top-right" richColors/></body></html>}
