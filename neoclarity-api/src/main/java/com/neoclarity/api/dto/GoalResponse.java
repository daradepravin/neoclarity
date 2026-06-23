package com.neoclarity.api.dto;

import com.neoclarity.api.model.Goal;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;

@Builder
public record GoalResponse(
        String goalId,
        String goalType,
        BigDecimal targetAmount,
        BigDecimal currentAmount,
        BigDecimal monthlyContribution,
        LocalDate deadline,
        String status,
        int progressPercent
) {
    public static GoalResponse from(Goal g) {
        return GoalResponse.builder()
                .goalId(g.getGoalId())
                .goalType(g.getGoalType())
                .targetAmount(g.getTargetAmount())
                .currentAmount(g.getCurrentAmount())
                .monthlyContribution(g.getMonthlyContribution())
                .deadline(g.getDeadline())
                .status(g.getStatus())
                .progressPercent(g.getProgressPercent())
                .build();
    }
}
