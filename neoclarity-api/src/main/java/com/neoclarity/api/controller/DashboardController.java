package com.neoclarity.api.controller;

import com.neoclarity.api.dto.ResilienceScoreResponse;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.repository.ResilienceScoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final ResilienceScoreRepository resilienceScoreRepository;

    /** Latest Clarity / Resilience Score with component breakdown. */
    @GetMapping("/resilience-score")
    public ResponseEntity<ResilienceScoreResponse> getLatestScore(@AuthenticationPrincipal Customer customer) {
        return resilienceScoreRepository.findFirstByCustomerIdOrderByComputedAtDesc(customer.getId())
                .map(ResilienceScoreResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    /** Score history for the trend line on the Clarity Score card. */
    @GetMapping("/resilience-score/history")
    public ResponseEntity<List<ResilienceScoreResponse>> getScoreHistory(@AuthenticationPrincipal Customer customer) {
        List<ResilienceScoreResponse> history = resilienceScoreRepository
                .findByCustomerIdOrderByComputedAtDesc(customer.getId())
                .stream().map(ResilienceScoreResponse::from).toList();
        return ResponseEntity.ok(history);
    }
}
