import { SharedSessionViewer } from '@/components/share/SharedSessionViewer';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  
  return <SharedSessionViewer token={token} />;
}

export const metadata = {
  title: 'Shared Session - ALFIE',
  description: 'View a shared ALFIE session',
};
