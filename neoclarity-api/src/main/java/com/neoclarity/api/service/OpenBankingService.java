package com.neoclarity.api.service;

import com.neoclarity.api.exception.ApiException;
import com.neoclarity.api.model.Account;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
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
public class OpenBankingService {

    private final AccountRepository accountRepository;
    private final MockTransactionGenerator transactionGenerator;

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
     * Complete the consent handshake: link the selected accounts from an institution
     * and generate their transaction history. This is the moment that, in a real
     * system, the OAuth consent token would be exchanged and the aggregator's
     * account + transaction feed would begin flowing.
     */
    @Transactional
    public LinkResult linkAccounts(Customer customer, String institutionId, List<String> selectedMasks) {
        OpenBankingCatalog.Institution inst = getInstitution(institutionId);

        int accountsLinked = 0;
        int transactionsImported = 0;
        boolean yellowstoneInjected = false;

        for (OpenBankingCatalog.AccountTemplate tmpl : inst.accounts()) {
            // If the customer selected specific accounts, honour that; otherwise link all
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
            accountsLinked++;

            // Generate transaction history
            transactionsImported += transactionGenerator.generateForAccount(account);

            // Inject the Yellowstone cluster on the first credit account linked —
            // this is what powers the Event Intelligence demo
            if ("CREDIT".equals(tmpl.accountType()) && !yellowstoneInjected) {
                transactionGenerator.injectYellowstoneCluster(account);
                transactionsImported += 4;
                yellowstoneInjected = true;
            }
        }

        if (accountsLinked == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No accounts were selected to link");
        }

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
