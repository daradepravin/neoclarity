package com.neoclarity.api.controller;

import com.neoclarity.api.model.Account;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.repository.AccountRepository;
import com.neoclarity.api.repository.GoalRepository;
import com.neoclarity.api.repository.TransactionRepository;
import com.neoclarity.api.service.TwinProjectionService;
import lombok.RequiredArgsConstructor;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Admin / diagnostic endpoints.
 *
 * POST /api/admin/twin/sync         — force full Twin projection
 * GET  /api/admin/twin/consistency  — PG vs Neo4j reconciliation check
 *
 * The consistency check is the guard against silent divergence: a resilience
 * score computed on an incomplete Twin looks identical to one computed on a
 * complete Twin. This endpoint makes the gap visible.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AccountRepository accountRepository;
    private final GoalRepository goalRepository;
    private final TransactionRepository transactionRepository;
    private final TwinProjectionService twinProjectionService;
    private final Driver neo4jDriver;

    @PostMapping("/twin/sync")
    public ResponseEntity<Map<String, Object>> syncTwin(
            @AuthenticationPrincipal Customer customer
    ) {
        List<Account> accounts = accountRepository.findByCustomerId(customer.getId());
        twinProjectionService.projectFullTwin(customer, accounts);

        return ResponseEntity.ok(Map.of(
            "status", "projection_started",
            "customer_hashed_id", customer.getHashedId(),
            "accounts_queued", accounts.size(),
            "message", "Twin projection running in background. Check consistency in ~10 seconds."
        ));
    }

    /**
     * Reconciliation: compare entity counts between PostgreSQL (source of
     * truth) and the Neo4j Twin. A mismatch means the Twin is incomplete
     * and any score computed on it is based on partial data.
     */
    @GetMapping("/twin/consistency")
    public ResponseEntity<Map<String, Object>> consistency(
            @AuthenticationPrincipal Customer customer
    ) {
        // PostgreSQL counts
        long pgAccounts = accountRepository.findByCustomerId(customer.getId()).size();
        long pgTransactions = transactionRepository
            .findByAccountCustomerIdAndTransactionDateGreaterThanEqual(
                customer.getId(), LocalDate.of(1970, 1, 1)).size();
        long pgGoals = goalRepository.findByCustomerId(customer.getId()).size();

        // Neo4j counts
        long neoAccounts = 0, neoTransactions = 0, neoGoals = 0;
        try (Session session = neo4jDriver.session()) {
            var result = session.run("""
                MATCH (c:Customer {hashed_id: $hid})
                CALL { WITH c OPTIONAL MATCH (c)-[:HAS_ACCOUNT]->(a:Account)
                       RETURN count(a) AS accounts }
                CALL { WITH c OPTIONAL MATCH (c)-[:HAS_ACCOUNT]->(:Account)-[:CONTAINS]->(t:Transaction)
                       RETURN count(t) AS transactions }
                CALL { WITH c OPTIONAL MATCH (c)-[:HAS_GOAL]->(g:Goal)
                       RETURN count(g) AS goals }
                RETURN accounts, transactions, goals
                """,
                Values.parameters("hid", customer.getHashedId()));
            var record = result.single();
            neoAccounts = record.get("accounts").asLong();
            neoTransactions = record.get("transactions").asLong();
            neoGoals = record.get("goals").asLong();
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                "status", "NEO4J_UNREACHABLE",
                "error", e.getMessage(),
                "postgres", Map.of("accounts", pgAccounts, "transactions", pgTransactions, "goals", pgGoals)
            ));
        }

        double txnCompleteness = pgTransactions == 0 ? 1.0
            : (double) neoTransactions / pgTransactions;

        boolean consistent = pgAccounts == neoAccounts
            && pgGoals == neoGoals
            && txnCompleteness >= 0.95;

        return ResponseEntity.ok(Map.of(
            "status", consistent ? "CONSISTENT" : "DIVERGED",
            "transaction_completeness", Math.round(txnCompleteness * 1000) / 10.0 + "%",
            "postgres", Map.of("accounts", pgAccounts, "transactions", pgTransactions, "goals", pgGoals),
            "neo4j", Map.of("accounts", neoAccounts, "transactions", neoTransactions, "goals", neoGoals),
            "recommendation", consistent
                ? "Twin is complete. Scores are computed on full data."
                : "Twin is incomplete — run POST /api/admin/twin/sync to reconcile before trusting scores."
        ));
    }
}
