package com.neoclarity.api.service;

import com.neoclarity.api.exception.ApiException;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.model.Recommendation;
import com.neoclarity.api.repository.RecommendationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final RecommendationRepository recommendationRepository;

    public List<Recommendation> getRecommendations(Long customerId) {
        return recommendationRepository.findByCustomerIdOrderByPriorityAscCreatedAtDesc(customerId);
    }

    /** The single hero card on the dashboard — highest priority PENDING recommendation. */
    public Recommendation getNextBestAction(Long customerId) {
        return recommendationRepository.findByCustomerIdAndResponse(customerId, "PENDING")
                .stream()
                .min((a, b) -> priorityRank(a.getPriority()) - priorityRank(b.getPriority()))
                .orElse(null);
    }

    /**
     * FR-10.1–10.4: Approve, Dismiss, or Remind Later.
     * On APPROVED, downstream the Goal should be updated and Twin re-synced
     * (Week 5 — FastAPI call to apply the recommended change to the Twin).
     */
    public Recommendation respond(Customer customer, String recommendationId, String response) {
        Recommendation rec = recommendationRepository.findByRecommendationIdAndCustomerId(recommendationId, customer.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Recommendation not found"));

        if (!"PENDING".equals(rec.getResponse()) && !"REMIND_LATER".equals(rec.getResponse())) {
            throw new ApiException(HttpStatus.CONFLICT, "Recommendation already actioned: " + rec.getResponse());
        }

        rec.setResponse(response);
        rec.setRespondedAt(LocalDateTime.now());

        // TODO (Week 5): if response == APPROVED and rec.getGoal() != null,
        // call FastAPI agent layer to update Twin (goal.monthly_contribution, etc.)
        // and write the RECEIVED relationship update in Neo4j.

        return recommendationRepository.save(rec);
    }

    private int priorityRank(String priority) {
        return switch (priority) {
            case "CRITICAL" -> 0;
            case "HIGH" -> 1;
            case "MEDIUM" -> 2;
            case "LOW" -> 3;
            default -> 4;
        };
    }
}
