import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { whatsappQueue } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  let pending = 0;
  try {
    const rows = await db.select({ id: whatsappQueue.id, status: whatsappQueue.status }).from(whatsappQueue);
    pending = rows.filter((row) => row.status === "fila").length;
  } catch {
    pending = 0;
  }

  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }} pending={pending}>
      {children}
    </AppShell>
  );
}
