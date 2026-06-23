package com.neoclarity.api.service;

import com.neoclarity.api.dto.GoalRequest;
import com.neoclarity.api.exception.ApiException;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.model.Goal;
import com.neoclarity.api.repository.GoalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GoalService {

    private static final List<String> VALID_TYPES =
            List.of("EMERGENCY_FUND", "VACATION", "COLLEGE", "DEBT_PAYOFF");

    private final GoalRepository goalRepository;

    public List<Goal> getGoalsForCustomer(Long customerId) {
        return goalRepository.findByCustomerId(customerId);
    }

    public Goal createGoal(Customer customer, GoalRequest req) {
        if (!VALID_TYPES.contains(req.goalType())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "goalType must be one of " + VALID_TYPES);
        }

        Goal goal = Goal.builder()
                .customer(customer)
                .goalType(req.goalType())
                .targetAmount(req.targetAmount())
                .currentAmount(req.currentAmount() != null ? req.currentAmount() : BigDecimal.ZERO)
                .monthlyContribution(req.monthlyContribution() != null ? req.monthlyContribution() : BigDecimal.ZERO)
                .deadline(req.deadline())
                .status("ACTIVE")
                .build();

        return goalRepository.save(goal);
    }

    public Goal updateGoal(Customer customer, String goalId, GoalRequest req) {
        Goal goal = goalRepository.findByGoalIdAndCustomerId(goalId, customer.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Goal not found"));

        if (req.targetAmount() != null) goal.setTargetAmount(req.targetAmount());
        if (req.currentAmount() != null) goal.setCurrentAmount(req.currentAmount());
        if (req.monthlyContribution() != null) goal.setMonthlyContribution(req.monthlyContribution());
        if (req.deadline() != null) goal.setDeadline(req.deadline());

        return goalRepository.save(goal);
    }

    public Goal setStatus(Customer customer, String goalId, String status) {
        Goal goal = goalRepository.findByGoalIdAndCustomerId(goalId, customer.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Goal not found"));

        goal.setStatus(status);
        if ("ACHIEVED".equals(status)) {
            goal.setAchievedAt(java.time.LocalDateTime.now());
        }
        return goalRepository.save(goal);
    }
}
