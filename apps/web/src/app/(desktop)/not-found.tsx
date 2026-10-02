import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="max-w-sm rounded-2xl border-2 border-[#3B2A4A] bg-background p-6 text-center shadow-2xl">
        <h2 className="font-display text-xl font-bold">App not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This link doesn&apos;t point to any app on the desktop.</p>
        <Link href="/" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">
          Back to desktop
        </Link>
      </div>
    </div>
  );
}
