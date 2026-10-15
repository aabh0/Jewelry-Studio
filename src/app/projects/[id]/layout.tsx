import { RememberRoute } from "@/components/frame/remember-route";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <RememberRoute projectId={id} />
      {children}
    </>
  );
}
