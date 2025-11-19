import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PICKUP_LOCATION, STORE_EMAIL } from "@/lib/constants"

export default function PoliciesPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            Protocol Zero Airsoft
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to catalogue</span>
        </Link>

        <h1 className="mb-8 text-3xl font-bold tracking-tight">Store Policies</h1>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">Age Requirement</h2>
            <p className="text-muted-foreground">
              All customers must be 18 years of age or older, or accompanied by a parent or legal guardian. Valid ID may
              be required at pickup.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Payment</h2>
            <p className="text-muted-foreground">
              We accept Interac e-Transfer only. Payment must be sent to{" "}
              <code className="rounded bg-secondary px-2 py-1 text-sm">{STORE_EMAIL}</code> with the correct order ID as
              the security answer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Pickup</h2>
            <p className="text-muted-foreground">
              All orders are pickup-only at {PICKUP_LOCATION}. We do not offer shipping at this time. Pickup
              instructions will be provided after payment confirmation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Returns & Refunds</h2>
            <p className="text-muted-foreground">
              All sales are final. Please inspect your items carefully at pickup. Defective items may be exchanged
              within 7 days with proof of purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact</h2>
            <p className="text-muted-foreground">
              For questions or concerns, please email us at{" "}
              <a
                href={`mailto:${STORE_EMAIL}`}
                className="text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                {STORE_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
