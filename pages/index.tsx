import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (r.ok) router.replace("/dashboard");
      else router.replace("/login");
    });
  }, [router]);
  return null;
}
