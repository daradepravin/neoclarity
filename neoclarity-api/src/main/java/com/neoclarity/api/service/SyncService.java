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

import reactor.core.scheduler.Schedulers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Drives the Sync Accounts demo flow.
 *
 * Serves scripted transaction batches in sequence (1 → 2 → 3 → wraps).
 * Each sync:
 *   1. Picks the next batch for this customer session
 *   2. Maps transactions onto the customer's real account nodes
 *   3. Persists to PostgreSQL (source of truth)
 *   4. Projects new Transaction nodes into Neo4j Twin
 *   5. Triggers FinancialAssessmentAgent re-run via AgentService
 *   6. Returns the new score + narrative for the UI
 *
 * Batch state is per-customer in-memory — resets on restart.
 * For a demo this is correct: each session gets a fresh narrative arc.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyncService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final TwinProjectionService twinProjectionService;
    private final AgentService agentService;

    /** In-memory batch counter per customer. Resets on server restart. */
    private final Map<String, Integer> batchState = new ConcurrentHashMap<>();

    public record SyncResult(
        int batchNumber,
        int totalBatches,
        String narrative,
        String storyArc,
        int transactionsAdded,
        boolean hasMoreBatches,
        String agentSessionId
    ) {}

    @Transactional
    public SyncResult sync(Customer customer) {
        String hid = customer.getHashedId();

        // Determine which batch is next (1-indexed, wraps after last)
        int nextBatch = batchState.compute(hid, (k, current) -> {
            if (current == null || current >= SyncBatchFixtures.totalBatches()) return 1;
            return current + 1;
        });

        SyncBatchFixtures.Batch batch = SyncBatchFixtures.getBatch(nextBatch);
        log.info("sync.start hid={} batch={}", hid.substring(0, 8), nextBatch);

        // Get customer's accounts to map transactions onto
        List<Account> accounts = accountRepository.findByCustomerIdAndActiveTrue(customer.getId());
        if (accounts.isEmpty()) {
            log.warn("sync.no_accounts hid={}", hid.substring(0, 8));
            return new SyncResult(nextBatch, SyncBatchFixtures.totalBatches(),
                "No active accounts found. Connect an account first.",
                "", 0, false, null);
        }

        // Map account types to actual account entities
        Account checkingAccount = accounts.stream()
            .filter(a -> "CHECKING".equals(a.getAccountType())).findFirst().orElse(accounts.get(0));
        Account savingsAccount = accounts.stream()
            .filter(a -> "SAVINGS".equals(a.getAccountType())).findFirst().orElse(checkingAccount);
        Account creditAccount = accounts.stream()
            .filter(a -> "CREDIT".equals(a.getAccountType())).findFirst().orElse(checkingAccount);

        // Persist batch transactions to PostgreSQL
        List<Transaction> saved = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (SyncBatchFixtures.Transaction fixture : batch.transactions()) {
            Account targetAccount = switch (fixture.accountType()) {
                case "SAVINGS" -> savingsAccount;
                case "CREDIT" -> creditAccount;
                default -> checkingAccount;
            };

            Transaction txn = Transaction.builder()
                .transactionId(UUID.randomUUID().toString())
                .account(targetAccount)
                .amount(BigDecimal.valueOf(fixture.amount()))
                .merchantRaw(fixture.merchantRaw())
                .merchantNormalised(fixture.merchantNormalised())
                .category(fixture.category())
                .subcategory(fixture.subcategory())
                .transactionDate(today.minusDays(fixture.daysAgo()))
                .recurring(fixture.recurring())
                .incomeFlag(fixture.income())
                .confidence(BigDecimal.valueOf(0.95))
                .neo4jSynced(false)
                .build();

            saved.add(transactionRepository.save(txn));
        }

        log.info("sync.pg_saved count={} batch={}", saved.size(), nextBatch);

        // Project new transactions into Neo4j Twin (async)
        for (Account account : accounts) {
            twinProjectionService.projectTransactions(account);
        }

        // Trigger agent re-run — this is where the score moves
        // Fire and forget — the UI polls for the result via existing endpoints
        // publishOn(boundedElastic) keeps blocking JPA calls off the Reactor I/O thread
        String[] sessionId = {UUID.randomUUID().toString()};
        agentService.analyze(hid, "REFRESH")
            .publishOn(Schedulers.boundedElastic())
            .doOnSuccess(result -> {
                if (result != null) {
                    agentService.persistAnalysisResults(hid, result);
                    log.info("sync.agent_complete batch={} session={}", nextBatch, sessionId[0]);
                }
            })
            .subscribe();

        boolean hasMore = nextBatch < SyncBatchFixtures.totalBatches();

        return new SyncResult(
            nextBatch,
            SyncBatchFixtures.totalBatches(),
            batch.narrative(),
            batch.storyArc(),
            saved.size(),
            hasMore,
            sessionId[0]
        );
    }

    /** Reset the batch counter for a customer (useful for demo reset). */
    public void resetBatch(String hashedId) {
        batchState.remove(hashedId);
        log.info("sync.batch_reset hid={}", hashedId.substring(0, 8));
    }

    public int currentBatch(String hashedId) {
        return batchState.getOrDefault(hashedId, 0);
    }
}
