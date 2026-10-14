"use client";

import { useParams } from "next/navigation";
import RabForm from "../../RabForm";

export default function EditRabPage() {
  const { rabId } = useParams() as { rabId: string };
  return <RabForm rabId={rabId} />;
}
