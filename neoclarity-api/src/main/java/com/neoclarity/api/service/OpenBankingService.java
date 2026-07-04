package com.neoclarity.api.service;

import com.neoclarity.api.exception.ApiException;
import com.neoclarity.api.model.Account;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OpenBankingService {

    private final AccountRepository accountRepository;
    private final MockTransactionGenerator transactionGenerator;
    private final TwinProjectionService twinProjectionService;
    private final AgentService agentService;

    /** Provider catalog — the institutions a customer can connect. */
    public List<OpenBankingCatalog.Institution> getInstitutions() {
        return OpenBankingCatalog.INSTITUTIONS;
    }

    /** Preview the accounts an institution exposes (shown on the consent screen). */
    public OpenBankingCatalog.Institution getInstitution(String institutionId) {
        OpenBankingCatalog.Institution inst = OpenBankingCatalog.byId(institutionId);
        if (inst == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Institution not found: " + institutionId);
        }
        return inst;
    }

    /**
     * Complete the consent handshake: link the selected accounts from an institution,
     * generate their transaction history, and project everything into the Neo4j
     * Household Digital Twin asynchronously.
     */
    @Transactional
    public LinkResult linkAccounts(Customer customer, String institutionId, List<String> selectedMasks) {
        OpenBankingCatalog.Institution inst = getInstitution(institutionId);

        int accountsLinked = 0;
        int transactionsImported = 0;
        boolean yellowstoneInjected = false;
        List<Account> linkedAccounts = new java.util.ArrayList<>();

        for (OpenBankingCatalog.AccountTemplate tmpl : inst.accounts()) {
            if (selectedMasks != null && !selectedMasks.isEmpty() && !selectedMasks.contains(tmpl.mask())) {
                continue;
            }

            Account account = Account.builder()
                    .accountId(sha256(institutionId + ":" + tmpl.mask() + ":" + customer.getId() + ":" + UUID.randomUUID()))
                    .customer(customer)
                    .institution(inst.name())
                    .accountType(tmpl.accountType())
                    .balance(BigDecimal.valueOf(tmpl.balance()))
                    .currency("USD")
                    .active(true)
                    .linkedAt(LocalDateTime.now())
                    .lastRefreshedAt(LocalDateTime.now())
                    .build();

            account = accountRepository.save(account);
            linkedAccounts.add(account);
            accountsLinked++;

            // Generate transaction history into PostgreSQL
            transactionsImported += transactionGenerator.generateForAccount(account);

            if ("CREDIT".equals(tmpl.accountType()) && !yellowstoneInjected) {
                transactionGenerator.injectYellowstoneCluster(account);
                transactionsImported += 4;
                yellowstoneInjected = true;
            }
        }

        if (accountsLinked == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No accounts were selected to link");
        }

        // Grant consent if not already active
        if (!customer.isConsentActive()) {
            customer.setConsentActive(true);
            customer.setConsentGrantedAt(LocalDateTime.now());
        }

        // ── Project to Neo4j Twin (async — runs after PostgreSQL commit) ──
        // @Async means this returns immediately; projection happens in background.
        // The @Transactional boundary above ensures PG is committed before Neo4j reads.
        final List<Account> accountsForProjection = linkedAccounts;
        twinProjectionService.projectFullTwin(customer, accountsForProjection);

        // Trigger agent analysis asynchronously after Twin is projected.
        // subscribeOn ensures this doesn't block the HTTP response.
        agentService.analyze(customer.getHashedId(), "ACCOUNT_LINK")
            .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
            .subscribe(
                result -> log.info("agent.link_analysis_complete hid={}", customer.getHashedId().substring(0, 8)),
                error  -> log.warn("agent.link_analysis_error err={}", error.getMessage())
            );

        return new LinkResult(inst.name(), accountsLinked, transactionsImported, yellowstoneInjected);
    }

    public record LinkResult(String institution, int accountsLinked, int transactionsImported, boolean eventDetected) {}

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
