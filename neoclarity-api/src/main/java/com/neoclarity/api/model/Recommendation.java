package com.neoclarity.api.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Standard Recommendation Object — ADR-003.
 * Immutable once created. Customer response is the only mutable field.
 */
@Entity
@Table(name = "recommendations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Recommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recommendation_id", nullable = false, unique = true, length = 64)
    @Builder.Default
    private String recommendationId = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    /** FinancialAssessmentAgent | GoalPlanningAgent | EventIntelligenceAgent | SupervisorAgent */
    @Column(nullable = false, length = 50)
    private String agent;

    /** CRITICAL | HIGH | MEDIUM | LOW */
    @Column(nullable = false, length = 10)
    private String priority;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "recommendation_text", nullable = false, columnDefinition = "TEXT")
    private String recommendationText;

    @Column(name = "expected_impact", columnDefinition = "TEXT")
    private String expectedImpact;

    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal confidence;

    @Column(name = "requires_approval", nullable = false)
    @Builder.Default
    private boolean requiresApproval = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "goal_id")
    private Goal goal;

    @Column(name = "session_id", length = 64)
    private String sessionId;

    /** PENDING | APPROVED | DISMISSED | REMIND_LATER */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String response = "PENDING";

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
