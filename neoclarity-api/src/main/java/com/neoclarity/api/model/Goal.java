package com.neoclarity.api.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "goals")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "goal_id", nullable = false, unique = true, length = 64)
    @Builder.Default
    private String goalId = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    /** EMERGENCY_FUND | VACATION | COLLEGE | DEBT_PAYOFF */
    @Column(name = "goal_type", nullable = false, length = 30)
    private String goalType;

    @Column(name = "target_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal targetAmount;

    @Column(name = "current_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal currentAmount = BigDecimal.ZERO;

    @Column(name = "monthly_contribution", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal monthlyContribution = BigDecimal.ZERO;

    private LocalDate deadline;

    /** ACTIVE | ACHIEVED | PAUSED | CANCELLED */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "achieved_at")
    private LocalDateTime achievedAt;

    /** Convenience — not persisted. Used by API responses. */
    @Transient
    public int getProgressPercent() {
        if (targetAmount == null || targetAmount.compareTo(BigDecimal.ZERO) == 0) return 0;
        return currentAmount.multiply(BigDecimal.valueOf(100))
                .divide(targetAmount, 0, java.math.RoundingMode.HALF_UP)
                .intValue();
    }
}
