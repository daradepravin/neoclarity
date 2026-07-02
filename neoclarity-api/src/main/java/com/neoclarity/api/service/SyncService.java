package com.neoclarity.api.service;

import com.neoclarity.api.model.Account;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.model.Transaction;
import com.neoclarity.api.repository.AccountRepository;
import com.neoclarity.api.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Demo sync control — applies scripted transaction batches in sequence to drive
 * the full intelligence chain: PG → Neo4j → agent → updated score + recommendations.
 *
 * Three batches tell a deliberate narrative arc:
 *   Batch 1: steady month      → mild positive
 *   Batch 2: emergency expenses → savings depleted, score drops
 *   Batch 3: paycheck delayed  → income stability crash, recommendations surface
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SyncService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final TwinProjectionService twinProjectionService;

    private final ConcurrentHashMap<Long, Integer> batchCounters = new ConcurrentHashMap<>();

    /** Reset the batch counter for this customer (demo restart). */
    public void resetBatch(Long customerId) {
        batchCounters.remove(customerId);
        log.info("sync.batch_reset customer_id={}", customerId);
    }

    /** Returns the 1-indexed batch number that will run next (wraps after 3). */
    public int nextBatchNumber(Long customerId) {
        int idx = batchCounters.getOrDefault(customerId, 0) % BATCHES.size();
        return BATCHES.get(idx).number();
    }

    // ── Internal data model ───────────────────────────────────────────────────

    record SyncTxn(String amount, String merchantRaw, String merchantNorm,
                   String category, String subcategory, boolean recurring,
                   boolean income, String accountType, int daysAgo) {}

    record BatchDef(
        int number, String label, String narrative,
        String consequenceType, String consequenceLabel, String consequenceIcon,
        String nextBatchPreview,
        List<SyncTxn> transactions,
        double checkingDelta, double savingsDelta
    ) {}

    public record SyncSummary(
        int batchNumber, String batchLabel, String narrative,
        int transactionsAdded,
        String consequenceType, String consequenceLabel, String consequenceIcon,
        String nextBatchPreview, int batchesRemaining
    ) {}

    // ── Scripted batches ──────────────────────────────────────────────────────

    private static final List<BatchDef> BATCHES = List.of(

        new BatchDef(1,
            "Steady Month",
            "Regular paycheck and monthly bills. Cash flow is positive. Automatic $300 savings contribution made.",
            "STEADY",
            "Emergency fund building steadily",
            "📈",
            "Next: An unexpected large expense will hit — prepare for a bigger swing.",
            List.of(
                new SyncTxn("+5200.00", "ADP Payroll Direct", "ADP PAYROLL",
                    "INCOME",       "SALARY",        true,  true,  "CHECKING", 63),
                new SyncTxn("-2150.00", "Chase Mortgage Auto", "CHASE MORTGAGE",
                    "HOUSING",      "MORTGAGE",      true,  false, "CHECKING", 62),
                new SyncTxn("-178.00",  "ConEd Electric Bill", "CONED ELECTRIC",
                    "UTILITIES",    "ELECTRICITY",   true,  false, "CHECKING", 60),
                new SyncTxn("-382.00",  "Whole Foods Market",  "WHOLE FOODS",
                    "GROCERIES",    "SUPERMARKET",   false, false, "CHECKING", 58),
                new SyncTxn("-162.00",  "Chipotle & Dining",   "DINING",
                    "DINING",       "RESTAURANTS",   false, false, "CHECKING", 55),
                new SyncTxn("-84.00",   "Netflix/Spotify/Disney","STREAMING",
                    "ENTERTAINMENT","SUBSCRIPTIONS", true,  false, "CHECKING", 54),
                new SyncTxn("+300.00",  "Auto-Savings Transfer","SAVINGS XFER",
                    "TRANSFER",     "SAVINGS",       true,  true,  "SAVINGS",  63)
            ),
            +2244.0, +300.0
        ),

        new BatchDef(2,
            "Emergency Expenses Hit",
            "HVAC failed and an emergency vet visit hit the same week. Tapped $2,500 from emergency savings to cover it.",
            "EMERGENCY_FUND_WARNING",
            "Emergency fund: 0.4 months runway — critically low",
            "⚠️",
            "Next: Paycheck delay coming — reserves are nearly gone.",
            List.of(
                new SyncTxn("+5200.00", "ADP Payroll Direct",  "ADP PAYROLL",
                    "INCOME",       "SALARY",        true,  true,  "CHECKING", 33),
                new SyncTxn("-2150.00", "Chase Mortgage Auto",  "CHASE MORTGAGE",
                    "HOUSING",      "MORTGAGE",      true,  false, "CHECKING", 32),
                new SyncTxn("-3540.00", "ABC HVAC Services",    "HVAC REPAIR",
                    "HOME_REPAIR",  "EMERGENCY",     false, false, "CHECKING", 29),
                new SyncTxn("-1195.00", "Dr Paws Animal Hospital","EMERGENCY VET",
                    "MEDICAL",      "VETERINARY",    false, false, "CHECKING", 27),
                new SyncTxn("-178.00",  "ConEd Electric Bill",  "CONED ELECTRIC",
                    "UTILITIES",    "ELECTRICITY",   true,  false, "CHECKING", 26),
                new SyncTxn("-2500.00", "Emergency Savings Withdrawal","SAVINGS XFER",
                    "TRANSFER",     "EMERGENCY",     false, false, "SAVINGS",  30)
            ),
            -1863.0, -2500.0
        ),

        new BatchDef(3,
            "Paycheck Delayed — Reserves Gone",
            "Paycheck delayed by 2 weeks. Bills still auto-paid. Annual insurance premium hit with near-zero savings left.",
            "INCOME_DISRUPTION",
            "Income disruption — $0 income this period. Resilience critically low.",
            "🚨",
            "All 3 demo cycles complete — click Sync again to restart the arc.",
            List.of(
                new SyncTxn("-2150.00", "Chase Mortgage Auto",  "CHASE MORTGAGE",
                    "HOUSING",      "MORTGAGE",      true,  false, "CHECKING", 5),
                new SyncTxn("-840.00",  "State Farm Auto Ins",  "STATE FARM",
                    "INSURANCE",    "AUTO",          false, false, "CHECKING", 4),
                new SyncTxn("-178.00",  "ConEd Electric Bill",  "CONED ELECTRIC",
                    "UTILITIES",    "ELECTRICITY",   true,  false, "CHECKING", 3),
                new SyncTxn("-285.00",  "Target Groceries",     "TARGET",
                    "GROCERIES",    "SUPERMARKET",   false, false, "CHECKING", 2),
                new SyncTxn("-420.00",  "Chase Card Minimum",   "CHASE CREDIT",
                    "DEBT",         "CREDIT_CARD",   true,  false, "CHECKING", 1)
            ),
            -3873.0, 0.0
        )
    );

    // ── Public entry point ────────────────────────────────────────────────────

    @Transactional
    public SyncSummary applyNextBatch(Customer customer) {
        int batchIdx = batchCounters.getOrDefault(customer.getId(), 0) % BATCHES.size();
        batchCounters.put(customer.getId(), batchIdx + 1);

        BatchDef batch = BATCHES.get(batchIdx);
        log.info("sync.apply_batch hid={} batch={}", customer.getHashedId().substring(0, 8), batch.number());

        Map<String, Account> byType = accountRepository.findByCustomerId(customer.getId())
            .stream()
            .collect(Collectors.toMap(Account::getAccountType, a -> a, (a, b) -> a));

        Account checking = byType.get("CHECKING");
        Account savings  = byType.get("SAVINGS");

        int txnCount = 0;
        for (SyncTxn txn : batch.transactions()) {
            Account account = "SAVINGS".equals(txn.accountType()) ? savings : checking;
            if (account == null) {
                log.warn("sync.skip_txn no_account type={}", txn.accountType());
                continue;
            }
            transactionRepository.save(Transaction.builder()
                .transactionId(UUID.randomUUID().toString())
                .account(account)
                .amount(new BigDecimal(txn.amount()))
                .merchantRaw(txn.merchantRaw())
                .merchantNormalised(txn.merchantNorm())
                .category(txn.category())
                .subcategory(txn.subcategory())
                .transactionDate(LocalDate.now().minusDays(txn.daysAgo()))
                .recurring(txn.recurring())
                .incomeFlag(txn.income())
                .neo4jSynced(false)
                .build());
            txnCount++;
        }

        // Flush balance changes to PG and sync transactions + balance to Neo4j
        if (checking != null) {
            if (batch.checkingDelta() != 0) {
                checking.setBalance(checking.getBalance().add(BigDecimal.valueOf(batch.checkingDelta())));
                accountRepository.save(checking);
                twinProjectionService.updateAccountBalance(checking.getAccountId(), checking.getBalance().doubleValue());
            }
            twinProjectionService.syncTransactionsNow(checking);
        }
        if (savings != null) {
            if (batch.savingsDelta() != 0) {
                savings.setBalance(savings.getBalance().add(BigDecimal.valueOf(batch.savingsDelta())));
                accountRepository.save(savings);
                twinProjectionService.updateAccountBalance(savings.getAccountId(), savings.getBalance().doubleValue());
            }
            if (batch.savingsDelta() != 0) {
                twinProjectionService.syncTransactionsNow(savings);
            }
        }

        int remaining = BATCHES.size() - batchIdx - 1;
        return new SyncSummary(
            batch.number(), batch.label(), batch.narrative(),
            txnCount,
            batch.consequenceType(), batch.consequenceLabel(), batch.consequenceIcon(),
            batch.nextBatchPreview(), remaining
        );
    }
}
