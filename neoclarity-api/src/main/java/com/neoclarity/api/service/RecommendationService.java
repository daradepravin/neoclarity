package com.neoclarity.api.service;

import com.neoclarity.api.exception.ApiException;
import com.neoclarity.api.model.Customer;
import com.neoclarity.api.model.Goal;
import com.neoclarity.api.model.Recommendation;
import com.neoclarity.api.repository.GoalRepository;
import com.neoclarity.api.repository.RecommendationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final RecommendationRepository recommendationRepository;
    private final GoalRepository goalRepository;
    private final TwinProjectionService twinProjectionService;

    /** Matches "$100", "$1,200", "$100/month", "$100 per month" etc. */
    private static final Pattern DOLLAR_AMOUNT = Pattern.compile("\\$([0-9,]+(?:\\.[0-9]{2})?)");

    public List<Recommendation> getRecommendations(Long customerId) {
        return recommendationRepository.findByCustomerIdOrderByPriorityAscCreatedAtDesc(customerId);
    }

    public Recommendation getNextBestAction(Long customerId) {
        return recommendationRepository.findByCustomerIdAndResponse(customerId, "PENDING")
                .stream()
                .min((a, b) -> priorityRank(a.getPriority()) - priorityRank(b.getPriority()))
                .orElse(null);
    }

    /**
     * FR-10.1–10.4: Approve, Dismiss, or Remind Later.
     *
     * THE APPROVAL LOOP (closed):
     * On APPROVED, if the recommendation is linked to a goal and contains a
     * dollar amount, the goal's monthly contribution is increased by that
     * amount, persisted to PostgreSQL, and projected to the Neo4j Twin.
     * The next agent analysis then computes a score that reflects the
     * customer's decision — recommend → approve → Twin changes → score responds.
     */
    @Transactional
    public Recommendation respond(Customer customer, String recommendationId, String response) {
        Recommendation rec = recommendationRepository.findByRecommendationIdAndCustomerId(recommendationId, customer.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Recommendation not found"));

        if (!"PENDING".equals(rec.getResponse()) && !"REMIND_LATER".equals(rec.getResponse())) {
            throw new ApiException(HttpStatus.CONFLICT, "Recommendation already actioned: " + rec.getResponse());
        }

        rec.setResponse(response);
        rec.setRespondedAt(LocalDateTime.now());
        rec = recommendationRepository.save(rec);

        if ("APPROVED".equals(response)) {
            applyApprovedRecommendation(customer, rec);
        }

        return rec;
    }

    /**
     * Apply the approved recommendation's change to the linked goal.
     * Extracts the dollar amount from the recommendation text and increases
     * the goal's monthly contribution. Falls back to a $100 default increase
     * if no explicit amount is present (matches the standard agent phrasing).
     */
    private void applyApprovedRecommendation(Customer customer, Recommendation rec) {
        Goal goal = rec.getGoal();

        // If no goal linked directly, try to match by recommendation content
        if (goal == null) {
            goal = inferGoalFromText(customer, rec.getRecommendationText());
        }

        if (goal == null) {
            log.info("approval.no_goal_to_update rec={}", rec.getRecommendationId());
            return;
        }

        BigDecimal increase = extractDollarAmount(rec.getRecommendationText())
                .or(() -> extractDollarAmount(rec.getReason()))
                .orElse(new BigDecimal("100.00"));   // sensible default for "increase contribution" recs

        BigDecimal oldContribution = goal.getMonthlyContribution();
        goal.setMonthlyContribution(oldContribution.add(increase));
        goal = goalRepository.save(goal);

        // Project the changed goal to the Neo4j Twin — the next agent run
        // sees the customer's decision reflected in the graph.
        twinProjectionService.projectGoal(customer, goal);

        log.info("approval.applied goal={} contribution {} -> {}",
                goal.getGoalType(), oldContribution, goal.getMonthlyContribution());
    }

    private java.util.Optional<BigDecimal> extractDollarAmount(String text) {
        if (text == null) return java.util.Optional.empty();
        Matcher m = DOLLAR_AMOUNT.matcher(text);
        if (m.find()) {
            try {
                return java.util.Optional.of(new BigDecimal(m.group(1).replace(",", "")));
            } catch (NumberFormatException ignored) {}
        }
        return java.util.Optional.empty();
    }

    /** Match recommendation text to a goal type when no direct link exists. */
    private Goal inferGoalFromText(Customer customer, String text) {
        if (text == null) return null;
        String lower = text.toLowerCase();
        String goalType = lower.contains("emergency") ? "EMERGENCY_FUND"
                : lower.contains("college") ? "COLLEGE"
                : lower.contains("vacation") ? "VACATION"
                : lower.contains("debt") ? "DEBT_PAYOFF"
                : null;
        if (goalType == null) return null;
        return goalRepository.findByCustomerIdAndStatus(customer.getId(), "ACTIVE").stream()
                .filter(g -> goalType.equals(g.getGoalType()))
                .findFirst().orElse(null);
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
