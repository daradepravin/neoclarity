package com.neoclarity.api.controller;

import com.neoclarity.api.dto.RecommendationActionRequest;
import com.neoclarity.api.dto.RecommendationResponse;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.model.Recommendation;
import com.neoclarity.api.service.RecommendationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;

    @GetMapping
    public ResponseEntity<List<RecommendationResponse>> getAll(@AuthenticationPrincipal Customer customer) {
        List<RecommendationResponse> recs = recommendationService.getRecommendations(customer.getId())
                .stream().map(RecommendationResponse::from).toList();
        return ResponseEntity.ok(recs);
    }

    /** FR-9.3 — the dashboard hero card. */
    @GetMapping("/next-best-action")
    public ResponseEntity<RecommendationResponse> getNextBestAction(@AuthenticationPrincipal Customer customer) {
        Recommendation nba = recommendationService.getNextBestAction(customer.getId());
        if (nba == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(RecommendationResponse.from(nba));
    }

    /** FR-10.1–10.3 — Approve / Dismiss / Remind Later. */
    @PatchMapping("/{recommendationId}")
    public ResponseEntity<RecommendationResponse> respond(
            @AuthenticationPrincipal Customer customer,
            @PathVariable String recommendationId,
            @Valid @RequestBody RecommendationActionRequest request
    ) {
        Recommendation updated = recommendationService.respond(customer, recommendationId, request.response());
        return ResponseEntity.ok(RecommendationResponse.from(updated));
    }
}
