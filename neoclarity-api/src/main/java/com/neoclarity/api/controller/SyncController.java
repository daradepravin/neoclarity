package com.neoclarity.api.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.neoclarity.api.dto.SyncBatchResult;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.model.ResilienceScore;
import com.neoclarity.api.repository.ResilienceScoreRepository;
import com.neoclarity.api.service.AgentService;
import com.neoclarity.api.service.SyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

/**
 * Demo sync trigger endpoints.
 *
 * POST /api/sync/accounts   — serve next batch + block up to 15s for agent result
 * POST /api/sync/reset      — reset batch counter (for demo restart)
 * GET  /api/sync/status     — which batch is next
 */
@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
@Slf4j
public class SyncController {

    private final SyncService syncService;
    private final AgentService agentService;
    private final ResilienceScoreRepository resilienceScoreRepository;

    /**
     * Applies the next scripted transaction batch, synchronously calls the FastAPI
     * agent layer (up to 15 s), and returns the updated resilience score and
     * consequence narrative in a single response.
     *
     * This is explicitly a demo trigger on seeded data — there is no live bank
     * integration. The intelligence pipeline (categorise → graph → score) is real.
     */
    @PostMapping("/accounts")
    public ResponseEntity<SyncBatchResult> sync(@AuthenticationPrincipal Customer customer) {
        int previousScore = resilienceScoreRepository
            .findFirstByCustomerIdOrderByComputedAtDesc(customer.getId())
            .map(ResilienceScore::getOverallScore)
            .orElse(0);

        SyncService.SyncSummary summary = syncService.applyNextBatch(customer);

        int newScore = previousScore;
        boolean analysisComplete = false;
        try {
            JsonNode result = agentService.analyze(customer.getHashedId(), "SYNC")
                .block(Duration.ofSeconds(15));
            if (result != null
                    && result.has("resilience_score")
                    && !result.get("resilience_score").isNull()) {
                newScore = result.get("resilience_score").path("overall").asInt(previousScore);
                analysisComplete = true;
            }
        } catch (Exception e) {
            log.warn("sync.agent_timeout hid={} err={}", customer.getHashedId().substring(0, 8), e.getMessage());
        }

        log.info("sync.complete hid={} batch={} prev={} new={} delta={}",
            customer.getHashedId().substring(0, 8), summary.batchNumber(),
            previousScore, newScore, newScore - previousScore);

        return ResponseEntity.ok(new SyncBatchResult(
            summary.batchNumber(),
            summary.batchLabel(),
            summary.narrative(),
            summary.transactionsAdded(),
            previousScore,
            newScore,
            newScore - previousScore,
            summary.consequenceType(),
            summary.consequenceLabel(),
            summary.consequenceIcon(),
            summary.nextBatchPreview(),
            summary.batchesRemaining(),
            analysisComplete
        ));
    }

    /** Reset the batch counter — restarts the demo arc from Batch 1. */
    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> reset(@AuthenticationPrincipal Customer customer) {
        syncService.resetBatch(customer.getId());
        return ResponseEntity.ok(Map.of(
            "status", "reset",
            "message", "Batch counter reset. Next sync will start from Batch 1."
        ));
    }

    /** Returns which batch is up next without applying it. */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@AuthenticationPrincipal Customer customer) {
        int nextBatch = syncService.nextBatchNumber(customer.getId());
        return ResponseEntity.ok(Map.of(
            "nextBatch", nextBatch,
            "totalBatches", 3,
            "hasMore", nextBatch <= 3
        ));
    }
}
