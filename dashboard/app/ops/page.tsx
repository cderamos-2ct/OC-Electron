"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OpsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/ops/comms");
  }, [router]);
  return null;
}
