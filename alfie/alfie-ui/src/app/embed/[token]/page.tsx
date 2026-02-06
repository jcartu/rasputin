import { EmbedViewer } from '@/components/share/EmbedViewer';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function EmbedPage({ params }: PageProps) {
  const { token } = await params;
  
  return (
    <div className="h-screen w-screen">
      <EmbedViewer token={token} />
    </div>
  );
}

export const metadata = {
  title: 'Embedded Session - ALFIE',
  robots: 'noindex, nofollow',
};
