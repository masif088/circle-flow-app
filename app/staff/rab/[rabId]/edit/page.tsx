"use client";

import { useParams } from "next/navigation";
import StaffRabForm from "../../StaffRabForm";

export default function StaffRabEditPage() {
  const { rabId } = useParams() as { rabId: string };
  return <StaffRabForm rabId={rabId} />;
}
