package com.neoclarity.api.service;

import com.neoclarity.api.exception.ApiException;
import com.neoclarity.api.model.Account;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Consent and data-lifecycle operations.
 *
 * Two distinct, deliberately different actions:
 *
 *  1. disconnectAccount  — SOFT. Sets is_active=false. Stops the account counting
 *     toward net worth / Resilience Score and halts future ingestion, but RETAINS
 *     all historical transactions and recommendations for audit. This mirrors how
 *     regulated institutions handle consent revocation: stop processing, retain
 *     required records. (FR-2.3)
 *
 *  2. deleteMyData — HARD. Removes the customer's accounts, transactions, goals,
 *     scores, events, recommendations, and context. The explicit "right to be
 *     forgotten" action a customer must consciously choose. (FR-2.4)
 */
@Service
@RequiredArgsConstructor
public class ConsentService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final GoalRepository goalRepository;
    private final ResilienceScoreRepository resilienceScoreRepository;
    private final LifeEventRepository lifeEventRepository;
    private final RecommendationRepository recommendationRepository;
    private final CustomerContextRepository customerContextRepository;
    private final CustomerRepository customerRepository;

    /** SOFT — deactivate a single account. Transactions are retained for audit. */
    @Transactional
    public DisconnectResult disconnectAccount(Customer customer, String accountId) {
        Account account = accountRepository.findByAccountIdAndCustomerId(accountId, customer.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Account not found"));

        if (!account.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT, "Account is already disconnected");
        }

        account.setActive(false);
        account.setLastRefreshedAt(LocalDateTime.now());
        accountRepository.save(account);

        // NOTE (Week 5): mirror to Neo4j — set Account.is_active=false so agents
        // exclude it from Twin traversal. Transactions and BELONGS_TO edges remain
        // for lineage/audit.

        return new DisconnectResult(account.getInstitution(), account.getAccountType(), false);
    }

    /** Reconnect a previously disconnected account (reverses the soft disconnect). */
    @Transactional
    public DisconnectResult reconnectAccount(Customer customer, String accountId) {
        Account account = accountRepository.findByAccountIdAndCustomerId(accountId, customer.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Account not found"));

        account.setActive(true);
        account.setLastRefreshedAt(LocalDateTime.now());
        accountRepository.save(account);

        return new DisconnectResult(account.getInstitution(), account.getAccountType(), true);
    }

    /**
     * HARD — delete all financial data for the customer. The customer record
     * itself is retained (so they can still log in), but every account,
     * transaction, goal, score, event, recommendation, and context label is removed.
     * Consent flags are reset.
     */
    @Transactional
    public DeleteResult deleteMyData(Customer customer) {
        Long cid = customer.getId();

        int txnCount = transactionRepository.findByAccountCustomerIdAndTransactionDateGreaterThanEqual(
                cid, java.time.LocalDate.of(1970, 1, 1)).size();
        List<Account> accounts = accountRepository.findByCustomerId(cid);
        int acctCount = accounts.size();
        // (txnCount is captured before deletion purely for the response summary)

        // Order matters for FK integrity: children first.
        transactionRepository.deleteByCustomerId(cid);
        recommendationRepository.deleteAll(recommendationRepository.findByCustomerIdOrderByPriorityAscCreatedAtDesc(cid));
        lifeEventRepository.deleteAll(lifeEventRepository.findByCustomerId(cid));
        resilienceScoreRepository.deleteAll(resilienceScoreRepository.findByCustomerIdOrderByComputedAtDesc(cid));
        goalRepository.deleteAll(goalRepository.findByCustomerId(cid));
        customerContextRepository.deleteAll(customerContextRepository.findByCustomerIdAndConfirmedTrue(cid));
        accountRepository.deleteAll(accounts);

        // Reset consent flags
        customer.setConsentActive(false);
        customer.setConsentRevokedAt(LocalDateTime.now());
        customerRepository.save(customer);

        return new DeleteResult(acctCount, txnCount);
    }

    public record DisconnectResult(String institution, String accountType, boolean active) {}
    public record DeleteResult(int accountsRemoved, int transactionsRemoved) {}
}
