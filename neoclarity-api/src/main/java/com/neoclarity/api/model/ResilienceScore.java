package com.neoclarity.api.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/** Immutable — a new row is created on every analysis cycle. Never updated. */
@Entity
@Table(name = "resilience_scores")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResilienceScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "score_id", nullable = false, unique = true, length = 64)
    @Builder.Default
    private String scoreId = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "overall_score", nullable = false)
    private Integer overallScore;

    @Column(name = "emergency_fund_score", nullable = false)
    private Integer emergencyFundScore;

    @Column(name = "cash_flow_score", nullable = false)
    private Integer cashFlowScore;

    @Column(name = "debt_burden_score", nullable = false)
    private Integer debtBurdenScore;

    @Column(name = "income_stability_score", nullable = false)
    private Integer incomeStabilityScore;

    @Column(name = "goal_readiness_score", nullable = false)
    private Integer goalReadinessScore;

    /** ACCOUNT_LINK | REFRESH | MANUAL */
    @Column(name = "triggered_by", nullable = false, length = 20)
    @Builder.Default
    private String triggeredBy = "ACCOUNT_LINK";

    @Column(name = "computed_at", nullable = false)
    @Builder.Default
    private LocalDateTime computedAt = LocalDateTime.now();
}
