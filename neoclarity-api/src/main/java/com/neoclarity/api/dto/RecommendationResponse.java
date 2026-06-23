package com.neoclarity.api.dto;

import com.neoclarity.api.model.Recommendation;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Builder
public record RecommendationResponse(
        String recommendationId,
        String agent,
        String priority,
        String reason,
        String recommendationText,
        String expectedImpact,
        BigDecimal confidence,
        boolean requiresApproval,
        String response,
        LocalDateTime createdAt
) {
    public static RecommendationResponse from(Recommendation r) {
        return RecommendationResponse.builder()
                .recommendationId(r.getRecommendationId())
                .agent(r.getAgent())
                .priority(r.getPriority())
                .reason(r.getReason())
                .recommendationText(r.getRecommendationText())
                .expectedImpact(r.getExpectedImpact())
                .confidence(r.getConfidence())
                .requiresApproval(r.isRequiresApproval())
                .response(r.getResponse())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
