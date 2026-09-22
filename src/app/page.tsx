import { Button } from "@/components/ui/button";
import { CoinsIcon } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fina",
  description: "Your personal finance app with AI",
};

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <CoinsIcon className="text-primary size-20" />
      <h1 className="text-primary text-4xl font-bold">Welcome to Fina</h1>
      <p className="mt-2 text-lg">Your personal finance app with AI</p>
      <Link href="/dashboard">
        <Button className="mt-2" size="lg">
          Get Started
        </Button>
      </Link>
    </main>
  );
}
