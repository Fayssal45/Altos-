import { redirect } from "next/navigation";

// "/" redirige vers /dashboard pour les utilisateurs connectés
export default function HomePage() {
  redirect("/dashboard");
}
