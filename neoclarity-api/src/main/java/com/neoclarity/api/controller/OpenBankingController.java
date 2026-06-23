package com.neoclarity.api.controller;

import com.neoclarity.api.model.Customer;
import com.neoclarity.api.service.OpenBankingCatalog;
import com.neoclarity.api.service.OpenBankingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Mock Open Banking endpoints. Drives the "Connect Account" consent flow:
 *   1. GET  /api/open-banking/institutions        — browse providers
 *   2. GET  /api/open-banking/institutions/{id}    — preview accounts (consent screen)
 *   3. POST /api/open-banking/link                 — grant consent + link accounts
 */
@RestController
@RequestMapping("/api/open-banking")
@RequiredArgsConstructor
public class OpenBankingController {

    private final OpenBankingService openBankingService;

    @GetMapping("/institutions")
    public ResponseEntity<List<OpenBankingCatalog.Institution>> getInstitutions() {
        return ResponseEntity.ok(openBankingService.getInstitutions());
    }

    @GetMapping("/institutions/{institutionId}")
    public ResponseEntity<OpenBankingCatalog.Institution> getInstitution(@PathVariable String institutionId) {
        return ResponseEntity.ok(openBankingService.getInstitution(institutionId));
    }

    @PostMapping("/link")
    public ResponseEntity<OpenBankingService.LinkResult> link(
            @AuthenticationPrincipal Customer customer,
            @RequestBody LinkRequest request
    ) {
        OpenBankingService.LinkResult result =
                openBankingService.linkAccounts(customer, request.institutionId(), request.selectedMasks());
        return ResponseEntity.ok(result);
    }

    public record LinkRequest(String institutionId, List<String> selectedMasks) {}
}
