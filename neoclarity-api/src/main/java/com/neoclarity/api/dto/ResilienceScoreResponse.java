package com.neoclarity.api.dto;

import com.neoclarity.api.model.ResilienceScore;
import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record ResilienceScoreResponse(
        Integer overall,
        Components components,
        LocalDateTime computedAt
) {
    @Builder
    public record Components(
            Integer emergencyFund,
            Integer cashFlow,
            Integer debtBurden,
            Integer incomeStability,
            Integer goalReadiness
    ) {}

    public static ResilienceScoreResponse from(ResilienceScore s) {
        return ResilienceScoreResponse.builder()
                .overall(s.getOverallScore())
                .components(Components.builder()
                        .emergencyFund(s.getEmergencyFundScore())
                        .cashFlow(s.getCashFlowScore())
                        .debtBurden(s.getDebtBurdenScore())
                        .incomeStability(s.getIncomeStabilityScore())
                        .goalReadiness(s.getGoalReadinessScore())
                        .build())
                .computedAt(s.getComputedAt())
                .build();
    }
}
