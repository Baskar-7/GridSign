"use client";

import React from "react";
import { Button } from "./ui/button";
import {
  FileSignature,
  Shield,
  Zap,
  Globe,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  PenLine,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { useDispatch } from "react-redux";
import { setActiveComponent } from "@/lib/store/slices/mainContentSlice";

type Feature = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
};

const features: Feature[] = [
  { icon: FileSignature, title: "Easy Signing", desc: "Sign documents with just a few clicks. Intuitive interface makes it simple for everyone." },
  { icon: Shield, title: "Bank-Level Security", desc: "Your documents are encrypted with industry-standard security protocols." },
  { icon: Zap, title: "Lightning Fast", desc: "Process signatures in seconds, not days. Speed up your workflow dramatically." },
  { icon: Globe, title: "Global Compliance", desc: "Legally binding signatures compliant with international e-signature laws." },
  { icon: CheckCircle2, title: "Audit Trail", desc: "Complete tracking of every signature with detailed audit logs and timestamps." },
  { icon: Sparkles, title: "Smart Templates", desc: "Create reusable templates for frequently signed documents to save time." },
];

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  buttonLabel: string;
  onClick?: () => void;
  primary?: boolean;
}

function ActionCard({ icon, title, desc, buttonLabel, onClick, primary }: ActionCardProps) {
  return (
    <Card
      className="group relative overflow-hidden border border-border/70 hover:border-border hover:shadow-md transition-all duration-300"
      aria-label={title}
    >
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-3 ring-1 transition group-hover:scale-105 ${
              primary ? "bg-yellow-500/15 ring-yellow-500/30" : "bg-primary/15 ring-primary/30"
            }`}
          >
            {icon}
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{desc}</p>
        <Button
          size="sm"
          onClick={onClick}
          className="font-medium group transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 bg-yellow-500 hover:bg-yellow-600 text-white focus-visible:ring-yellow-500"
        >
          {buttonLabel}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
        <div
          className={`pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-tr ${
            primary ? "from-yellow-500/0 via-yellow-500/0 to-yellow-500/10" : "from-primary/0 via-primary/0 to-primary/10"
          }`}
        />
      </CardContent>
    </Card>
  );
}

const Homepage = () => {
  const dispatch = useDispatch();

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden" aria-labelledby="hero-title">
        <div className="absolute inset-0 -z-10 h-full w-full bg-background">
          <div className="absolute h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[260px] w-[260px] rounded-full bg-primary opacity-20 blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 md:pt-10 md:pb-20">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-muted-foreground">Secure Digital Signatures Made Simple</span>
            </div>

            {/* Title and subtitle (options moved below) */}
            <div className="space-y-3 max-w-4xl">
              <h1
                id="hero-title"
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight"
              >
                Sign Documents
                <span className="block bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                  Anywhere, Anytime
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Grid Sign provides a secure, fast, and legally binding way to sign documents digitally. Join thousands
                of users who trust us with their important documents.
              </p>
            </div>

            {/* Action Cards (moved below title) */}
            <div className="grid gap-5 w-full max-w-3xl md:grid-cols-2 pt-2">
              <ActionCard
                primary
                icon={<FileSignature className="h-6 w-6 text-yellow-500" />}
                title="Send for Signatures"
                desc="Upload a document and invite recipients to sign in a guided workflow."
                buttonLabel="Start Flow"
                onClick={() => {
                  // Switch main content to Documentform
                  dispatch(setActiveComponent("Documentform"));
                }}
              />
              <ActionCard
                icon={<PenLine className="h-6 w-6 text-primary" />}
                title="Sign Yourself"
                desc="Quickly add your own signature without inviting other participants."
                buttonLabel="Sign Now"
                onClick={() => {
                  // Option 1: same form, user adds self manually
                  dispatch(setActiveComponent("Documentform"));
                  // Option 2 (if you later support query params & a page route):
                  // router.push("/documentform?selfSign=1");
                }}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 w-full max-w-2xl">
              {[
                { value: "10K+", label: "Documents Signed" },
                { value: "99.9%", label: "Uptime" },
                { value: "5K+", label: "Happy Users" },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="text-3xl font-bold">{s.value}</div>
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 md:py-20 bg-muted/30" aria-labelledby="features-title">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-14 md:mb-16">
            <h2 id="features-title" className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Powerful Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage digital signatures efficiently and securely
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-lg transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative space-y-4">
                  <div className="inline-flex p-3 rounded-lg bg-primary/10">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20" aria-labelledby="cta-title">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-10 md:p-12 text-center">
            <div className="relative z-10 space-y-6">
              <h2 id="cta-title" className="text-3xl sm:text-4xl md:text-5xl font-bold">
                Ready to Get Started?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Join thousands of users who trust Grid Sign. Start signing documents today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Button
                  size="lg"
                  className="text-base bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Start Free Trial
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Contact Sales
                </Button>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.05),transparent_70%)]" />
          </div>
        </div>
      </section>
    </main>
  );
};

export default Homepage;
