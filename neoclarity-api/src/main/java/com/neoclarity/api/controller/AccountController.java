package com.neoclarity.api.controller;

import com.neoclarity.api.dto.AccountResponse;
import com.neoclarity.api.model.Account;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.repository.AccountRepository;
import com.neoclarity.api.service.ConsentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountRepository accountRepository;
    private final ConsentService consentService;

    /** All linked accounts (active and disconnected) for the authenticated customer. */
    @GetMapping
    public ResponseEntity<List<AccountResponse>> getAccounts(@AuthenticationPrincipal Customer customer) {
        List<AccountResponse> accounts = accountRepository.findByCustomerId(customer.getId())
                .stream()
                .map(AccountResponse::from)
                .toList();
        return ResponseEntity.ok(accounts);
    }

    /** Net worth = sum of ACTIVE account balances only (disconnected accounts excluded). */
    @GetMapping("/net-worth")
    public ResponseEntity<NetWorthResponse> getNetWorth(@AuthenticationPrincipal Customer customer) {
        List<Account> accounts = accountRepository.findByCustomerIdAndActiveTrue(customer.getId());

        BigDecimal netWorth = accounts.stream()
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ResponseEntity.ok(new NetWorthResponse(netWorth, accounts.size()));
    }

    /** FR-2.3 — Disconnect an account (SOFT: deactivate, retain transactions for audit). */
    @PostMapping("/{accountId}/disconnect")
    public ResponseEntity<ConsentService.DisconnectResult> disconnect(
            @AuthenticationPrincipal Customer customer,
            @PathVariable String accountId
    ) {
        return ResponseEntity.ok(consentService.disconnectAccount(customer, accountId));
    }

    /** Reconnect a previously disconnected account. */
    @PostMapping("/{accountId}/reconnect")
    public ResponseEntity<ConsentService.DisconnectResult> reconnect(
            @AuthenticationPrincipal Customer customer,
            @PathVariable String accountId
    ) {
        return ResponseEntity.ok(consentService.reconnectAccount(customer, accountId));
    }

    public record NetWorthResponse(BigDecimal netWorth, int accountCount) {}
}
