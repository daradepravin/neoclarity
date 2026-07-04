package com.neoclarity.api.service;

import java.util.List;

/**
 * Three scripted transaction batches, each engineered to push the
 * Financial Resilience Score in a deliberate direction.
 *
 * Batch 1 — Baseline / mild
 *   Normal month: grocery runs, utilities, one dining splurge.
 *   Score moves slightly. Story: "things are stable."
 *
 * Batch 2 — Unexpected large expense
 *   HVAC unit fails. $3,200 emergency repair hits the credit card.
 *   Emergency fund runway shrinks from ~1.8 months to ~0.9 months.
 *   Score drops 8-12 points. Story: "an unexpected expense hit us."
 *
 * Batch 3 — Missed / delayed income deposit
 *   Salary deposit is missing this cycle. Only partial income received.
 *   Income stability score collapses. A HIGH-priority recommendation
 *   surfaces via the Standard Recommendation Object.
 *   Story: "resilience is being tested — here's what to do next."
 *
 * These are honest demo fixtures. The transactions are seeded but every
 * downstream step — graph attachment, agent re-run, score recalculation —
 * is real. The demo survives "is this live?" with a clean answer.
 */
public final class SyncBatchFixtures {

    private SyncBatchFixtures() {}

    public record Transaction(
        String merchantRaw,
        String merchantNormalised,
        String category,
        String subcategory,
        double amount,       // negative = debit, positive = credit
        String accountType,  // CHECKING | SAVINGS | CREDIT
        boolean recurring,
        boolean income,
        int daysAgo
    ) {}

    public record Batch(
        int batchNumber,
        String narrative,       // shown in UI sync result
        String storyArc,        // one-line description of what this does to the score
        List<Transaction> transactions
    ) {}

    public static final List<Batch> BATCHES = List.of(

        // ── BATCH 1: Baseline / mild ─────────────────────────────────────
        new Batch(1,
            "Routine transactions synced — a normal month",
            "Small score movement. Household finances are stable.",
            List.of(
                new Transaction("WHOLEFDS #4521", "Whole Foods", "Groceries", "Supermarket", -127.43, "CHECKING", false, false, 28),
                new Transaction("WHOLEFDS #4521", "Whole Foods", "Groceries", "Supermarket", -98.76, "CHECKING", false, false, 14),
                new Transaction("WHOLEFDS #4521", "Whole Foods", "Groceries", "Supermarket", -143.20, "CHECKING", false, false, 3),
                new Transaction("SHELL OIL 5567", "Shell", "Transport", "Fuel", -62.40, "CHECKING", false, false, 25),
                new Transaction("SHELL OIL 5567", "Shell", "Transport", "Fuel", -58.90, "CHECKING", false, false, 11),
                new Transaction("NETFLIX.COM", "Netflix", "Subscriptions", "Streaming", -15.49, "CHECKING", true, false, 20),
                new Transaction("SPOTIFY USA", "Spotify", "Subscriptions", "Streaming", -11.99, "CHECKING", true, false, 20),
                new Transaction("PG&E ENERGY", "PG&E", "Utilities", "Electric", -142.00, "CHECKING", true, false, 18),
                new Transaction("COMCAST CABLE", "Comcast", "Utilities", "Internet", -89.99, "CHECKING", true, false, 18),
                new Transaction("CHIPOTLE 2841", "Chipotle", "Dining", "Fast Food", -34.20, "CHECKING", false, false, 22),
                new Transaction("STARBUCKS #0823", "Starbucks", "Dining", "Coffee", -8.75, "CHECKING", false, false, 27),
                new Transaction("STARBUCKS #0823", "Starbucks", "Dining", "Coffee", -9.10, "CHECKING", false, false, 13),
                new Transaction("PAYROLL DIRECT DEP", "Employer Payroll", "Income", "Salary", 3100.00, "CHECKING", true, true, 14),
                new Transaction("PAYROLL DIRECT DEP", "Employer Payroll", "Income", "Salary", 3100.00, "CHECKING", true, true, 28),
                new Transaction("TRANSFER TO SAVINGS", "Internal Transfer", "Transfer", "Savings", -300.00, "CHECKING", false, false, 15)
            )
        ),

        // ── BATCH 2: Unexpected large expense ───────────────────────────
        new Batch(2,
            "Unexpected expense detected — HVAC emergency repair",
            "Emergency fund runway shrinks. Score drops. Household absorbing a financial shock.",
            List.of(
                // The shock: HVAC emergency repair
                new Transaction("AIRE SERV HVAC #441", "Aire Serv HVAC", "Home Maintenance", "Emergency Repair", -3200.00, "CREDIT", false, false, 10),
                // Supporting spend — life continued around the shock
                new Transaction("TARGET T-2284", "Target", "Shopping", "Retail", -187.43, "CHECKING", false, false, 20),
                new Transaction("WHOLEFDS #4521", "Whole Foods", "Groceries", "Supermarket", -156.20, "CHECKING", false, false, 6),
                new Transaction("SHELL OIL 5567", "Shell", "Transport", "Fuel", -71.00, "CHECKING", false, false, 16),
                new Transaction("NETFLIX.COM", "Netflix", "Subscriptions", "Streaming", -15.49, "CHECKING", true, false, 20),
                new Transaction("PG&E ENERGY", "PG&E", "Utilities", "Electric", -198.00, "CHECKING", true, false, 18),
                new Transaction("COMCAST CABLE", "Comcast", "Utilities", "Internet", -89.99, "CHECKING", true, false, 18),
                // Dining up — stress spending pattern
                new Transaction("DOORDASH*ORDER", "DoorDash", "Dining", "Delivery", -67.80, "CREDIT", false, false, 9),
                new Transaction("DOORDASH*ORDER", "DoorDash", "Dining", "Delivery", -54.20, "CREDIT", false, false, 5),
                new Transaction("CHIPOTLE 2841", "Chipotle", "Dining", "Fast Food", -41.60, "CHECKING", false, false, 12),
                // Income present but credit balance rising
                new Transaction("PAYROLL DIRECT DEP", "Employer Payroll", "Income", "Salary", 3100.00, "CHECKING", true, true, 14),
                new Transaction("PAYROLL DIRECT DEP", "Employer Payroll", "Income", "Salary", 3100.00, "CHECKING", true, true, 28),
                // No savings transfer this month — couldn't afford it
                new Transaction("AMAZON.COM*RT4", "Amazon", "Shopping", "Online", -243.00, "CREDIT", false, false, 7)
            )
        ),

        // ── BATCH 3: Missed / delayed income deposit ─────────────────────
        new Batch(3,
            "Income gap detected — salary deposit delayed this cycle",
            "Income stability collapses. Resilience drops further. Emergency action recommended.",
            List.of(
                // Only partial income — one paycheck missing
                new Transaction("PAYROLL DIRECT DEP", "Employer Payroll", "Income", "Salary", 3100.00, "CHECKING", true, true, 28),
                // Second paycheck missing — this is the trigger
                // (no second salary transaction this cycle)
                // Bills still going out
                new Transaction("WHOLEFDS #4521", "Whole Foods", "Groceries", "Supermarket", -134.50, "CHECKING", false, false, 4),
                new Transaction("PG&E ENERGY", "PG&E", "Utilities", "Electric", -162.00, "CHECKING", true, false, 18),
                new Transaction("COMCAST CABLE", "Comcast", "Utilities", "Internet", -89.99, "CHECKING", true, false, 18),
                new Transaction("NETFLIX.COM", "Netflix", "Subscriptions", "Streaming", -15.49, "CHECKING", true, false, 20),
                new Transaction("SPOTIFY USA", "Spotify", "Subscriptions", "Streaming", -11.99, "CHECKING", true, false, 20),
                // Mortgage payment still hits
                new Transaction("WELLS FARGO MORTGAGE", "Wells Fargo Mortgage", "Housing", "Mortgage", -2340.00, "CHECKING", true, false, 1),
                // Credit card minimum payment — debt pressure
                new Transaction("CHASE AUTOPAY", "Chase Credit Card", "Debt", "Credit Card Payment", -250.00, "CHECKING", true, false, 8),
                // Small discretionary — household still functioning
                new Transaction("SHELL OIL 5567", "Shell", "Transport", "Fuel", -55.00, "CHECKING", false, false, 12),
                new Transaction("STARBUCKS #0823", "Starbucks", "Dining", "Coffee", -7.80, "CHECKING", false, false, 3),
                // Savings transfer cancelled — can't afford it
                new Transaction("CVS PHARMACY 4421", "CVS", "Healthcare", "Pharmacy", -43.20, "CHECKING", false, false, 6)
            )
        )
    );

    public static Batch getBatch(int batchNumber) {
        return BATCHES.stream()
            .filter(b -> b.batchNumber() == batchNumber)
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("No batch number: " + batchNumber));
    }

    public static int totalBatches() {
        return BATCHES.size();
    }
}
