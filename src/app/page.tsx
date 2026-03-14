import { Upload, ShieldCheck, Link2, FileSignature } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LandingCTA } from '@/components/layout/landing-cta';

const features = [
  {
    icon: Upload,
    title: 'Simple Upload',
    description: 'Drag and drop your PDF document to begin the signing process. Quick, easy, and secure.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified Identity',
    description: 'Connect your Zetrix Wallet and present your verified credentials to prove your identity.',
  },
  {
    icon: Link2,
    title: 'Blockchain Secure',
    description: 'Your signed document is cryptographically anchored on the Zetrix blockchain for tamper-proof verification.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center">
        <FileSignature className="h-16 w-16 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Zetrix <span className="text-primary">Sign</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Sign documents with blockchain-backed cryptographic proof.
          Verify authenticity instantly. Tamper-proof and decentralized.
        </p>
        <LandingCTA />
      </section>

      {/* Features Section */}
      <section className="container mx-auto grid gap-6 px-4 pb-24 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="text-center">
            <CardHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
