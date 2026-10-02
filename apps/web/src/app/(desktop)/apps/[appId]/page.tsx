import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apps, findApp } from "@/apps/registry";

type Props = { params: Promise<{ appId: string }> };

export const generateStaticParams = () => apps.map((a) => ({ appId: a.id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const app = findApp((await params).appId);
  if (!app) notFound();
  return { title: `${app.title} · MarketOS`, description: app.description };
}

// Desktop (ở layout) tự mở cửa sổ theo URL; page chỉ kiểm tra appId hợp lệ.
export default async function AppPage({ params }: Props) {
  if (!findApp((await params).appId)) notFound();
  return null;
}
