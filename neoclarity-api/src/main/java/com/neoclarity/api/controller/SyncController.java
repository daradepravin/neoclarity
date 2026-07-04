package com.neoclarity.api.controller;

import com.neoclarity.api.model.Customer;
import com.neoclarity.api.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Demo sync trigger endpoints.
 *
 * POST /api/sync          — serve next batch + trigger agent re-run
 * POST /api/sync/reset    — reset batch counter (for demo restart)
 * GET  /api/sync/status   — which batch is next
 */
@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
public class SyncController {

    private final SyncService syncService;

    @PostMapping
    public ResponseEntity<SyncService.SyncResult> sync(
            @AuthenticationPrincipal Customer customer
    ) {
        SyncService.SyncResult result = syncService.sync(customer);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/reset")
    public ResponseEntity<Void> reset(@AuthenticationPrincipal Customer customer) {
        syncService.resetBatch(customer.getHashedId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/status")
    public ResponseEntity<StatusResponse> status(@AuthenticationPrincipal Customer customer) {
        int current = syncService.currentBatch(customer.getHashedId());
        int total = SyncService.SyncResult.class.getDeclaredFields().length; // unused
        return ResponseEntity.ok(new StatusResponse(
            current,
            3,  // total batches
            current < 3
        ));
    }

    public record StatusResponse(int currentBatch, int totalBatches, boolean hasMore) {}
}
