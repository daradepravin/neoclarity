package com.neoclarity.api.controller;

import com.neoclarity.api.model.Account;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.repository.AccountRepository;
import com.neoclarity.api.service.TwinProjectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Admin / diagnostic endpoints.
 * All require authentication — these are for the developer, not customers.
 *
 * POST /api/admin/twin/sync
 *   Forces a full Twin projection for the authenticated customer.
 *   Use this when Neo4j is empty and you need to re-populate it
 *   without wiping and re-seeding PostgreSQL.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AccountRepository accountRepository;
    private final TwinProjectionService twinProjectionService;

    @PostMapping("/twin/sync")
    public ResponseEntity<Map<String, Object>> syncTwin(
            @AuthenticationPrincipal Customer customer
    ) {
        List<Account> accounts = accountRepository.findByCustomerId(customer.getId());

        // projectFullTwin is @Async — it fires and returns immediately.
        // The sync runs in a background thread. Check Neo4j after ~10 seconds.
        twinProjectionService.projectFullTwin(customer, accounts);

        return ResponseEntity.ok(Map.of(
            "status", "projection_started",
            "customer_hashed_id", customer.getHashedId(),
            "accounts_queued", accounts.size(),
            "message", "Twin projection running in background. Check Neo4j in ~10 seconds."
        ));
    }
}