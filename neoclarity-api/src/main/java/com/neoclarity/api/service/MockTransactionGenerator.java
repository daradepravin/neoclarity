package com.neoclarity.api.service;

import com.neoclarity.api.model.Account;
import com.neoclarity.api.model.Transaction;
import com.neoclarity.api.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

/**
 * Generates a realistic 90-day transaction history when an account is linked
 * via the mock Open Banking flow. In production this data would arrive from the
 * aggregator's transaction feed after consent. Here it is synthesised so the
 * Household Digital Twin, Resilience Score, and Event Intelligence agents have
 * real data to reason over.
 */
@Service
@RequiredArgsConstructor
public class MockTransactionGenerator {

    private final TransactionRepository transactionRepository;

    private record MerchantTemplate(String raw, String normalised, String category, String subcategory,
                                     double min, double max, int perMonth) {}

    // Recurring + discretionary merchants for a checking account
    private static final List<MerchantTemplate> CHECKING_MERCHANTS = List.of(
            new MerchantTemplate("WHOLEFDS #4521", "Whole Foods", "Groceries", "Supermarket", 45, 180, 6),
            new MerchantTemplate("AMZN MKTP US*RT4", "Amazon", "Shopping", "Online", 15, 220, 5),
            new MerchantTemplate("STARBUCKS #0823", "Starbucks", "Dining", "Coffee", 5, 12, 8),
            new MerchantTemplate("SHELL OIL 5567", "Shell", "Transport", "Fuel", 40, 75, 4),
            new MerchantTemplate("NETFLIX.COM", "Netflix", "Subscriptions", "Streaming", 15.49, 15.49, 1),
            new MerchantTemplate("SPOTIFY USA", "Spotify", "Subscriptions", "Streaming", 11.99, 11.99, 1),
            new MerchantTemplate("CHIPOTLE 2841", "Chipotle", "Dining", "Fast Food", 12, 28, 4),
            new MerchantTemplate("TARGET T-2284", "Target", "Shopping", "Retail", 25, 140, 3),
            new MerchantTemplate("PG&E ENERGY", "PG&E", "Utilities", "Electric", 110, 180, 1),
            new MerchantTemplate("COMCAST CABLE", "Comcast", "Utilities", "Internet", 89.99, 89.99, 1)
    );

    private static final List<MerchantTemplate> SAVINGS_MERCHANTS = List.of(
            new MerchantTemplate("TRANSFER TO SAVINGS", "Internal Transfer", "Transfer", "Savings", 200, 500, 1)
    );

    private static final List<MerchantTemplate> CREDIT_MERCHANTS = List.of(
            new MerchantTemplate("UNITED AIRLINES", "United Airlines", "Travel", "Airline", 280, 620, 0),
            new MerchantTemplate("MARRIOTT HOTELS", "Marriott", "Travel", "Hotel", 180, 420, 0),
            new MerchantTemplate("HOME DEPOT 6643", "Home Depot", "Shopping", "Home Improvement", 30, 240, 2),
            new MerchantTemplate("DELTA AIR LINES", "Delta", "Travel", "Airline", 240, 560, 0),
            new MerchantTemplate("BEST BUY #221", "Best Buy", "Shopping", "Electronics", 50, 380, 1)
    );

    /**
     * Generate and persist 90 days of transactions for a linked account.
     * Also seeds a salary deposit on checking accounts (income detection).
     */
    public int generateForAccount(Account account) {
        List<Transaction> transactions = new ArrayList<>();
        Random rng = new Random(account.getAccountId().hashCode());
        LocalDate today = LocalDate.now();

        List<MerchantTemplate> merchants = switch (account.getAccountType()) {
            case "CHECKING" -> CHECKING_MERCHANTS;
            case "SAVINGS" -> SAVINGS_MERCHANTS;
            case "CREDIT" -> CREDIT_MERCHANTS;
            default -> List.of();
        };

        // Biweekly salary deposits on checking accounts (income signal)
        if ("CHECKING".equals(account.getAccountType())) {
            for (int i = 0; i < 6; i++) {
                LocalDate payDate = today.minusDays(14L * i);
                transactions.add(buildTransaction(account, "PAYROLL DIRECT DEP", "Employer Payroll",
                        "Income", "Salary", new BigDecimal("3100.00"), payDate, true, true, rng));
            }
        }

        // Recurring + discretionary spending across 3 months
        for (MerchantTemplate m : merchants) {
            int count = m.perMonth() * 3; // 3 months
            for (int i = 0; i < count; i++) {
                int dayOffset = rng.nextInt(90);
                LocalDate date = today.minusDays(dayOffset);
                double amount = m.min() + (m.max() - m.min()) * rng.nextDouble();
                boolean recurring = m.category().equals("Subscriptions") || m.category().equals("Utilities");
                transactions.add(buildTransaction(account, m.raw(), m.normalised(), m.category(),
                        m.subcategory(), BigDecimal.valueOf(-Math.round(amount * 100) / 100.0),
                        date, recurring, false, rng));
            }
        }

        transactionRepository.saveAll(transactions);
        return transactions.size();
    }

    /**
     * Inject the canonical Yellowstone vacation cluster onto a credit account.
     * These 4 transactions are what the Event Intelligence Agent detects.
     */
    public void injectYellowstoneCluster(Account creditAccount) {
        List<Transaction> cluster = new ArrayList<>();
        Random rng = new Random(99);
        LocalDate base = LocalDate.now().minusDays(32);

        cluster.add(buildTransaction(creditAccount, "UNITED AIRLINES 016", "United Airlines",
                "Travel", "Airline", new BigDecimal("-1240.00"), base, false, false, rng));
        cluster.add(buildTransaction(creditAccount, "YELLOWSTONE LODGES", "Yellowstone Lodge",
                "Travel", "Hotel", new BigDecimal("-1680.00"), base.plusDays(1), false, false, rng));
        cluster.add(buildTransaction(creditAccount, "HERTZ RENT-A-CAR", "Hertz",
                "Travel", "Car Rental", new BigDecimal("-620.00"), base.plusDays(1), false, false, rng));
        cluster.add(buildTransaction(creditAccount, "OLD FAITHFUL DINING", "Restaurants",
                "Dining", "Restaurant", new BigDecimal("-660.00"), base.plusDays(3), false, false, rng));

        transactionRepository.saveAll(cluster);
    }

    private Transaction buildTransaction(Account account, String raw, String normalised, String category,
                                          String subcategory, BigDecimal amount, LocalDate date,
                                          boolean recurring, boolean income, Random rng) {
        return Transaction.builder()
                .transactionId(UUID.randomUUID().toString())
                .account(account)
                .amount(amount)
                .merchantRaw(raw)
                .merchantNormalised(normalised)
                .category(category)
                .subcategory(subcategory)
                .transactionDate(date)
                .recurring(recurring)
                .incomeFlag(income)
                .confidence(BigDecimal.valueOf(0.85 + rng.nextDouble() * 0.14))
                .neo4jSynced(false)
                .build();
    }
}
