import { DownloadPageWrapper } from "@/components/download/download-page-wrapper";
import { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Download - Transfer`,
    description: `Download files from transfer ${id}`,
  };
}

export default async function Download({ params }: Props) {
  const { id } = await params;

  return <DownloadPageWrapper transferId={id} />;
}
